<script lang="ts">
  /* naive-icons 手绘图标（48×48 MIT 内联，src/lib/icons.ts）。
     <Icon name="trophy" size={28} />；flip="y" 纵向翻转（thumbs-down 复用 thumbs-up）。 */
  import { ICONS } from '../lib/icons'
  let {
    name, size = 24, flip, label
  }: { name: string; size?: number; flip?: 'y'; label?: string } = $props()
  const ic = $derived(ICONS[name])
</script>

{#if ic}
  <svg
    viewBox="0 0 48 48" width={size} height={size}
    fill="none" stroke="#2A2A2A" stroke-width={ic.w}
    stroke-linecap="round" stroke-linejoin="round"
    role={label ? 'img' : 'presentation'} aria-label={label}
    style={flip === 'y' ? 'transform:scaleY(-1)' : undefined}
  >{@html ic.s}</svg>
{/if}
