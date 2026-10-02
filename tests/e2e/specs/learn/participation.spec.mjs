/* specs/learn/participation —— 小测拦截/放行（BUGS#33 互动证据制的门槛面）：
   A. 反例：零点击纯滑动走完 → 全 chip 无 ✓ → 进小测被拦截卡拦住 → 「跳回去学」落回第一个未学字母
   B. 部分证据：读音+只点 2 个声调（<3）→ 仍无 ✓ → 拦截 → 「我还要试试」家长通道放行（不锁死）
   C. 正例已在 lessonMatrix 走查（旗齐放行自动建题）
   D. 重学：已过关课零参与直进小测不拦（自由复习）
   拦截卡细节：吉祥物/文案（中文数字）/ruby/双按钮/拦截态零滚动/无 boot 键
   迁移自：v401-accept（A/B/D 段）。断言只写本文件。 */
import { BootApp } from '../../flows/bootApp.mjs'
import { Tally } from '../../flows/assert.mjs'
import { openLesson, lessonState, swipeLeft, curScope, flagRead, flagTones, gateInfo } from '../../flows/gotoLesson.mjs'

const t = new Tally('learn/participation 小测拦截/放行（证据制门槛）')
const app = new BootApp()

/* A · 反例：零点击纯滑动 → 拦截卡 → 跳回去学 */
{
  const page = await app.newPage({ tier: 'newbie' })
  await openLesson(page, 1)
  for (let i = 0; i < 6; i++) await swipeLeft(page)   /* L1=7 页：滑完全部字母直达小测，零点击 */
  let s = await lessonState(page)
  t.ok(s.chipDone.length === 0, '纯滑动零点击 → 全部 chip 无 ✓（待学态）', `done=${JSON.stringify(s.chipDone)}`)
  t.ok(!!await page.$('[data-gate]'), '进小测步被拦截卡拦住')
  const g = await gateInfo(page)
  t.ok(g.mascot, '拦截卡吉祥物渲染（小鸡 SVG）')
  t.ok(g.msg.includes('没学完') && g.msg.includes('三'), '文案=还有 三 个拼音没学完（儿童语气+中文数字）', g.msg.trim())
  t.ok(g.ruby, '拦截卡文案带 ruby 注音')
  t.ok(g.goback.includes('跳回去学') && g.force.includes('我还要试试'), '双按钮=跳回去学 + 我还要试试', `${g.goback.trim()} / ${g.force.trim()}`)
  t.ok(g.noBoot, '拦截态不出「开始小测」boot 键')
  t.ok(s.docScroll === 0, '拦截态零纵向滚动')
  await page.locator('[data-goback]').click()
  await page.waitForTimeout(700)
  s = await lessonState(page)
  t.ok(s.transform === 0, '「跳回去学」落到第一个未学字母（a 学一学页）', `transform=${s.transform}`)
  t.ok(s.chipDone.length === 0, '跳回后 chip 仍全部待学（无 ✓）')
  await app.closePage(page)
}

/* B · 部分证据：读音+2 声调（<3）→ 仍无 ✓ → 拦截 → 我还要试试放行 */
{
  const page = await app.newPage({ tier: 'newbie' })
  await openLesson(page, 1)
  let sc = await curScope(page)
  await flagRead(page, sc)
  await swipeLeft(page)
  sc = await curScope(page)
  await flagTones(page, sc, 2)   /* 旗B 只 2 个声调（<3） */
  for (let i = 0; i < 5; i++) await swipeLeft(page)
  let s = await lessonState(page)
  t.ok(s.chipDone.length === 0, '读音+2声调（不达标）→ chip a 仍无 ✓', `done=${JSON.stringify(s.chipDone)}`)
  t.ok(!!await page.$('[data-gate]'), '证据不足进小测仍被拦')
  await page.locator('[data-forcequiz]').click()   /* 家长通道式放行 */
  await page.waitForTimeout(700)
  t.ok(!!await page.$('#v-lesson .qbody'), '「我还要试试」放行 → 小测建题答题（不锁死）')
  s = await lessonState(page)
  t.ok(s.docScroll === 0, '放行答题态零纵向滚动')
  await app.closePage(page)
}

/* D · 重学：已过关课零参与直进小测不拦 */
{
  const page = await app.newPage({ tier: 'mid' })   /* mid=L1-4 已过 */
  await openLesson(page, 1)
  await page.locator('[data-punit="quiz"]').click()   /* 零参与 chip 直跳小测 */
  await page.waitForTimeout(700)
  const s = await lessonState(page)
  t.ok(!await page.$('[data-gate]'), '已过关课重学 → 无拦截卡（自由复习）')
  t.ok(!!await page.$('#v-lesson .qbody'), '重学直进小测自动建题')
  t.ok(s.chipDone.length === 0, '重学本会话 chip 未记 ✓（证据只管拦截不管历史）', `done=${JSON.stringify(s.chipDone)}`)
  await app.closePage(page)
}

t.pageErrors(app.errors, 'participation 全程')
await app.close()
process.exit(t.finish())
