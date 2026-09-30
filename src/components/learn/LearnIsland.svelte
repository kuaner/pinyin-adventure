<script lang="ts">
  /* 学习岛首页：12 课进度星图（严格顺序解锁），当前课高亮 */
  import { onMount } from 'svelte'
  import lessonsData from '../../data/lessons.json'
  import { L, lessonUnlocked, quizPassed, currentLesson } from '../../stores/learn.svelte'
  import { show } from '../../stores/ui.svelte'
  import { playAudio } from '../../lib/audio'
  import Ruby from '../Ruby.svelte'
  import Icon from '../Icon.svelte'
  import LessonPage from './LessonPage.svelte'

  const LESSONS = (lessonsData as any).lessons as { n: number; title: string; label: string; icon: string }[]

  let openLesson = $state(0)   // 0 = 星图；>0 = 打开第 n 课

  const cur = $derived(currentLesson(LESSONS.length))
  const doneCount = $derived(LESSONS.filter((l) => quizPassed(l.n)).length)
  const CN = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十', 11: '十一', 12: '十二' }
  const CNL = (x: number) => CN[x] || String(x)

  /* ?learn=N 深链（进度续学 / 验收截图） */
  onMount(() => {
    const ln = parseInt(new URLSearchParams(location.search).get('learn') || '', 10)
    if (ln > 0 && ln <= LESSONS.length && lessonUnlocked(ln)) openLesson = ln
  })
</script>

{#if openLesson > 0}
  <LessonPage n={openLesson} onexit={() => (openLesson = 0)} />
{:else}
  <section id="v-learn" class="view on">
    <div class="topbar">
      <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
      <h2><Icon name="map" size={26} /> <Ruby text="学习岛" /></h2>
      <div class="scorechip"><Ruby text={"已学" + CNL(doneCount) + "课，共" + CNL(12) + "课"} /></div>
    </div>

    <div class="island-intro">
      <div class="island-emoji"><Icon name="sprout" size={40} /></div>
      <div class="island-tip"><Ruby text="一个脚印一个脚印，从零开始学拼音" /></div>
    </div>

    <div class="starmap">
      {#each LESSONS as ls (ls.n)}
        {@const unlocked = lessonUnlocked(ls.n)}
        {@const passed = quizPassed(ls.n)}
        <button
          class="cell" class:cur={unlocked && ls.n === cur && !passed} class:done={passed} class:lock={!unlocked}
          data-lesson={ls.n}
          onclick={() => { if (unlocked) { openLesson = ls.n; playAudio('go') } }}
        >
          <span class="cnum">{ls.n}</span>
          <span class="clabel">{ls.label}</span>
          {#if passed}
            <span class="cstar">{#each Array(L.stars[ls.n] || 1)}<Icon name="star" size={14} />{/each}</span>
          {:else if unlocked && ls.n === cur}
            <span class="cplay"><Icon name="play" size={16} /></span>
          {:else}
            <span class="clock"><Icon name="lock" size={14} /></span>
          {/if}
        </button>
      {/each}
    </div>

    <button class="btn green bigstart" data-lesson={cur} onclick={() => (openLesson = cur)}>
      <Icon name="play" size={26} />
      <Ruby text={(quizPassed(cur) ? '再学一遍第' : '开始学第') + CNL(cur) + '课'} />
    </button>
    <div class="island-foot"><Ruby text="每课五步 · 小测对四题解锁下一课" /></div>
  </section>
{/if}

<style>
  #v-learn { gap: 12px; }
  .island-intro { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 20px;
    padding: 10px 16px; border: 2.5px solid #eee4d3; }
  .island-emoji { font-size: 40px; line-height: 1.2; }
  .island-tip { font-size: 19px; font-weight: 800; color: #264653; line-height: 1.9; }
  .starmap { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .cell { position: relative; background: #fff; border: 2.5px solid #eee4d3; border-radius: 18px;
    min-height: 96px; padding: 8px 6px 6px; display: flex; flex-direction: column; align-items: center;
    gap: 3px; font-family: inherit; box-shadow: 0 4px 0 #eee4d3; }
  .cell:active { transform: translateY(3px); box-shadow: 0 1px 0 #eee4d3; }
  .cnum { position: absolute; top: 6px; left: 9px; font-size: 13px; font-weight: 900; color: #b7ab97; }
  .clabel { font-size: 21px; font-weight: 900; color: #264653; line-height: 1.5; margin-top: 8px; }
  .cell.done { border-color: #bfe8df; background: #e6f7f2; }
  .cell.done .clabel { color: #1f7a68; }
  .cell.cur { border-color: #E76F51; background: #fdeee7; animation: pulse 1.6s ease-in-out infinite; }
  .cell.cur .clabel { color: #c0532f; }
  .cell.lock { opacity: .55; }
  @keyframes pulse { 50% { transform: scale(1.03); } }
  .cstar { color: #E9C46A; display: flex; gap: 1px; }
  .cplay { color: #E76F51; }
  .clock { color: #b7ab97; }
  .bigstart { min-height: 74px; font-size: 24px; }
  .island-foot { font-size: 15px; font-weight: 700; color: #8a7a68; text-align: center; line-height: 2; }
</style>
