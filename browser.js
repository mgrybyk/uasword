const os = require('os')
const { sleep } = require('./helpers')

let browser
const freemem = os.freemem() / (1024 * 1024 * 1024)
const MAX_BROWSER_CONTEXTS = Math.floor(freemem * 4)
let activeContexts = 0
let contextQueue = 0

const runBrowser = async () => {
  try {
    const { chromium } = require('@playwright/test')

    // try install browser to make update easier for existing users. Safe to remove in 2 weeks.
    if (!process.env.IS_DOCKER) {
      try {
        const cli = require('playwright-core/lib/utils/registry')
        const executables = [cli.registry.findExecutable('chromium')]
        await cli.registry.installDeps(executables, false)
        await cli.registry.install(executables)
      } catch {
        console.log('Failed to install browser or deps')
      }
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
  while (activeContexts >= MAX_BROWSER_CONTEXTS || os.freemem() < 524288000) {
    await sleep(500)
  }
  activeContexts++
  contextQueue--

  let context
  try {
    context = await browser.newContext({ baseURL })
    await abortBlocked(context)
    const page = await context.newPage()
    page.on('dialog', (dialog) => dialog.accept())
    await page.goto('')
    await sleep(5000)
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

const blacklist = [
  /.*\.jpg/,
  /.*\.png/,
  /.*\.woff/,
  /.*\.woff\?.*/,
  /.*\.ttf/,
  /.*\.woff2/,
  /.*\.css/,
  /.*\.css\?.*/,
  /.*googleapis\.com\/.*/,
  /.*twitter\.com\/.*/,
  /.*\/themes\/.*/,
  /.*drupal\.js.*/,
  /.*jquery.*/,
  /.*jcaption.*/,
  /.*webform.*/,
  /.*doubleclick\.net\/.*/,
  /.*twimg\.com\/.*/,
  'https://www.youtube.com/**',
  'https://maps.google.com/**',
  'https://translate.google.com/**',
  'https://consent.cookiebot.com/**',
]

const abortBlocked = async (ctx) => {
  for (const url of blacklist) {
    await ctx.route(url, (r) => r.abort())
  }
}

module.exports = { runBrowser, pw }
