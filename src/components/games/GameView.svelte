<script lang="ts">
  /* v4.0 游戏进行态路由：按 GS.game 选择游戏舞台，共用 GameShell（倒计时/计时/连击/结算）。
     v4.3 增 🥚拼音蛋合并 / 🎵声调音乐会（6 摊位终态） */
  import { GS, GAME_DEFS } from '../../stores/game.svelte'
  import { t } from '../../text/strings'
  import GameShell from './GameShell.svelte'
  import BalloonPop from './BalloonPop.svelte'
  import MoleWhack from './MoleWhack.svelte'
  import MirrorDuel from './MirrorDuel.svelte'
  import FishCatch from './FishCatch.svelte'
  import EggMerge from './EggMerge.svelte'
  import ToneMusic from './ToneMusic.svelte'

  const def = $derived(GAME_DEFS[GS.game])
  const hint = $derived(def ? t(def.hintKey) : '')
</script>

{#if def}
  <GameShell id={def.id} {hint}>
    {#if GS.game === 'balloon'}
      <BalloonPop />
    {:else if GS.game === 'mole'}
      <MoleWhack />
    {:else if GS.game === 'duel'}
      <MirrorDuel />
    {:else if GS.game === 'fish'}
      <FishCatch />
    {:else if GS.game === 'egg'}
      <EggMerge />
    {:else if GS.game === 'tone'}
      <ToneMusic />
    {/if}
  </GameShell>
{/if}
