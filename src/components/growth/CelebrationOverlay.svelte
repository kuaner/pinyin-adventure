<script lang="ts">
  /* v3.2 庆祝仪式（spec 要素3）：全屏 z 最高、自动散场（store 里定时）、点一下跳过。
     quiz=小测过关（彩带+3星飞向计数+小鸡欢呼）；letter=字母学完（半屏迷你）；
     grad=12 课全通毕业典礼（大量彩带+星星汇聚+最终形态+毕业帽）；evolve=小鸡进化（闪光+弹跳亮相）。
     声音=WebAudio 上行琶音（store 触发时起播）；内容实物 emoji 之外零 emoji（图标全 SVG）。 */
  import { CE, dismissCe, stageOf, stageNameKey, G } from '../../stores/growth.svelte'
  import { t } from '../../text/strings'
  import ChickGrowth from './ChickGrowth.svelte'
  import Speak from '../Speak.svelte'

  const COLORS = ['#e76f51', '#f4a6a4', '#e9c46a', '#2a9d8f', '#b58cff', '#f5c31c']
  interface Piece { x: number; dl: number; d: number; r: number; c: string; w: number; h: number }
  const mk = (n: number): Piece[] => Array.from({ length: n }, (_, i) => ({
    x: Math.random() * 100,
    dl: Math.random() * 0.9,
    d: 2 + Math.random() * 1.6,
    r: Math.floor(Math.random() * 380) - 190,
    c: COLORS[i % COLORS.length],
    w: 7 + Math.random() * 6,
    h: 10 + Math.random() * 6,
  }))
  const quizPc = mk(36)
  const gradPc = mk(84)
  const miniPc = mk(14)
  /* 3 颗星星飞向计数 chip 的落点 */
  const fly = [
    { tx: -52, ty: -176, dl: 0.5 },
    { tx: 0, ty: -198, dl: 0.66 },
    { tx: 52, ty: -176, dl: 0.82 },
  ]
  /* 毕业星星汇聚：从四周环飞向中心 */
  const ring = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 8 - Math.PI / 2
    return { fx: Math.cos(a) * 44, fy: Math.sin(a) * 38, dl: 0.35 + i * 0.07 }
  })
  const evName = $derived(t(stageNameKey(CE.stage)))
</script>

