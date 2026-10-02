/* bootApp flow：浏览器/页面工厂——导航操作只写一次的地方（T3 终态结构）。
   职责：launch chromium、按 fixtures 种子开页（seedState）、注入验收观察者（__AUDIO_LOG/__DOM_LOG/__TLOG）、
   收集 pageerror、按 screens.ts 注册表 gotoScreen。specs 只调这里，不自己 spawn 浏览器。 */
import { chromium } from 'playwright'
import { seedState } from './seedState.mjs'
import { SCREENS } from '../screens.ts'

const BASE = () => process.env.BASE_URL || 'http://localhost:4173'

/* 验收观察者（时序断言证据源，v41/v43/v431 三脚本的观察器并集收口为一处）：
   __AUDIO_LOG  [{name, t}]     每次播音事件（audio.ts markAudio 写入）
   __DOM_LOG    [{kind, t, …}]  游戏实体出现/探头（balloon/mole-up/fishwrap/tnote/hhalf/qwrap）
   __TLOG       [{t, target}]   40ms 采样目标时间线（盲点策略断言用） */
export const OBSERVERS = `window.__AUDIO_LOG = [];
window.__DOM_LOG = [];
window.__TLOG = [];
setInterval(function () {
  try {
    var p = document.querySelector('[data-prompt]');
    var t = p && p.getAttribute('data-target');
    if (t) window.__TLOG.push({ t: performance.now(), target: t });
  } catch (e) { }
}, 40);
function __setupObserver() {
  try {
    const mo = new MutationObserver((muts) => {
      const now = performance.now();
      for (const m of muts) {
        if (m.type === 'childList') {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            const probe = (cls, kind, attrs) => {
              const el = n.classList && n.classList.contains(cls) ? n : n.querySelector ? n.querySelector('.' + cls) : null;
              if (el) {
                const e = { kind, t: now };
                for (const a of attrs) e[a] = el.getAttribute('data-' + a);
                window.__DOM_LOG.push(e);
              }
            };
            probe('balloon', 'balloon', ['bid', 'letter']);
            probe('fishwrap', 'fish', ['fid', 'letter']);
            probe('tnote', 'tnote', ['tone', 'file']);
            probe('hhalf', 'hhalf', ['key']);
            if (n.classList && n.classList.contains('qwrap')) window.__DOM_LOG.push({ kind: 'qwrap', letter: n.getAttribute('data-target'), t: now });
          }
        } else if (m.type === 'attributes' && m.target.classList) {
          if (m.target.classList.contains('mole') && m.target.classList.contains('up') && !m.target.__upLogged) {
            m.target.__upLogged = 1;
            window.__DOM_LOG.push({ kind: 'mole-up', letter: m.target.getAttribute('data-letter'), t: now });
          }
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  } catch (e) { }
}
if (document.documentElement) __setupObserver();
else document.addEventListener('DOMContentLoaded', __setupObserver);`

/* 音频文件名安全名（ü→v 系，data 约定） */
export const safeName = (k) => (k === 'ü' ? 'v' : k === 'ün' ? 'vn' : k === 'üe' ? 've' : k)

export class BootApp {
  constructor() {
    this.browser = null
    this.errors = []       /* 全部页面 pageerror（ specs 收尾用 t.pageErrors(this.errors) ） */
    this.mp3 = []          /* mp3 请求 URL 计数（route 层证据） */
    this.routeMp3 = false
  }

  async launch() {
    if (!this.browser) this.browser = await chromium.launch()
    return this.browser
  }

  /* 开一页：seed 档 + 覆盖项 + 观察者开关 + 视口。
     opts: { tier, mute, learn, growth, v2, ledger, observers=true, viewport='iPhone 13', dpr=2, routeMp3=false } */
  async newPage(opts = {}) {
    await this.launch()
    const devices = (await import('playwright')).devices
    const dev = devices[opts.viewport || 'iPhone 13']
    const ctx = await this.browser.newContext({ ...dev, hasTouch: true, deviceScaleFactor: opts.dpr || 2 })
    /* specs 读完 ctx 后 closePage(ctx) 统一收（error 收集器挂 page 级） */
    const page = await ctx.newPage()
    page.on('pageerror', (e) => this.errors.push(e.message))
    if (opts.routeMp3) {
      this.routeMp3 = true
      await page.route('**/*.mp3', (r) => { this.mp3.push(r.request().url()); return r.continue() })
    }
    await seedState(page, opts.tier || 'mid', opts)
    if (opts.observers !== false) await page.addInitScript(OBSERVERS)
    page.__ctx = ctx
    return page
  }

  async closePage(page) {
    if (page.__ctx) { await page.__ctx.close().catch(() => {}) }
    else await page.close().catch(() => {})
  }

  /* 按 screens.ts 注册表导航：gotoScreen('ldrill') —— 入口路由只写 screens.ts 一处 */
  async gotoScreen(page, id, { wait = 450 } = {}) {
    const def = SCREENS.find((s) => s.id === id)
    if (!def) throw new Error('screens.ts 未登记: ' + id)
    await page.goto(BASE() + def.url, { waitUntil: 'networkidle' })
    await page.waitForSelector(def.ready, { timeout: 10000 })
    await page.waitForTimeout(wait)
    return def
  }

  async close() {
    if (this.browser) { await this.browser.close().catch(() => {}); this.browser = null }
  }
}

export const BASE_URL = BASE
