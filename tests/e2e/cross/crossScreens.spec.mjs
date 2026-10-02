/* 横切面参数化（T3）：遍历 screens.ts 清单，逐屏断言四个横切关注点——
   ① 关键断言（ready 选择器在=屏幕活着）② 零纵向滚动（doc + tab 屏容器级）+零横向溢出
   ③ nowrap（短标签单行）④ ruby 注音（儿童屏 rt 下限，家长屏豁免）⑤ 零 pageerror。
   断言只住本 spec；屏幕定义只住 screens.ts——新屏登记即被本面自动覆盖。
   独立可跑：node tests/e2e/cross/crossScreens.spec.mjs */
import { BootApp } from '../flows/bootApp.mjs'
import { SCREENS, NOWRAP_SELECTORS } from '../screens.ts'
import { Tally } from '../flows/assert.mjs'

const t = new Tally('横切面（screens 清单 × 零滚动/零pageerror/nowrap/ruby）')
const app = new BootApp()
const BASE = process.env.BASE_URL || 'http://localhost:4173'

for (const def of SCREENS) {
  const tag = def.id
  const errs = []
  let page = null
  try {
    page = await app.newPage({ tier: def.seed })
    page.on('pageerror', (e) => errs.push(e.message))
    await page.goto(BASE + def.url, { waitUntil: 'networkidle' })
    await page.waitForSelector(def.ready, { timeout: 12000 })
    t.ok(true, `${tag} 关键断言（${def.name}）ready=${def.ready}`)

    /* 横切：零纵向滚动（doc 恒 0；tab 屏加容器级）+ 零横向溢出 */
    const scroll = await page.evaluate(() => ({
      doc: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      tabRoot: (() => { const r = document.getElementById('tab-view-root'); return r ? r.scrollHeight - r.clientHeight : null })(),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    t.ok(scroll.doc === 0, `${tag} 零纵向滚动（doc）`, `doc=${scroll.doc}`)
    if (def.tab) t.ok(scroll.tabRoot !== null && scroll.tabRoot <= 1, `${tag} 零纵向滚动（tab 容器级）`, `root=${scroll.tabRoot}`)
    t.ok(scroll.overflowX <= 0, `${tag} 零横向溢出（nowrap 破版面）`, `x=${scroll.overflowX}`)

    /* 横切：nowrap 立法面——短标签单行（高度 ≤ 2.2×字号+6 宽限；含 rt 注音元素豁免——
       ruby 汉字+拼音双行是注音立法的合法形态， nowrap 禁的是"无注音短标签折行"） */
    const wrap = await page.evaluate((sels) => {
      const bad = []
      for (const sel of sels) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect()
          if (r.width === 0) continue
          if (el.querySelector('rt')) continue
          const fs = parseFloat(getComputedStyle(el).fontSize) || 16
          if (r.height > fs * 2.2 + 6) bad.push(`${sel}:${(el.textContent || '').trim().slice(0, 8)}@${Math.round(r.height)}px`)
        }
      }
      return bad
    }, NOWRAP_SELECTORS)
    t.ok(wrap.length === 0, `${tag} 短标签单行（nowrap 立法面）`, wrap.slice(0, 3).join(','))

    /* 横切：ruby 注音（儿童屏 rt ≥ rubyMin；家长向屏=0 豁免） */
    if (def.rubyMin > 0) {
      const rootSel = def.ready.split(' ')[0]
      const rt = await page.evaluate((s) => document.querySelectorAll(`${s} rt`).length, rootSel)
      t.ok(rt >= def.rubyMin, `${tag} 儿童注音在场（rt ≥ ${def.rubyMin}）`, `rt=${rt}`)
    } else {
      t.ok(true, `${tag} 家长向屏注音豁免`)
    }

    t.ok(errs.length === 0, `${tag} 零 pageerror`, (errs[0] || '').slice(0, 120))
  } catch (e) {
    t.ok(false, `${tag} 横切面执行失败`, e.message.slice(0, 140))
  }
  if (page) await app.closePage(page)
}

await app.close()
process.exit(t.finish())
