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
  import PracticeTab from './components/home/PracticeTab.svelte'
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
  import PairModal from './components/PairModal.svelte'
  import Feedback from './components/Feedback.svelte'

  const isTab = $derived(TAB_VIEWS.includes(ui.view))

  onMount(() => {
    initApp()
    /* ?learn=N 深链直达第 N 课（进度续学/验收截图） */
    const ln = parseInt(new URLSearchParams(location.search).get('learn') || '', 10)
    if (ln > 0 && ln <= 12) openLesson(ln)
  })
</script>

<div id="wrap" class:focus={!isTab}>
  <div id="shell">
    {#if ui.view === 'learn'}
      <LearnTab />
    {:else if ui.view === 'practice'}
      <PracticeTab />
    {:else if ui.view === 'mine'}
      <MineTab />
    {:else if ui.view === 'lesson'}
      <LessonPage n={ui.lessonN} onexit={() => show('learn')} />
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
    {/if}
  </div>

  {#if isTab}
    <TabBar />
  {/if}
</div>

<UpdatePrompt />
<PairModal />
{#if QZ.fb}
  <Feedback />
{/if}
{#if ui.probeOn}
  <div id="probe">{ui.probeText}</div>
{/if}
<div id="toast" class:on={ui.toastOn}>{@html ui.toastMsg}</div>