{#if CE.mode}
<div id="celebrate" data-ce={CE.mode} onclick={dismissCe}>
  {#if CE.mode === 'quiz'}
    <div class="veil quizveil"></div>
    <div class="confetti">
      {#each quizPc as p, i (i)}<i class="cf" style="left:{p.x}%; background:{p.c}; width:{p.w}px; height:{p.h}px; animation-duration:{p.d}s; animation-delay:{p.dl}s; --r:{p.r}deg"></i>{/each}
    </div>
    <div class="stack">
      <div class="herochick"><ChickGrowth stage={stageOf(G.stars)} cheer /></div>
      <div class="msg"><Speak k="celebQuiz" /></div>
      <div class="gainchip" data-gain>
        <svg viewBox="0 0 24 24" class="gstar"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" /></svg>
        <Speak k="celebStarsN" vars={{ n: CE.gain }} />
      </div>
    </div>
    {#each fly as f, i (i)}
      <i class="flystar" style="--tx:{f.tx}px; --ty:{f.ty}px; animation-delay:{f.dl}s">
        <svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" fill="#f5c31c" stroke="#dba90e" stroke-width="1.4" stroke-linejoin="round" /></svg>
      </i>
    {/each}
  {:else if CE.mode === 'letter'}
    <div class="veil miniveil"></div>
    <div class="sheet">
      <div class="miniconf">
        {#each miniPc as p, i (i)}<i class="cf" style="left:{p.x}%; background:{p.c}; width:{p.w}px; height:{p.h}px; animation-duration:{p.d}s; animation-delay:{p.dl}s; --r:{p.r}deg"></i>{/each}
      </div>
      <div class="minichick"><ChickGrowth stage={stageOf(G.stars)} cheer /></div>
      <div class="msg"><Speak k="celebLetterN" vars={{ x: CE.letter }} /></div>
    </div>
  {:else if CE.mode === 'grad'}
    <div class="veil gradveil"></div>
    <div class="confetti">
      {#each gradPc as p, i (i)}<i class="cf" style="left:{p.x}%; background:{p.c}; width:{p.w}px; height:{p.h}px; animation-duration:{p.d}s; animation-delay:{p.dl}s; --r:{p.r}deg"></i>{/each}
    </div>
    {#each ring as r, i (i)}
      <i class="ringstar" style="--fx:{r.fx}vw; --fy:{r.fy}vh; animation-delay:{r.dl}s">
        <svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" fill="#f5c31c" stroke="#dba90e" stroke-width="1.4" stroke-linejoin="round" /></svg>
      </i>
    {/each}
    <div class="stack">
      <div class="gradbird">
        <ChickGrowth stage={4} pop />
        <svg class="cap" viewBox="0 0 64 40" aria-hidden="true">
          <path d="M32 2 L62 14 L32 26 L2 14 Z" fill="#264653" />
          <path d="M20 20 v9 q12 7 24 0 v-9" fill="#1d3641" />
          <path d="M56 16 v12" stroke="#e9c46a" stroke-width="2.5" stroke-linecap="round" />
          <circle cx="56" cy="30" r="3" fill="#e9c46a" />
        </svg>
      </div>
      <div class="gradtitle"><Speak k="gradTitle" /></div>
      <div class="gradmsg"><Speak k="gradMsg" /></div>
    </div>
  {:else if CE.mode === 'evolve'}
    <div class="veil evolveveil"></div>
    <div class="flash" data-flash></div>
    <svg class="rays" viewBox="0 0 200 200" aria-hidden="true">
      {#each Array(12) as _, i (i)}
        <path d="M100 100 L{100 + 96 * Math.cos((Math.PI * i) / 6 - 0.13)} {100 + 96 * Math.sin((Math.PI * i) / 6 - 0.13)} L{100 + 96 * Math.cos((Math.PI * i) / 6 + 0.13)} {100 + 96 * Math.sin((Math.PI * i) / 6 + 0.13)} Z" fill="#ffe89a" opacity=".5" />
      {/each}
    </svg>
    <div class="stack">
      <div class="evchick"><ChickGrowth stage={CE.stage} pop /></div>
      <div class="msg evolve"><Speak k="evolveToN" vars={{ x: evName }} /></div>
    </div>
  {/if}
  <div class="skip"><Speak k="tapSkip" plain /></div>
</div>
{/if}

<style>
  #celebrate { position: fixed; inset: 0; z-index: 120; overflow: hidden; cursor: pointer;
    animation: ce-in .2s ease-out; }
  @keyframes ce-in { from { opacity: 0; } }
  .veil { position: absolute; inset: 0; }
  .quizveil { background: rgba(255, 251, 240, .82); }
  .miniveil { background: rgba(61, 52, 40, .18); }
  .gradveil { background: linear-gradient(180deg, #fdf3d8 0%, #ffe9ec 55%, #e6f9f6 100%); }
  .evolveveil { background: rgba(255, 248, 224, .88); }

  /* 彩带（≥30 张：quiz 36 / grad 84 / mini 14 限于半屏） */
  .confetti { position: absolute; inset: 0; pointer-events: none; }
  .cf { position: absolute; top: -5%; border-radius: 2px; display: block;
    animation: ce-fall linear forwards; }
  @keyframes ce-fall {
    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
    85% { opacity: 1; }
    100% { transform: translateY(112vh) rotate(var(--r)); opacity: .85; }
  }

  .stack { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: var(--sp-3); pointer-events: none; }
  .herochick { width: 172px; height: 168px; }
  .msg { font-size: var(--fs-xl); font-weight: 900; color: var(--animal-text); text-align: center;
    line-height: 1.9; max-width: 88vw; animation: ce-msg .45s .15s cubic-bezier(.25,1.3,.4,1) backwards; }
  .msg.evolve { color: #b07a1f; }
  @keyframes ce-msg { from { transform: scale(.6); opacity: 0; } }

  .gainchip { display: inline-flex; align-items: center; gap: var(--sp-1); background: #fff;
    border-radius: 999px; padding: var(--sp-2) var(--sp-4); box-shadow: 0 4px 0 #e3d9c8;
    font-size: var(--fs-lg); font-weight: 900; color: #c77800;
    animation: ce-chip .35s 1s cubic-bezier(.25,1.4,.4,1) backwards; }
  .gstar { width: 22px; height: 22px; fill: #f5c31c; stroke: #dba90e; stroke-width: 1.5; stroke-linejoin: round; }
  @keyframes ce-chip { from { transform: scale(0); } }

  .flystar { position: absolute; left: 50%; top: 58%; width: 40px; height: 40px; margin: -20px;
    opacity: 0; pointer-events: none;
    animation: ce-fly .8s cubic-bezier(.3, -.2, .7, 1) forwards; }
  .flystar svg { width: 100%; height: 100%; filter: drop-shadow(0 2px 3px rgba(219, 169, 14, .5)); }
  @keyframes ce-fly {
    0% { transform: translate(0, 0) scale(1); opacity: 0; }
    12% { opacity: 1; }
    100% { transform: translate(var(--tx), var(--ty)) scale(.42) rotate(200deg); opacity: .95; }
  }

  /* 迷你庆祝：半屏底帖 */
  .sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 46%;
    background: #fffbf0; border-radius: 28px 28px 0 0; box-shadow: 0 -6px 24px rgba(61, 52, 40, .18);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-2);
    pointer-events: none; animation: ce-up .38s cubic-bezier(.25,1.2,.4,1); }
  @keyframes ce-up { from { transform: translateY(60%); } }
  .miniconf { position: absolute; inset: 0; overflow: hidden; border-radius: 28px 28px 0 0; }
  .minichick { width: 120px; height: 117px; position: relative; }

  /* 毕业典礼 */
  .gradbird { position: relative; width: 196px; height: 191px; }
  .gradbird .cap { position: absolute; width: 80px; top: 6px; left: 50%; transform: translateX(-52%) rotate(-12deg);
    filter: drop-shadow(0 2px 2px rgba(38, 70, 83, .3)); animation: ce-cap .5s .3s cubic-bezier(.25,1.4,.4,1) backwards; }
  @keyframes ce-cap { from { transform: translateX(-52%) rotate(-32deg) scale(0); } }
  .gradtitle { font-size: 34px; font-weight: 900; color: #b07a1f; text-align: center; line-height: 2;
    animation: ce-msg .5s .25s cubic-bezier(.25,1.3,.4,1) backwards; }
  .gradmsg { font-size: var(--fs-md); font-weight: 800; color: var(--animal-text-2); text-align: center;
    line-height: 2; max-width: 82vw;
    animation: ce-msg .5s .45s cubic-bezier(.25,1.3,.4,1) backwards; }
  .ringstar { position: absolute; left: 50%; top: 44%; width: 26px; height: 26px; margin: -13px;
    opacity: 0; pointer-events: none;
    animation: ce-ring .9s cubic-bezier(.2, -.1, .6, 1) forwards; }
  .ringstar svg { width: 100%; height: 100%; }
  @keyframes ce-ring {
    0% { transform: translate(var(--fx), var(--fy)) scale(1.1); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(0, 0) scale(.3) rotate(160deg); opacity: .9; }
  }

  /* 进化 */
  .flash { position: absolute; inset: 0; background: #fff; opacity: 0;
    animation: ce-flash 1.1s ease-out forwards; }
  @keyframes ce-flash { 0% { opacity: 0; } 25% { opacity: .95; } 100% { opacity: 0; } }
  .rays { position: absolute; width: 130vmax; height: 130vmax; left: 50%; top: 46%; translate: -50% -50%;
    animation: ce-rays 2.4s linear infinite; opacity: .7; }
  @keyframes ce-rays { from { rotate: 0deg; } to { rotate: 360deg; } }
  .evchick { width: 190px; height: 185px; }

  .skip { position: absolute; bottom: calc(var(--sab) + 96px); left: 0; right: 0;
    text-align: center; font-size: var(--fs-xs); font-weight: 700; color: rgba(120, 105, 88, .75); }

  @media (prefers-reduced-motion: reduce) {
    .cf, .flystar, .ringstar, .flash, .rays { animation-duration: .01s !important; animation-iteration-count: 1 !important; }
    .herochick :global(.chickgrow.cheer) { animation: none; }
  }
</style>
