<script lang="ts">
  /* 易混对专练：镜像/近音/前后鼻音/韵母四组，点对看辨析卡或整组开练 */
  import { PAIRS, GRPS, GRPNAME } from '../data'
  import { startPairGroup } from '../stores/session.svelte'
  import { show, openPair } from '../stores/ui.svelte'
  import { T } from '../lib/ruby'
  import Ruby from './Ruby.svelte'
  import Icon from './Icon.svelte'
</script>

<section id="v-pairs" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
    <h2><Icon name="bee" size={26} /> <Ruby text="易混对专练" /></h2>
  </div>
  <div id="pgroups">
    {#each GRPS as grp (grp)}
      {@const ps = PAIRS.filter((p) => p.grp === grp)}
      <div class="pgroup">
        <h3>{@html T(GRPNAME[grp])}（{ps.length}{@html T(' 组')})</h3>
        <div class="gdesc">{@html T('点一对看「辨析卡」学口诀，或整组开练')}</div>
        <div class="chips">
          {#each ps as p (p.a + '|' + p.b)}
            {@const pi = PAIRS.indexOf(p)}
            <button class="chip" data-pi={pi} type="button" onclick={() => openPair(pi)}>{p.a} ↔ {p.b}</button>
          {/each}
        </div>
        <button class="btn small purple" type="button" onclick={() => startPairGroup(grp)}>⚔️ {@html T('开始专练这 ')}{ps.length}{@html T(' 组')}</button>
      </div>
    {/each}
  </div>
</section>
