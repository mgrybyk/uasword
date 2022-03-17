const os = require('os')
const { sleep } = require('./helpers')

let browser
const MAX_BROWSER_CONTEXTS = os.freemem() > 4294967296 ? 20 : 10
let activeContexts = 0
let contextQueue = 0

const runBrowser = async () => {
  try {
    const { chromium } = require('@playwright/test')
    browser = await chromium.launch()
  } catch {
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
