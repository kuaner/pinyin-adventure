<script lang="ts">
  /* 注音通用组件：'<Ruby text="听{tīng}一{yì}听{tīng}" />' */
  import { T } from '../lib/ruby'
  let { text }: { text: string } = $props()
</script>

{@html T(text)}
