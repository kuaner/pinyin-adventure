<script lang="ts">
  /* 注音通用组件：'<Ruby text="答对啦，你真棒" />' —— 传纯文本自动注音；
     多音字逃生口：'<Ruby text="长得长" py={{ '长得': 'zhǎng de' }} />' */
  import { T } from '../lib/ruby'
  let { text, py }: { text: string; py?: Record<string, string> } = $props()
</script>

{@html T(text, py)}
