/* specs/pwa/audioAssets —— 音频可达（含 riddle/）+ 智能预载（BUGS#23）：
   ① 进课即并行预取本课音频集 → 写入 SW 运行时缓存 pinyin-audio（hyp 呼读/lessons 口诀·旁白/ui 短语）
   ② 预载落定后点读第一个字母：点击→可播 <100ms（预载命中=零网络等待；before=网络冷请求 1.2s+）
   ③ ui 短语元素级：src 单一 .mp3（无双扩展回归）+ 真实解码在播 + URL content-type=audio
   ④ 音频资产可达抽查：hyp/lessons/ui/**riddle（51 条谜面=Bug#39 依赖）** 各样本 200+audio
   迁移自：v312-accept A 段 + T3 新增 riddle 可达面。断言只写本文件。 */
import fs from 'node:fs'
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally, sleep } from '../../flows/assert.mjs'

const t = new Tally('pwa/audioAssets 音频可达+智能预载')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

/* ① ② ③ 预载链 */
{
  const page = await app.newPage({ tier: 'mid' })
  const audioReqs = []
  page.on('response', (r) => { if (r.url().includes('/audio/')) audioReqs.push({ u: r.url(), s: r.status(), ct: r.headers()['content-type'] || '' }) })
  await page.goto(`${BASE}/?open=lesson&learn=1&li=0`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#v-lesson .hspage', { timeout: 10000 })

  const expected = ['hyp/a.mp3', 'lessons/kj_a.mp3', 'lessons/write_a.mp3', 'ui/swipe-next-step.mp3']
  const cacheHas = async (frag) => page.evaluate(async (f) => {
    const c = await caches.open('pinyin-audio')
    const keys = (await c.keys()).map((k) => k.url)
    return keys.some((u) => u.includes(f))
  }, frag)
  let preloaded = false
  for (let i = 0; i < 60; i++) {
    if ((await Promise.all(expected.map(cacheHas))).every(Boolean)) { preloaded = true; break }
    await sleep(500)
  }
  t.ok(preloaded, '预载集写入 pinyin-audio 缓存', expected.join(' '))
  t.ok(audioReqs.some((r) => r.u.includes('hyp/a.mp3')), '呼读音(hyp/a)预载请求发出')
  t.ok(audioReqs.some((r) => r.u.includes('lessons/kj_a.mp3')), '口诀(lessons/kj_a)预载请求发出')
  t.ok(audioReqs.some((r) => r.u.includes('lessons/write_a.mp3')), '写法旁白(lessons/write_a)预载请求发出')
  t.ok(audioReqs.some((r) => r.u.includes('/ui/')), 'UI 短语预载请求发出', `共 ${audioReqs.filter((r) => r.u.includes('/ui/')).length} 条`)

  /* ② 预载稳定后 reload（SW 缓存+JS 全热），计时走纯缓存命中路径（=真实二次进入） */
  const cacheCount = () => page.evaluate(async () => (await (await caches.open('pinyin-audio')).keys()).length)
  let stable = 0, prev = -1
  for (let i = 0; i < 120 && stable < 3; i++) {
    const c = await cacheCount()
    stable = c === prev ? stable + 1 : 0
    prev = c
    await sleep(350)
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#v-lesson .hspage', { timeout: 10000 })
  const tPlay = await page.evaluate(() => new Promise((res) => {
    const btn = document.querySelector('[data-pcread="a"]')
    if (!btn) return res(-2)
    const t0 = performance.now()
    const audios = []
    const orig = Audio.prototype.play
    Audio.prototype.play = function () { audios.push(this); return orig.call(this) }
    btn.click()
    const tick = () => {
      const a = audios[audios.length - 1]
      if (a && (a.readyState >= 3 || a.currentTime > 0)) { Audio.prototype.play = orig; return res(performance.now() - t0) }
      if (performance.now() - t0 > 8000) { Audio.prototype.play = orig; return res(-1) }
      requestAnimationFrame(tick)
    }
    tick()
  }))
  t.ok(tPlay >= 0 && tPlay < 100, '点读第一个字母 点击→可播 <100ms（预载命中）', `${(+tPlay).toFixed(1)}ms`)

  /* ③ ui 短语：src 单一 .mp3 + 真实在播（预载预热后点击命中 AUDIO_CACHE 不发网络请求，故走元素级） */
  const uiInfo = await page.evaluate(() => new Promise((res) => {
    const audios = []
    const orig = Audio.prototype.play
    Audio.prototype.play = function () { audios.push(this); return orig.call(this) }
    const el = document.querySelector('#swipehint .speak.canplay')
    if (!el) { Audio.prototype.play = orig; return res(null) }
    el.click()
    setTimeout(() => {
      Audio.prototype.play = orig
      const a = audios[audios.length - 1]
      res(a ? { src: a.currentSrc || a.src, err: a.error ? a.error.code : null, t: a.currentTime } : { src: null })
    }, 900)
  }))
  t.ok(!!uiInfo && uiInfo.src && uiInfo.src.includes('ui/swipe-next-step.mp3') && !uiInfo.src.includes('.mp3.mp3'),
    'ui 短语元素 src 单一 .mp3（无双扩展）', uiInfo?.src ? uiInfo.src.split('/audio/')[1] : '未触发播放')
  t.ok(!!uiInfo && uiInfo.src && !uiInfo.err && uiInfo.t > 0, 'ui 短语真实在播（解码成功、currentTime 前进）',
    uiInfo ? `t=${uiInfo.t?.toFixed(2)}s err=${uiInfo.err}` : '-')
  const uiCt = await page.evaluate(async () => {
    const u = new URL('audio/ui/swipe-next-step.mp3', location.href)
    const r = await fetch(u)
    return r.headers.get('content-type')
  })
  t.ok(/audio\//.test(uiCt || ''), 'ui 短语 URL 响应 content-type=audio', uiCt || '-')
  await app.closePage(page)
}

/* ④ 资产可达抽查：hyp/lessons/ui + riddle（谜面 51 条=口诀地鼠依赖） */
{
  const page = await app.newPage({ tier: 'mid' })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  const samples = [
    'audio/hyp/a.mp3', 'audio/hyp/ba1.mp3', 'audio/lessons/kj_b.mp3', 'audio/lessons/write_a.mp3',
    'audio/riddle/b.mp3', 'audio/riddle/a.mp3', 'audio/riddle/ao.mp3',
    'audio/ui/swipe-next-step.mp3',
  ]
  const results = await page.evaluate(async (urls) => Promise.all(urls.map(async (u) => {
    const r = await fetch(new URL(u, location.href))
    return { u, s: r.status, ct: r.headers.get('content-type') || '', len: (await r.arrayBuffer()).byteLength }
  })), samples)
  for (const r of results) {
    t.ok(r.s === 200 && /audio|octet/.test(r.ct) && r.len > 500, `可达 ${r.u.replace('audio/', '')}`, `${r.s} ${r.ct} ${r.len}B`)
  }
  /* riddle 库全量点名（51 条目录级核对——谜面缺一=地鼠谜面制哑题） */
  const riddleDir = 'public/audio/riddle'
  if (fs.existsSync(riddleDir)) {
    const files = fs.readdirSync(riddleDir).filter((f) => f.endsWith('.mp3'))
    t.ok(files.length >= 50, 'riddle 谜面库 ≥50 条（目录级）', `n=${files.length}`)
  } else {
    t.ok(false, 'riddle 谜面库目录存在', 'public/audio/riddle 缺失')
  }
  await app.closePage(page)
}

t.pageErrors(app.errors, 'audioAssets 全程')
await app.close()
process.exit(t.finish())
