/** Prove the mounted history auto-load contract: script writes never load, one drag loads once, the loader row keeps a fixed box. */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { packBundle } from './packed-profile.mjs'
import { completeSmoke, recordSmokeFailure } from './negative-control.mjs'
import {
  createMobileProfile, launchDsh, removeTemporaryRoot, openPairing,
  pairMobilePage, dismissOnboarding, CLIENT_TIMEOUT_MS, sanitized,
} from './mobile-boot-fixture.mjs'

const repository = fileURLToPath(new URL('..', import.meta.url))
const mobileRoot = process.env.DSH_BOOT_SMOKE_MOBILE_ROOT === undefined ? repository : resolve(process.env.DSH_BOOT_SMOKE_MOBILE_ROOT)
const dshBin = process.env.DSH_BOOT_SMOKE_BIN ?? fileURLToPath(new URL('../node_modules/@deepseek-ai/dsh/lib/bin.js', import.meta.url))
const prefix = 'dsh-mobile-history-smoke-'
const root = await mkdtemp(join(tmpdir(), prefix))
let dsh
let browser
let failure

async function rpc(page, method, request) {
  const response = await page.evaluate(async ({ method, request }) => {
    const result = await fetch(`/api/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'history-smoke', method, payload: { args: { request } } }),
      signal: AbortSignal.timeout(60000),
    })
    return { status: result.status, body: await result.json() }
  }, { method, request })
  assert.equal(response.status, 200, `${method} HTTP failure`)
  assert.equal(response.body.result?.ok, true, `${method} RPC failure`)
  return response.body.result.value
}

const settleFrames = page => page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))))

try {
  const workspacePath = join(root, 'workspace')
  await mkdir(workspacePath)
  const tarball = await packBundle(mobileRoot, root)
  const home = await createMobileProfile(root, { tarball, dshBin })
  dsh = launchDsh(root, home, dshBin)
  browser = await chromium.launch({ headless: true })
  const desktop = await browser.newPage({ locale: 'en-US' })
  const pairUrl = await openPairing(desktop, await dsh.ready(), dsh.logs)
  const workspace = await rpc(desktop, 'workspace/create', { path: workspacePath })
  assert.equal(typeof workspace.workspace?.workspaceId, 'string')
  const phone = await browser.newPage({ viewport: { width: 375, height: 812 }, locale: 'en-US', isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  await pairMobilePage(phone, pairUrl, dsh.logs)
  await dismissOnboarding(phone)
  const drawer = phone.locator('.dshm-drawer')
  await drawer.locator('button[data-dsh-mobile-toggle]').click()
  const workspaceRow = drawer.locator(`[role="treeitem"][data-row-key="workspace:${workspace.workspace.workspaceId}"]`)
  const created = phone.waitForResponse(response => {
    if (new URL(response.url()).pathname !== '/api/session/create') return false
    return response.request().postDataJSON()?.payload?.args?.request?.workspaceId === workspace.workspace.workspaceId
  }, { timeout: CLIENT_TIMEOUT_MS })
  try { await workspaceRow.getByRole('button').last().click() } catch (error) { void created.catch(() => {}); throw error }
  assert.equal((await (await created).json()).result?.ok, true)
  await phone.locator('[data-conversation-scroll]').waitFor({ state: 'visible', timeout: CLIENT_TIMEOUT_MS })
  if (await drawer.getAttribute('data-open') === 'true') await drawer.locator('button[data-dsh-mobile-toggle]').click()
  // Inert content provides the scroll range; the injected row mimics DSH's own loader
  // (`*_older` class + real button, hasMore stays enabled). Neither fabricates a
  // model request or a Session event, and no second scroller is introduced.
  const injected = await phone.evaluate(() => {
    const scroller = document.querySelector('[data-conversation-scroll]')
    if (scroller === null) return undefined
    const content = document.createElement('div')
    content.dataset.scrollFixture = 'true'
    content.style.cssText = 'height:2400px;flex:none;pointer-events:none'
    scroller.prepend(content)
    const row = document.createElement('div')
    row.className = 'dshm_history_smoke_older'
    // The scroller is a column flex container; an unpinned raw row would be
    // shrink-crushed to 0px by the overflowing fixture content, so pin it like
    // the inert content below and let the plugin's fixed box own the height.
    row.style.cssText = 'flex:none'
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Load earlier'
    row.append(button)
    scroller.prepend(row)
    window.__historySmoke = { clicks: 0 }
    // The click spy lands before any gesture so every auto-load is counted.
    button.addEventListener('click', () => { window.__historySmoke.clicks += 1 }, { capture: true })
    return { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight }
  })
  assert(injected !== undefined, 'conversation scroller missing after session open')
  assert(injected.scrollHeight > injected.clientHeight + 500, `fixture gave no bounded scroll range: ${JSON.stringify(injected)}`)
  // dsh-mobile's sync() must auto-tag the injected row exactly like DSH's own loader.
  await phone.waitForFunction(() => document.querySelector('[data-dsh-mobile-history-loader]') !== null, undefined, { timeout: CLIENT_TIMEOUT_MS })
  await settleFrames(phone)
  const readClicks = () => phone.evaluate(() => window.__historySmoke.clicks)
  const setScrollTop = top => phone.locator('[data-conversation-scroll]').evaluate((element, value) => { element.scrollTop = value }, top)

  // Rule 1 — no fresh input: programmatic scrollTop writes alone must produce zero clicks.
  await setScrollTop(200)
  await settleFrames(phone)
  await setScrollTop(50)
  await settleFrames(phone)
  const noInputClicks = await readClicks()
  assert.equal(noInputClicks, 0, 'rule 1 (no-input): programmatic scrollTop 200→50 clicked the loader')

  // Rule 2 — one CDP drag buys exactly one click, and the load commit's writes cannot chain it.
  await setScrollTop(320)
  await settleFrames(phone)
  assert.equal(await readClicks(), 0, 'rule 2 (single-load): the pre-drag reset write clicked the loader')
  const geometry = await phone.evaluate(() => {
    const scroller = document.querySelector('[data-conversation-scroll]')
    const rect = scroller.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  const session = await phone.context().newCDPSession(phone)
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  const touchX = Math.round(geometry.x + geometry.width / 2)
  const touchY = Math.round(geometry.y + Math.min(geometry.height - 80, 160))
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY, id: 1 }] })
  // A monotone downward drag pulls older history into view, crossing the 64px zone.
  // Every touchmove is fresh user input and legitimately re-arms the gate, so — as with
  // a real fling — the finger lifts once the load fires; only script-driven or momentum
  // scroll events follow the lift, and those must never chain a second click.
  let dragged = 0
  while (dragged < 16 && await readClicks() === 0) {
    dragged += 1
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX, y: touchY + dragged * 30, id: 1 }] })
    await settleFrames(phone)
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await settleFrames(phone)
  try {
    await phone.waitForFunction(() => window.__historySmoke.clicks === 1, undefined, { timeout: 5000 })
  } catch (error) {
    const observed = await phone.evaluate(({ x, y, width }) => {
      const scroller = document.querySelector('[data-conversation-scroll]')
      const point = document.elementFromPoint(x + width / 2, y + 100)
      return { clicks: window.__historySmoke.clicks, scrollTop: scroller.scrollTop,
        hit: point === null ? null : `${point.tagName}.${point.className}`,
        hitInScroller: point !== null && scroller.contains(point) }
    }, geometry)
    throw new Error(`rule 2 (single-load): drag did not load exactly once: ${JSON.stringify(observed)}`, { cause: error })
  }
  await settleFrames(phone)
  assert.equal(await readClicks(), 1, 'rule 2 (single-load): the drag clicked the loader more than once')
  // Simulated load commit: DSH disables the button, prepends the loaded page,
  // restores the viewport with a compensation write and re-enables (hasMore=true).
  const committed = await phone.evaluate(() => {
    const scroller = document.querySelector('[data-conversation-scroll]')
    const row = document.querySelector('[data-dsh-mobile-history-loader]')
    const button = row.querySelector('button')
    const before = scroller.scrollTop
    button.disabled = true
    const page = document.createElement('div')
    page.dataset.scrollFixture = 'true'
    page.style.cssText = 'height:600px;flex:none;pointer-events:none'
    row.after(page)
    scroller.scrollTop += 600
    button.disabled = false
    return { before, after: scroller.scrollTop, clicks: window.__historySmoke.clicks }
  })
  await settleFrames(phone)
  assert.equal(await readClicks(), 1, `rule 2 (no chain): the load commit produced extra clicks: ${JSON.stringify(committed)}`)

  // Rule 3 — the loader row is a fixed box in both button states at default and 24px root font.
  const loaderBox = await phone.evaluate(() => {
    const row = document.querySelector('[data-dsh-mobile-history-loader]')
    const button = row.querySelector('button')
    const samples = []
    const measure = label => { void row.offsetHeight; samples.push({ label, offsetHeight: row.offsetHeight }) }
    for (const font of ['', '24px']) {
      document.documentElement.style.fontSize = font
      const scale = font === '' ? 'default' : font
      button.disabled = false
      measure(`enabled@${scale}`)
      button.disabled = true
      measure(`disabled@${scale}`)
      button.disabled = false
      measure(`re-enabled@${scale}`)
    }
    document.documentElement.style.fontSize = ''
    button.disabled = false
    return samples
  })
  const heights = loaderBox.map(sample => sample.offsetHeight)
  const variance = Math.max(...heights) - Math.min(...heights)
  assert(variance <= 1, `rule 3 (fixed box): loader row height varies by ${variance}px across states: ${JSON.stringify(loaderBox)}`)
  for (const sample of loaderBox) {
    assert(sample.offsetHeight >= 27 && sample.offsetHeight <= 29,
      `rule 3 (fixed box): loader row is not the pinned 28px box in ${sample.label}: ${JSON.stringify(loaderBox)}`)
  }
  assert.equal(await phone.locator('[data-scroll-fixture]').count(), 2, 'fixture content blocks changed')
  const summary = { noInputClicks, dragClicks: await readClicks(), committed, loaderBox }
  console.log('Packed DSH history scroll stability smoke passed: programmatic writes made 0 clicks, one drag made exactly 1 unchained click, loader row box variance <= 1px.')
  console.log(JSON.stringify(summary))
} catch (error) {
  failure = new Error(`${sanitized(error instanceof Error ? error.stack ?? error.message : String(error))}\n${dsh?.logs() ?? ''}`)
} finally {
  const failures = failure === undefined ? [] : [failure]
  if (browser !== undefined) await browser.close().catch(error => { recordSmokeFailure(failures, error) })
  if (dsh !== undefined) {
    try {
      const stopped = await dsh.close()
      if (stopped.forced || (stopped.code !== 0 && stopped.signal !== 'SIGTERM')) {
        throw new Error(`History scroll DSH fixture did not stop quiescently: ${sanitized(JSON.stringify(stopped))}`)
      }
    } catch (error) { recordSmokeFailure(failures, error) }
  }
  await removeTemporaryRoot(root, prefix).catch(error => { recordSmokeFailure(failures, error) })
  completeSmoke(failures)
}
