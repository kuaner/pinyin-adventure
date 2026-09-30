<script lang="ts">
  import { onMount } from 'svelte'
  import { ui, show } from './stores/ui.svelte'
  import { QZ } from './stores/session.svelte'
  import { ac } from './lib/audio'
  import { initApp } from './lib/probe'
  import UnlockLayer from './components/UnlockLayer.svelte'
  import HomePage from './components/HomePage.svelte'
  import LevelMap from './components/LevelMap.svelte'
  import QuizPage from './components/QuizPage.svelte'
  import ResultsPage from './components/ResultsPage.svelte'
  import Flashcards from './components/Flashcards.svelte'
  import PairsPage from './components/PairsPage.svelte'
  import PracticePage from './components/PracticePage.svelte'
  import HistoryPage from './components/HistoryPage.svelte'
  import BoltSprint from './components/BoltSprint.svelte'
  import LearnIsland from './components/learn/LearnIsland.svelte'
  import PairModal from './components/PairModal.svelte'
  import Feedback from './components/Feedback.svelte'

  onMount(() => {
    initApp()
    /* ?learn=N 深链直达学习岛（进度续学/验收截图） */
    if (new URLSearchParams(location.search).get('learn')) show('learn')
    /* 兜底：任意首触也尝试解锁音效（部分安卓浏览器） */
    document.addEventListener('touchstart', function once() {
      ac()
      document.removeEventListener('touchstart', once)
    }, { passive: true })
  })
</script>

<div id="wrap">
  {#if ui.view === 'home'}
    <HomePage />
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
  {:else if ui.view === 'practice'}
    <PracticePage />
  {:else if ui.view === 'history'}
    <HistoryPage />
  {:else if ui.view === 'bolt'}
    <BoltSprint />
  {:else if ui.view === 'learn'}
    <LearnIsland />
  {/if}
</div>

<UnlockLayer />
<PairModal />
{#if QZ.fb}
  <Feedback />
{/if}
{#if ui.probeOn}
  <div id="probe">{ui.probeText}</div>
{/if}
<div id="toast" class:on={ui.toastOn}>{@html ui.toastMsg}</div>
