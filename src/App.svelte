<script lang="ts">
  /* v2.4 App 壳：底部 tab ×3（学习/练习/我的）常驻组件 + 全屏专注态视图（tab 隐藏）。
     模块入口页（v2.3 首页桌面网格）作废。视图切换零动画音效（声音礼仪 R1） */
  import { onMount } from 'svelte'
  import { ui, show, openLesson, TAB_VIEWS } from './stores/ui.svelte'
  import { QZ } from './stores/session.svelte'
  import { initApp } from './lib/probe'
  import UpdatePrompt from './components/UpdatePrompt.svelte'
  import TabBar from './components/TabBar.svelte'
  import LearnTab from './components/home/LearnTab.svelte'
  import GameIsland from './components/games/GameIsland.svelte'
  import MineTab from './components/home/MineTab.svelte'
  import LevelMap from './components/LevelMap.svelte'
  import QuizPage from './components/QuizPage.svelte'
  import ResultsPage from './components/ResultsPage.svelte'
  import Flashcards from './components/Flashcards.svelte'
  import PairsPage from './components/PairsPage.svelte'
  import PracticePage from './components/PracticePage.svelte'
  import HistoryPage from './components/HistoryPage.svelte'
  import BoltSprint from './components/BoltSprint.svelte'
  import RadioPage from './components/RadioPage.svelte'
  import SoundEtiquette from './components/parents/SoundEtiquette.svelte'
  import SettingsPage from './components/parents/SettingsPage.svelte'
  import LessonPage from './components/learn/LessonPage.svelte'
  import CardAlbum from './components/growth/CardAlbum.svelte'
  import CelebrationOverlay from './components/growth/CelebrationOverlay.svelte'
  import PairModal from './components/PairModal.svelte'
  import Feedback from './components/Feedback.svelte'
  import GameView from './components/games/GameView.svelte'
  import DailyChallenge from './components/DailyChallenge.svelte'
  import ListenDrill from './components/ListenDrill.svelte'
  import ZiHall from './components/ZiHall.svelte'
  import BlendQuiz from './components/BlendQuiz.svelte'
  import ToneQuiz from './components/ToneQuiz.svelte'

  const isTab = $derived(TAB_VIEWS.includes(ui.view))

  onMount(() => {
    initApp()
    /* ?learn=N 深链直达第 N 课（进度续学/验收截图） */
    const ln = parseInt(new URLSearchParams(location.search).get('learn') || '', 10)
    if (ln > 0 && ln <= 12) openLesson(ln)
  })
</script>

<div id="wrap" class:focus={!isTab}>
  <!-- v2.5 设计基因：动森 Modal 的有机异形裁切（animal-island-ui Modal.tsx ClipDef 原样移植，MIT）。
       任何 .blob 元素 clip-path:url(#animal-modal-clip) 即得 blob 外框 -->
  <svg style="position:absolute;width:0;height:0" aria-hidden="true">
    <defs>
      <clipPath id="animal-modal-clip" clipPathUnits="objectBoundingBox">
        <path d="M0.501,0.005 L0.501,0.005 L0.523,0.005 L0.549,0.006 C0.704,0.01,0.796,0.017,0.825,0.027 L0.827,0.028 C0.872,0.045,0.939,0.044,0.978,0.17 C1,0.254,1,0.365,0.99,0.505 L0.988,0.513 C0.979,0.558,0.971,0.598,0.965,0.633 C0.956,0.689,0.979,0.77,0.964,0.865 C0.953,0.928,0.921,0.966,0.869,0.979 C0.821,0.986,0.773,0.992,0.726,0.995 L0.712,0.996 L0.694,0.997 C0.648,1,0.586,1,0.507,1 L0.501,1 L0.464,1 C0.385,1,0.325,0.998,0.283,0.995 C0.234,0.992,0.184,0.987,0.133,0.979 C0.081,0.966,0.05,0.928,0.039,0.865 C0.023,0.77,0.047,0.689,0.037,0.633 C0.031,0.595,0.023,0.552,0.013,0.505 C-0.006,0.365,-0.002,0.254,0.024,0.17 C0.064,0.045,0.13,0.045,0.174,0.028 L0.175,0.028 C0.204,0.017,0.303,0.009,0.474,0.005 L0.501,0.005" />
      </clipPath>
    </defs>
  </svg>
  <div id="shell">
    {#if isTab}
      <!-- BUGS#24 架构根治：三 tab 屏容器硬锁（height=视口-tabbar + overflow:hidden），tab 屏纵向滚动在容器级不可能 -->
      <div id="tab-view-root">
        {#if ui.view === 'learn'}
          <LearnTab />
        {:else if ui.view === 'practice'}
          <GameIsland />
        {:else if ui.view === 'mine'}
          <MineTab />
        {/if}
      </div>
    {:else if ui.view === 'lesson'}
      <LessonPage n={ui.lessonN} li0={ui.lessonLi} onexit={() => show('learn')} />
    {:else if ui.view === 'levels'}
      <LevelMap />
    {:else if ui.view === 'quiz'}
      <QuizPage />
    {:else if ui.view === 'result'}
      <ResultsPage />
    {:else if ui.view === 'flash'}
      <Flashcards />
    {:else if ui.view === 'pairs'}
      <PairsPage />
    {:else if ui.view === 'free'}
      <PracticePage />
    {:else if ui.view === 'history'}
      <HistoryPage />
    {:else if ui.view === 'bolt'}
      <BoltSprint />
    {:else if ui.view === 'radio'}
      <RadioPage />
    {:else if ui.view === 'sound'}
      <SoundEtiquette />
    {:else if ui.view === 'settings'}
      <SettingsPage />
    {:else if ui.view === 'album'}
      <CardAlbum />
    {:else if ui.view === 'game'}
      <GameView />
    {:else if ui.view === 'daily'}
      <DailyChallenge />
    {:else if ui.view === 'listendrill'}
      <ListenDrill />
    {:else if ui.view === 'zihall'}
      <ZiHall />
    {:else if ui.view === 'blendquiz'}
      <BlendQuiz />
    {:else if ui.view === 'tonequiz'}
      <ToneQuiz />
    {/if}
  </div>

  {#if isTab}
    <TabBar />
  {/if}
</div>

<UpdatePrompt />
<PairModal />
<!-- v3.2 庆祝仪式（z 最高，自动散场可跳过——App 级单例，触发点在 growth store） -->
<CelebrationOverlay />
{#if QZ.fb}
  <Feedback />
{/if}
{#if ui.probeOn}
  <div id="probe">{ui.probeText}</div>
{/if}
<div id="toast" class:on={ui.toastOn}>{@html ui.toastMsg}</div>
