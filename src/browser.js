const os = require('os')
const { sleep } = require('./helpers')

let browser
const freemem = os.freemem() / (1024 * 1024 * 1024)
const MAX_BROWSER_CONTEXTS = Math.floor(freemem * 4)
let activeContexts = 0

const runBrowser = async () => {
  try {
    const { chromium } = require('playwright-core')

    // try install browser to make update easier for existing users. Safe to remove in 2 weeks.
    if (!process.env.IS_DOCKER) {
      try {
        let cli = require('playwright-core/lib/utils/registry')
        let executables = [cli.registry.findExecutable('chromium')]
        await cli.registry.installDeps(executables, false)
        await cli.registry.install(executables)
        executables.length = 0
        executables = null
        cli = null
      } catch {
        console.log('Failed to install browser or deps')
      }
    }

    browser = await chromium.launch()
    console.log('Max browser contexts', MAX_BROWSER_CONTEXTS)
  } catch {
    console.log('WARN: Unable to use real browser to overcome protection.')
    browser = null
  }
}

const pw = async (baseURL) => {
  if (!browser) {
    return null
  }

  while (activeContexts >= MAX_BROWSER_CONTEXTS || os.freemem() < 524288000) {
    await sleep(1000)
  }
  activeContexts++

  let context
  try {
    context = await browser.newContext({ baseURL })
    await abortBlocked(context)
    let page = await context.newPage()
    const acceptDialog = (dialog) => dialog.accept()
    page.once('dialog', acceptDialog)
    await page.goto('', { timeout: 15000 })
    await sleep(5000)
    const storageState = await page.context().storageState()
    await page.close()
    page = null
    return storageState.cookies
      .reduce((prev, { name, value }) => {
        prev.push(`${name}=${value};`)
        return prev
      }, [])
      .join(' ')
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
  /.*\.jpeg/,
  /.*\.svg/,
  /.*\.ico/,
  /.*\.json/,
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
  'https://i.ytimg.com/**',
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
