<script lang="ts">
  /* 易混对专练：镜像/近音/前后鼻音/韵母四组，点对看辨析卡或整组开练 */
  import { PAIRS, GRPS, GRPNAME } from '../data'
  import { startPairGroup } from '../stores/session.svelte'
  import { show, openPair } from '../stores/ui.svelte'
  import { T } from '../lib/ruby'
</script>

<section id="v-pairs" class="view on">
  <div class="topbar">
    <button class="backbtn" data-back="home" onclick={() => show('home')}>‹</button>
    <h2><ruby>易<rt>yì</rt></ruby><ruby>混<rt>hùn</rt></ruby><ruby>对<rt>duì</rt></ruby><ruby>专<rt>zhuān</rt></ruby><ruby>练<rt>liàn</rt></ruby></h2>
  </div>
  <div id="pgroups">
    {#each GRPS as grp (grp)}
      {@const ps = PAIRS.filter((p) => p.grp === grp)}
      <div class="pgroup">
        <h3>{@html T(GRPNAME[grp])}（{ps.length}{@html T(' 组{zǔ}')})</h3>
        <div class="gdesc">{@html T('点{diǎn}一{yí}对{duì}看{kàn}「辨{biàn}析{xī}卡{kǎ}」学{xué}口{kǒu}诀{jué}，或{huò}整{zhěng}组{zǔ}开{kāi}练{liàn}')}</div>
        <div class="chips">
          {#each ps as p (p.a + '|' + p.b)}
            {@const pi = PAIRS.indexOf(p)}
            <button class="chip" data-pi={pi} type="button" onclick={() => openPair(pi)}>{p.a} ↔ {p.b}</button>
          {/each}
        </div>
        <button class="btn small purple" type="button" onclick={() => startPairGroup(grp)}>⚔️ {@html T('开{kāi}始{shǐ}专{zhuān}练{liàn}这{zhè} ')}{ps.length}{@html T(' 组{zǔ}')}</button>
      </div>
    {/each}
  </div>
</section>
