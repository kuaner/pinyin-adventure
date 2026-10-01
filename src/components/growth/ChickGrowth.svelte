<script lang="ts">
  /* v3.2 小鸡成长线：五阶段 SVG（蛋宝宝→破壳小鸡→小黄鸡→大母鸡→小雄鹰），同一 172×168 坐标系
     （地面阴影 cy≈157 恒定）——跨阶段换形是同帧位换装，成长/进化动画平滑。
     cheer=跳跃欢呼（庆祝仪式用）；pop=进化亮相（弹跳登场）。 */
  let { stage = 0, cheer = false, pop = false }: { stage?: number; cheer?: boolean; pop?: boolean } = $props()
</script>

{#key stage}
<svg class="chickgrow" class:cheer class:pop viewBox="0 0 172 168" data-stage={stage} aria-hidden="true">
  <!-- 地面阴影（五阶段恒定） -->
  <ellipse cx="86" cy="157" rx="{stage === 0 ? 42 : stage === 1 ? 46 : stage === 2 ? 50 : stage === 3 ? 56 : 58}" ry="7" fill="rgba(61,52,40,.10)" />

  {#if stage === 0}
    <!-- 蛋宝宝 -->
    <path d="M86 34 C114 34 132 63 132 98 C132 132 111 152 86 152 C61 152 40 132 40 98 C40 63 58 34 86 34 Z"
      fill="#fff6e8" stroke="#e8d9bf" stroke-width="3" />
    <circle cx="66" cy="72" r="4" fill="#f0e3cb" />
    <circle cx="104" cy="58" r="3" fill="#f0e3cb" />
    <circle cx="112" cy="106" r="3.5" fill="#f0e3cb" />
    <circle cx="60" cy="116" r="3" fill="#f0e3cb" />
    <circle cx="90" cy="86" r="2.5" fill="#f0e3cb" />
    <circle cx="70" cy="94" r="4.5" fill="#4a3b32" />
    <circle cx="102" cy="94" r="4.5" fill="#4a3b32" />
    <circle cx="71.5" cy="92.5" r="1.6" fill="#fff" />
    <circle cx="103.5" cy="92.5" r="1.6" fill="#fff" />
    <circle cx="58" cy="108" r="6" fill="#ffd6c9" opacity=".8" />
    <circle cx="114" cy="108" r="6" fill="#ffd6c9" opacity=".8" />
    <path d="M80 108 Q86 114 92 108" fill="none" stroke="#4a3b32" stroke-width="2.5" stroke-linecap="round" />
  {:else if stage === 1}
    <!-- 破壳小鸡：头顶出壳，锯齿蛋壳下半 -->
    <path d="M42 106 L50 117 L58 104 L66 117 L74 104 L82 117 L90 104 L98 117 L106 104 L114 117 L122 104 L130 117 L130 106 C130 138 111 152 86 152 C61 152 42 138 42 106 Z"
      fill="#fff6e8" stroke="#e8d9bf" stroke-width="3" />
    <circle cx="86" cy="82" r="31" fill="#ffd95e" stroke="#f0b429" stroke-width="3" />
    <path d="M77 55 q-3 -11 3 -14 M86 53 q0 -12 4 -15 M95 55 q4 -10 10 -11" fill="none" stroke="#f0b429" stroke-width="4" stroke-linecap="round" />
    <circle cx="74" cy="78" r="4.5" fill="#4a3b32" />
    <circle cx="98" cy="78" r="4.5" fill="#4a3b32" />
    <circle cx="75.5" cy="76.5" r="1.6" fill="#fff" />
    <circle cx="99.5" cy="76.5" r="1.6" fill="#fff" />
    <circle cx="63" cy="90" r="5" fill="#ffb3a0" opacity=".8" />
    <circle cx="109" cy="90" r="5" fill="#ffb3a0" opacity=".8" />
    <path d="M79 88 L93 88 L86 98 Z" fill="#f5893c" />
    <path d="M79 88 h14 l-2 3.5 h-10 Z" fill="#e8772a" />
    <path d="M52 112 q6 8 14 6 M120 112 q-6 8 -14 6" fill="none" stroke="#f0b429" stroke-width="3" stroke-linecap="round" opacity=".7" />
  {:else if stage === 2}
    <!-- 小黄鸡（v2.4 吉祥物原版造型） -->
    <path d="M42 118 L30 138 L54 132 Z" fill="#f5a35c" />
    <path d="M130 118 L142 138 L118 132 Z" fill="#f5a35c" />
    <circle cx="86" cy="88" r="58" fill="#ffd95e" />
    <circle cx="86" cy="88" r="58" fill="none" stroke="#f0b429" stroke-width="3" opacity=".5" />
    <path d="M34 100 q-12 10 -6 24 q16 2 22 -12" fill="#ffd95e" stroke="#f0b429" stroke-width="3" stroke-linecap="round" />
    <circle cx="64" cy="78" r="7.5" fill="#4a3b32" />
    <circle cx="108" cy="78" r="7.5" fill="#4a3b32" />
    <circle cx="66.5" cy="75.5" r="2.6" fill="#fff" />
    <circle cx="110.5" cy="75.5" r="2.6" fill="#fff" />
    <circle cx="51" cy="98" r="7" fill="#ffb3a0" opacity=".8" />
    <circle cx="121" cy="98" r="7" fill="#ffb3a0" opacity=".8" />
    <path d="M78 94 L94 94 L86 106 Z" fill="#f5893c" />
    <path d="M78 94 h16 l-2.5 4 h-11 Z" fill="#e8772a" />
    <path d="M76 26 q-3 -13 4 -18 M86 24 q0 -14 5 -18 M96 26 q4 -11 10 -13" fill="none" stroke="#f0b429" stroke-width="4.5" stroke-linecap="round" />
  {:else if stage === 3}
    <!-- 大母鸡：红鸡冠+尾羽+翅膀+腿 -->
    <path d="M44 84 C30 74 26 60 32 46 C44 52 51 66 51 79 Z" fill="#f5b83d" />
    <path d="M42 96 C24 92 15 79 17 64 C32 69 42 80 46 91 Z" fill="#eda92c" />
    <ellipse cx="88" cy="102" rx="50" ry="46" fill="#ffd95e" stroke="#f0b429" stroke-width="3" />
    <path d="M73 58 q0 -13 8 -11 q1 -9 8 -8 q7 -1 7 8 q8 1 7 11 Z" fill="#e76f51" />
    <circle cx="73" cy="86" r="5" fill="#4a3b32" />
    <circle cx="103" cy="86" r="5" fill="#4a3b32" />
    <circle cx="74.5" cy="84.5" r="1.7" fill="#fff" />
    <circle cx="104.5" cy="84.5" r="1.7" fill="#fff" />
    <circle cx="61" cy="98" r="6" fill="#ffb3a0" opacity=".8" />
    <circle cx="115" cy="98" r="6" fill="#ffb3a0" opacity=".8" />
    <path d="M81 96 L95 96 L88 107 Z" fill="#f5893c" />
    <path d="M81 96 h14 l-2.4 3.6 h-9.2 Z" fill="#e8772a" />
    <circle cx="88" cy="112" r="4.5" fill="#e76f51" />
    <ellipse cx="94" cy="124" rx="22" ry="14" fill="#ffe89a" opacity=".75" />
    <path d="M58 104 q-9 20 7 30 q17 8 29 -6 q-21 0 -36 -24 Z" fill="#f5c84f" stroke="#eda92c" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M76 148 v8 M100 148 v8" stroke="#f5893c" stroke-width="4.5" stroke-linecap="round" />
    <path d="M70 156 h12 M94 156 h12" stroke="#f5893c" stroke-width="4" stroke-linecap="round" />
  {:else}
    <!-- 小雄鹰：展翅+钩喙+神气眉 -->
    <path d="M48 94 C26 72 20 46 32 28 C44 40 52 62 54 86 Z" fill="#b07a3f" stroke="#8f5f2c" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M124 94 C146 72 152 46 140 28 C128 40 120 62 118 86 Z" fill="#b07a3f" stroke="#8f5f2c" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M38 52 q8 8 12 22 M134 52 q-8 8 -12 22" stroke="#8f5f2c" stroke-width="2" fill="none" opacity=".5" />
    <path d="M68 138 L86 152 L104 138 L98 132 L74 132 Z" fill="#8f5f2c" />
    <ellipse cx="86" cy="106" rx="40" ry="38" fill="#a06a34" stroke="#7d5226" stroke-width="3" />
    <ellipse cx="86" cy="118" rx="24" ry="19" fill="#e8cfa4" />
    <circle cx="86" cy="70" r="27" fill="#f2e3c8" stroke="#d9c193" stroke-width="2.5" />
    <path d="M76 46 q4 -8 9 -1 q5 -7 10 0" fill="none" stroke="#d9c193" stroke-width="2.5" stroke-linecap="round" />
    <path d="M65 62 q8 -5 16 2 M107 62 q-8 -5 -16 2" stroke="#7d5226" stroke-width="3" stroke-linecap="round" fill="none" />
    <circle cx="72" cy="72" r="4.2" fill="#3d2f23" />
    <circle cx="100" cy="72" r="4.2" fill="#3d2f23" />
    <circle cx="73.4" cy="70.6" r="1.5" fill="#fff" />
    <circle cx="101.4" cy="70.6" r="1.5" fill="#fff" />
    <path d="M79 78 L93 78 L89.5 85 Q86 95 82.5 85 Z" fill="#f5a623" stroke="#d98a1f" stroke-width="2" stroke-linejoin="round" />
    <path d="M60 100 q10 8 22 8 M112 100 q-10 8 -22 8" stroke="#7d5226" stroke-width="2" fill="none" opacity=".35" />
  {/if}
</svg>
{/key}

<style>
  .chickgrow { width: 100%; height: 100%; display: block; }
  .chickgrow.cheer { animation: cg-cheer .55s ease-in-out infinite; }
  .chickgrow.pop { animation: cg-pop .6s cubic-bezier(.25,1.4,.4,1) 1; }
  svg:not(.cheer):not(.pop) { animation: cg-in .45s cubic-bezier(.25,1.3,.4,1) 1; }
  @keyframes cg-cheer {
    0%, 100% { transform: translateY(0) scale(1, 1); }
    30% { transform: translateY(-16px) scale(.96, 1.05); }
    55% { transform: translateY(0) scale(1.04, .95); }
  }
  @keyframes cg-pop {
    0% { transform: scale(.2); opacity: 0; }
    60% { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1); }
  }
  @keyframes cg-in {
    0% { transform: scale(.85); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .chickgrow.cheer, .chickgrow.pop, svg:not(.cheer):not(.pop) { animation: none; }
  }
</style>
