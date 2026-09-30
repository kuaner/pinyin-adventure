<script lang="ts">
  /* 首页 = APP 桌面（v2.3 kuaner 七点反馈之③）：iOS 主屏式图标网格，分类分区，
     每个子应用=粉彩圆底大图标+名称+一句话说明。v2.3：音频自检按钮删除（无意义）。 */
  import { show } from '../stores/ui.svelte'
  import { startDet, startZi } from '../stores/session.svelte'
  import { startBolt } from '../stores/bolt.svelte'
  import { totalStars } from '../stores/progress.svelte'
  import { renderFlash } from '../stores/flash.svelte'
  import Ruby from './Ruby.svelte'
  import Icon from './Icon.svelte'

  interface AppItem {
    id: string
    icon: string
    name: string
    desc: string
    bg: string
    go: () => void
  }

  const SECTIONS: { title: string; icon: string; apps: AppItem[] }[] = [
    {
      title: '学习', icon: 'sprout',
      apps: [
        { id: 'learn', icon: 'map', name: '学习岛', desc: '零基础 12 课', bg: '#e6f7f2', go: () => show('learn') },
        { id: 'levels', icon: 'flag', name: '闯关冒险', desc: '八关大冒险', bg: '#e8f5e8', go: () => show('levels') },
        { id: 'zi', icon: 'book', name: '常见字快拼', desc: '一年级字表', bg: '#fdeee7', go: startZi },
      ],
    },
    {
      title: '练习', icon: 'dumbbell',
      apps: [
        { id: 'detect', icon: 'search', name: '正反小侦探', desc: '专治反写', bg: '#e6f9f6', go: startDet },
        { id: 'bolt', icon: 'rocket', name: '闪电刷题', desc: '5分钟冲刺', bg: '#fff0e8', go: () => startBolt(false) },
        { id: 'pairs', icon: 'bee', name: '易混对专练', desc: '专练混淆搭档', bg: '#fde4e8', go: () => show('pairs') },
        { id: 'practice', icon: 'dumbbell', name: '自由练习', desc: '想练哪里练哪里', bg: '#fff0e8', go: () => show('practice') },
      ],
    },
    {
      title: '复习', icon: 'bookmark',
      apps: [
        { id: 'flash', icon: 'bookmark', name: '闪卡复习', desc: '翻卡记得牢', bg: '#e8edff', go: () => { renderFlash(); show('flash') } },
      ],
    },
    {
      title: '家长', icon: 'file',
      apps: [
        { id: 'history', icon: 'file', name: '历史成绩', desc: '学习记录给家长看', bg: '#f5f0e0', go: () => show('history') },
      ],
    },
  ]
</script>

<section id="v-home" class="view on">
  <div class="hero-emoji"><Icon name="bird" size={64} /></div>
  <div class="appname"><Ruby text="拼音闯关大冒险" /></div>
  <div class="subtitle"><Ruby text="跟小鸡一起学拼音" /></div>
  <div class="starsline" id="homestars"><Ruby text="星星" />：{totalStars()} <Ruby text="颗" /></div>

  <div class="desktop" id="desktop">
    {#each SECTIONS as sec (sec.title)}
      <div class="dsec">
        <div class="dsec-title"><Icon name={sec.icon} size={16} /> <Ruby text={sec.title} /></div>
        <div class="dgrid">
          {#each sec.apps as app (app.id)}
            <button class="dapp" data-go={app.id} onclick={app.go}>
              <span class="dicon" style="background:{app.bg}"><Icon name={app.icon} size={34} /></span>
              <span class="dname"><Ruby text={app.name} /></span>
              <span class="ddesc"><Ruby text={app.desc} /></span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
  <div class="foot"><Ruby text="全部数据保存在本机 · 无需联网" /></div>
</section>
