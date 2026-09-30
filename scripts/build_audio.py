#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""拼音读音统一管线（kuaner 铁律 2026-09-30 09:20："拼音不要自己生成！"）

audio/lessons/ 与根区凡"文本含拼音字母读音"的 mimo 文件换血：
  - 解构 lessons.json 的 kj（口诀）/say（写法旁白）文本 = 纯中文段 + 拼音段序列
    例："扁扁嘴巴 e e e" → [mimo"扁扁嘴巴"] + [hyp:e.mp3]×3
  - mimo 段：tts.py 单段合成（冰糖，风格同原批 "|幼儿园老师教学，清晰缓慢"，纯汉字，禁拉丁）
  - 拼音段：public/audio/hyp/ 真人库直取（带调 token 如 zhī→hyp/zhi1.mp3，ü→v）
  - ffmpeg concat：段间 150ms 静音，统一 24kHz mono，mp3 64k，同名覆盖
  - 纯拼音口诀（"ong ong ong"型）：全 hyp 直拼，零合成
  - 根区 mimo 字母兜底位（b.mp3|玻 等，运行时 hyp 优先、此为回落层）：hyp/同名 直拷换血

产出：public/audio/来源审计表.md（每文件解构序列+来源清单+前后时长）
可重复执行：mimo 段缓存 /tmp/pinyin_mimo_cache；重制前原文件备份 /tmp/pinyin_before
用法：python3 scripts/build_audio.py [--dry-run] [--only lessons|root|all]
"""

import hashlib
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # repo root
AUDIO = os.path.join(ROOT, 'public', 'audio')
TTS = os.path.expanduser('~/.claude/skills/mimo-tts/scripts/tts.py')
STYLE = '幼儿园老师教学，清晰缓慢'  # 与原 lessons 批次同风格（memory: pinyin-audio-sources）
CACHE = '/tmp/pinyin_mimo_cache'
BACKUP = '/tmp/pinyin_before'
SIL_SEC = 0.15  # 段间静音
SR = 24000

# 拼音 token 全集（ASCII 安全名；ü→v、üe→ve、ün→vn）
SM = list('bpmfdtnlgkhjqxzcsryw') + ['zh', 'ch', 'sh']  # 23 声母（含 y w）
YM = list('aoeiuv') + ['ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 've', 'er',
                       'an', 'en', 'in', 'un', 'vn', 'ang', 'eng', 'ing', 'ong']
ZT = ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
      'yi', 'wu', 'yu', 'ye', 'yue', 'yin', 'yun', 'yuan', 'ying']
LETTER_SET = set(SM + YM + ZT)

# 去调号整表转换（memory 教训：必须 str.maketrans 整表，逐字符替换曾配错）
_TONES = {'a': 'āáǎà', 'e': 'ēéěè', 'i': 'īíǐì', 'o': 'ōóǒò', 'u': 'ūúǔù', 'ü': 'ǖǘǚǜ'}
DEACCENT = {}
for _b, _ms in _TONES.items():
    for _i, _m in enumerate(_ms):
        DEACCENT[_m] = (_b, _i + 1)  # (基字母, 声调)
DEMAP = str.maketrans({k: v[0] for k, v in DEACCENT.items()})

# 拉丁 run：含 Latin-1 带调区（á U+00E1、ù U+00F9…）与 Extended 区（ā ǖ…）；
# 坑：ú/ì 在 Latin-1（C0-FF），ī/ǖ 在 Extended（100-17F），只写一段会漏拆 token
LATIN_RUN = re.compile(r'[A-Za-zÀ-ÿĀ-ǜ]+')
EDGE_PUNCT = ' \t\r\n，。、！？；：（）()【】《》,.!?;:~～—…"'


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def probe_dur(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'csv=p=0', path])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return -1.0


def rms_db(path):
    """astats 整体 RMS（dB），失败返回 None"""
    r = run(['ffmpeg', '-hide_banner', '-nostats', '-i', path,
             '-af', 'astats', '-f', 'null', '-'])
    m = re.search(r'RMS level dB:\s*(-?[\d.]+|-\w+)', r.stderr)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def deaccent(tok):
    """'zhī'→('zhi',1)  'e'→('e',0)  'üe'→('ve',0)"""
    tone = 0
    for ch in tok:
        if ch in DEACCENT:
            tone = DEACCENT[ch][1]
    base = tok.translate(DEMAP).replace('ü', 'v')
    return base, tone


def hyp_file(tok):
    """token → hyp 文件名（带调优先 tone 变体，回落裸名）"""
    base, tone = deaccent(tok)
    if base not in LETTER_SET:
        raise SystemExit(f'[FATAL] 未知拼音 token: {tok!r} (基={base!r})')
    if tone and os.path.exists(os.path.join(AUDIO, 'hyp', f'{base}{tone}.mp3')):
        return f'{base}{tone}.mp3'
    if os.path.exists(os.path.join(AUDIO, 'hyp', f'{base}.mp3')):
        return f'{base}.mp3'
    raise SystemExit(f'[FATAL] hyp 缺文件: {tok!r} → hyp/{base}.mp3 / {base}{tone}.mp3 均不存在')


def tokenize(text):
    """文本 → [('mimo', 中文段) | ('hyp', token)] 有序序列"""
    text = unicodedata.normalize('NFC', text)  # 组合附标归一为预组合字符
    segs, pos = [], 0
    for m in LATIN_RUN.finditer(text):
        cn = text[pos:m.start()]
        cn = cn.strip(EDGE_PUNCT)
        if cn:
            segs.append(('mimo', cn))
        segs.append(('hyp', m.group(0)))
        pos = m.end()
    tail = text[pos:].strip(EDGE_PUNCT)
    if tail:
        segs.append(('mimo', tail))
    if not segs:
        raise SystemExit(f'[FATAL] 解构为空: {text!r}')
    return segs


def frag_name(text):
    return 'frag_' + hashlib.md5(text.encode('utf-8')).hexdigest()[:10]


def plan_lessons():
    """lessons.json → [(输出rel路径, 原文, segs, 类型)]；纯中文 say 不入列"""
    d = json.load(open(os.path.join(ROOT, 'src', 'data', 'lessons.json'), encoding='utf-8'))
    plan, untouched = [], []
    for ls in d['lessons']:
        for t in ls['letters']:
            for kind, akey, field in (('kj', 'kjAudio', 'kj'), ('say', 'sayAudio', 'say')):
                rel = t[akey] + '.mp3'  # 如 lessons/kj_e.mp3
                text = t[field]
                if not LATIN_RUN.search(text):
                    untouched.append((rel, text, kind))
                    continue
                segs = tokenize(text)
                pure = all(k == 'hyp' for k, _ in segs)
                plan.append((rel, text, segs, '纯hyp' if pure else '混合拼接'))
    return plan, untouched


def plan_root():
    """MANIFEST 根区 mimo 段全量解析：stem∈拼音集且有 hyp 同名 → 直拷换血；其余全记入不动清单"""
    out, kept = [], []
    in_hyp = False
    for line in open(os.path.join(AUDIO, 'MANIFEST.txt'), encoding='utf-8'):
        if line.startswith('#'):
            if 'hyp 节' in line:
                in_hyp = True
            continue
        if in_hyp:
            continue
        m = re.match(r'^([A-Za-z0-9_]+)\.mp3\|([^|]+)', line)
        if not m:
            continue
        stem, text = m.group(1), m.group(2).strip()
        hyp = os.path.join(AUDIO, 'hyp', stem + '.mp3')
        if stem in LETTER_SET:
            if not os.path.exists(hyp):
                raise SystemExit(f'[FATAL] 根区字母 {stem} 无 hyp 同名文件')
            out.append((stem, text))
        else:
            kept.append((stem, text))
    return out, kept


def synth_fragments(plan, dry):
    frags = {}
    for _, _, segs, _ in plan:
        for k, v in segs:
            if k == 'mimo':
                frags[frag_name(v)] = v
    os.makedirs(CACHE, exist_ok=True)
    todo = {n: t for n, t in frags.items()
            if not (os.path.exists(os.path.join(CACHE, n + '.wav')) and
                    os.path.getsize(os.path.join(CACHE, n + '.wav')) > 1000)}
    print(f'mimo 段共 {len(frags)} 条（缓存命中 {len(frags) - len(todo)}，待合成 {len(todo)}）')
    if dry:
        for n, t in sorted(frags.items(), key=lambda x: x[1]):
            print(f'  [frag] {t}')
        return frags
    if todo:
        with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8') as f:
            for n, t in sorted(todo.items(), key=lambda x: x[1]):
                assert not re.search(r'[A-Za-z]', t), f'拉丁禁入违例: {t!r}'
                f.write(f'{n}|{t}|{STYLE}\n')
            listfile = f.name
        r = run(['python3', TTS, '--batch', listfile, '--outdir', CACHE, '--voice', '冰糖'])
        os.unlink(listfile)
        # tts.py 批量输出无前缀回显，校验产物
        bad = [n for n in todo if not (os.path.exists(os.path.join(CACHE, n + '.wav'))
                                       and os.path.getsize(os.path.join(CACHE, n + '.wav')) > 1000)]
        if bad:
            print(r.stdout[-2000:] if r.stdout else '', r.stderr[-2000:] if r.stderr else '')
            raise SystemExit(f'[FATAL] tts.py 批量缺产物 {len(bad)} 条: {bad[:5]}')
        for n in todo:
            d = probe_dur(os.path.join(CACHE, n + '.wav'))
            assert d > 0.15, f'合成段过短 {n}: {d}s'
    return frags


def build_segment(src, gain_db, out_wav, is_mimo):
    af = []
    if is_mimo:  # 去首尾静音（保留 50ms 垫），避免与拼接静音叠加
        af.append('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05')
        af.append('areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse')
    if gain_db:
        af.append(f'volume={gain_db:.2f}dB')
    cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src,
           '-af', ','.join(af), '-ar', str(SR), '-ac', '1', out_wav]
    r = run(cmd)
    if r.returncode != 0:
        raise SystemExit(f'[FATAL] 段处理失败 {src}: {r.stderr[-500:]}')


def concat(target, seg_wavs, sil_wav):
    lst = os.path.join(os.path.dirname(target), '.concat_' + str(os.getpid()) + '.txt')
    with open(lst, 'w', encoding='utf-8') as f:
        for i, w in enumerate(seg_wavs):
            if i:
                f.write(f"file '{sil_wav}'\n")
            f.write(f"file '{w}'\n")
    tmp = target + '.tmp.mp3'
    r = run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
             '-i', lst, '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', str(SR), '-ac', '1', tmp])
    os.unlink(lst)
    if r.returncode != 0:
        raise SystemExit(f'[FATAL] concat 失败 {target}: {r.stderr[-500:]}')
    d = probe_dur(tmp)
    assert d > 0.2, f'输出过短 {target}: {d}s'
    os.replace(tmp, target)
    return d


def backup(rel):
    dst = os.path.join(BACKUP, rel)
    if os.path.exists(dst):
        return  # 重跑保护：只备份第一次见到的原文件
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(os.path.join(AUDIO, rel), dst)


def main():
    dry = '--dry-run' in sys.argv
    only = 'root' if '--only' in sys.argv and 'root' in sys.argv[1:] else \
           'lessons' if '--only' in sys.argv and 'lessons' in sys.argv[1:] else 'all'

    lplan, untouched = plan_lessons()
    rplan, rkept = plan_root()
    pure_n = sum(1 for p in lplan if p[3] == '纯hyp')
    print(f'lessons 重制 {len(lplan)} 条（纯hyp {pure_n} / 混合拼接 {len(lplan) - pure_n}），'
          f'不动（纯中文）{len(untouched)} 条；根区字母直拷 {len(rplan)} 条')

    if dry:
        for rel, text, segs, kind in lplan:
            seq = ' + '.join((f'hyp:{hyp_file(v)}'.replace('.mp3', '') if k == 'hyp' else f'mimo({v})')
                             for k, v in segs)
            print(f'  [{kind}] {rel}  「{text}」\n         {seq}')
        print('根区直拷:', ' '.join(s for s, _ in rplan))
        print('不动:', ' '.join(r for r, _, _ in untouched))
        synth_fragments(lplan, dry=True)
        return

    results = []  # (rel, kind, seq_text, dur_after, dur_before)
    frags = synth_fragments(lplan, dry=False) if only != 'root' else {}

    if only in ('lessons', 'all'):
        # 响度基线：全部段源 RMS 中位数，段级增益夹 ±6dB
        srcs = [os.path.join(CACHE, n + '.wav') for n in frags] + \
               [os.path.join(AUDIO, 'hyp', hyp_file(v))
                for _, _, segs, _ in lplan for k, v in segs if k == 'hyp']
        rms_map = {}
        for s in {os.path.normpath(p) for p in srcs}:
            v = rms_db(s)
            if v is not None:
                rms_map[s] = v
        target_rms = statistics.median(rms_map.values())
        print(f'响度基线 RMS 中位数 {target_rms:.1f} dB（段数 {len(rms_map)}）')

        sil_wav = os.path.join(CACHE, 'silence.wav')
        run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
             '-i', f'anullsrc=r={SR}:cl=mono', '-t', str(SIL_SEC), sil_wav])

        tmpd = tempfile.mkdtemp(prefix='pinyin_seg_')
        for i, (rel, text, segs, kind) in enumerate(lplan, 1):
            backup(rel)
            before = probe_dur(os.path.join(BACKUP, rel))
            wavs = []
            for j, (k, v) in enumerate(segs):
                src = os.path.join(CACHE, frag_name(v) + '.wav') if k == 'mimo' \
                    else os.path.join(AUDIO, 'hyp', hyp_file(v))
                g = max(-6.0, min(6.0, target_rms - rms_map.get(os.path.normpath(src), target_rms)))
                w = os.path.join(tmpd, f's{i}_{j}.wav')
                build_segment(src, g, w, k == 'mimo')
                wavs.append(w)
            out = os.path.join(AUDIO, rel)
            dur = concat(out, wavs, sil_wav)
            seq = ' + '.join((f'hyp:{hyp_file(v)}' if k == 'hyp' else f'mimo:{v}') for k, v in segs)
            results.append((rel, kind, seq, dur, before))
            print(f'  [{i}/{len(lplan)}] {rel} {dur:.2f}s ← {seq}')
        shutil.rmtree(tmpd, ignore_errors=True)

    if only in ('root', 'all'):
        for stem, otext in rplan:
            rel = stem + '.mp3'
            backup(rel)
            before = probe_dur(os.path.join(BACKUP, rel))
            shutil.copy2(os.path.join(AUDIO, 'hyp', stem + '.mp3'), os.path.join(AUDIO, rel))
            dur = probe_dur(os.path.join(AUDIO, rel))
            assert dur > 0, f'根区直拷后时长异常 {rel}'
            results.append((rel, '纯hyp直拷', f'hyp:{stem}.mp3（字节级直拷，原mimo文本「{otext}」）', dur, before))
        print(f'根区字母兜底位换血 {len(rplan)} 条')

    # ---- 来源审计表 ----
    untouched.sort()
    lines = ['# 音频来源审计表（拼音读音统一，2026-09-30）', '',
             'kuaner 铁律："任何包含拼音字母/音节发音的音频 = hyp 真人库文件，禁止 mimo 合成拼音读音。"',
             '本表覆盖 audio/MANIFEST.txt 全量审计：重制文件的逐段来源（可追溯）、不动文件的判定依据。', '',
             f'- 重制：lessons {len(lplan)} 条（纯hyp直拼 {pure_n}、混合拼接 {len(lplan) - pure_n}）'
             f'+ 根区字母兜底位直拷 {len(rplan)} 条',
             f'- 不动：lessons 纯中文 {len(untouched)} 条；根区纯中文短语/常见字/双字词/锚点词 {len(rkept)} 条',
             '- 拼接规格：段间 150ms 静音，统一 24kHz mono mp3 64k；mimo 段=冰糖·幼儿园老师教学风格，纯汉字（拉丁禁入）；'
             '拼音段=hyp/ 真人（studycli/lost-theory），带调 token 优先取 tone 变体（zhī→zhi1）',
             '- 重制前原文件备份于 /tmp/pinyin_before（跨会话保底）', '',
             '## 一、重制文件（拼音段来源清单）', '',
             '| 文件 | 类型 | 原文 | 解构序列（按时序） | 新时长 | 旧时长 |',
             '|---|---|---|---|---|---|']
    orig_map = {rel: text for rel, text, _, _ in lplan}
    for rel, kind, seq, dur, before in sorted(results):
        orig = orig_map.get(rel, f'（原 mimo 单字母呼读音，见 MANIFEST {rel} 行）')
        orig = orig.replace('|', '\\|')
        lines.append(f'| {rel} | {kind} | {orig} | {seq} | {dur:.2f}s | {before:.2f}s |')
    lines += ['', '## 二、不动文件（纯中文，mimo 合规）', '',
              '| 文件 | 原文 | 判定 |', '|---|---|---|']
    for rel, text, kind in untouched:
        text = text.replace('|', '\\|')
        why = f'{kind} 纯中文旁白（单字母课）' if kind == 'say' else '纯中文短语'
        lines.append(f'| {rel} | {text} | 无拼音读音，{why} |')
    for stem, text in sorted(rkept):
        text = text.replace('|', '\\|')
        lines.append(f'| {stem}.mp3 | {text} | 纯中文词句（词汇读音非字母教学音，常见字/锚点运行时优先 hyp） |')
    lines += ['', '生成：scripts/build_audio.py（可重复执行，mimo 段缓存 /tmp/pinyin_mimo_cache）', '']
    with open(os.path.join(AUDIO, '来源审计表.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    summary = {'remade_lessons': len(lplan), 'pure_hyp_lessons': pure_n,
               'mixed_lessons': len(lplan) - pure_n, 'root_copies': len(rplan),
               'untouched_lessons': len(untouched), 'root_kept': len(rkept)}
    print('SUMMARY ' + json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    main()
