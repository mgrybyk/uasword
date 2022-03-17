const os = require('os')
const { sleep } = require('./helpers')

let browser
const MAX_BROWSER_CONTEXTS = os.freemem() > 4294967296 ? 20 : 10
let activeContexts = 0
let contextQueue = 0

const runBrowser = async () => {
  try {
    const { chromium } = require('@playwright/test')

    // try install browser to make update easier for existing users. Safe to remove in 2 weeks.
    try {
      const cli = require('playwright-core/lib/utils/registry')
      const executables = [cli.registry.findExecutable('chromium')]
      await cli.registry.installDeps(executables, false)
      await cli.registry.install(executables)
    } catch {
      console.log('Failed to install browser or deps')
    }

    browser = await chromium.launch()
  } catch {
    console.log('WARN: Unable to use real browser to overcome antiddos protection.')
    browser = null
  }
}

const pw = async (baseURL) => {
  if (!browser) {
    return null
  }

  console.log('browser contexts queue', contextQueue, 'active', activeContexts, 'of', MAX_BROWSER_CONTEXTS)
  contextQueue++
  while (activeContexts >= MAX_BROWSER_CONTEXTS) {
    await sleep(500)
  }
  activeContexts++
  contextQueue--

  let context
  try {
    context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    await page.goto('')
    await sleep(10000)
    const storageState = await page.context().storageState()
    const cookies = storageState.cookies.reduce((prev, { name, value }) => {
      prev.push(`${name}=${value};`)
      return prev
    }, [])
    return cookies.join(' ')
  } catch {
    return null
  } finally {
    if (context) {
      await context.close()
    }
    activeContexts--
  }
}

module.exports = { runBrowser, pw }
