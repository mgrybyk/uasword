/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')
const { EventEmitter } = require('events')

const { sleep } = require('./helpers')
const { runner, updateMaxConcurrentRequestsPerSite } = require('./runner')
const { runBrowser } = require('./browser')

// interval between printing stats and calculating error rate
const logInterval = 60 * 1000
const urlsPoolInterval = 15 * 60 * 1000
const configUrl = 'https://raw.githubusercontent.com/mgrybyk/uasword/master/data/config.json'

const db1000n = 'db1000n_v0.7'

const statistics = {}

const main = async () => {
  await runBrowser()

  const eventEmitter = new EventEmitter()
  eventEmitter.setMaxListeners(150)

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
      statistics.activeRunners = stats.filter(({ isActive }) => isActive)
      updateMaxConcurrentRequestsPerSite(statistics.activeRunners.length)
      const totalRps = statistics.activeRunners.reduce((prev, { rps }) => prev + rps, 0)
      statistics.total = {
        totalRequests,
        totalRps,
        activeRunners: statistics.activeRunners.length,
        totalRunners: stats.length,
      }
      const tableData = []
      statistics.activeRunners
        .sort((a, b) => b.rps - a.rps)
        .forEach(({ url, total_reqs, errRate, rps }) => {
          tableData.push({ url, Requests: total_reqs, 'Errors,%': errRate, 'Req/s': rps })
        })
      if (statistics.activeRunners.length > 0) {
        console.table(tableData)
      }
      console.log(
        'Total Requests',
        totalRequests,
        '| Active runners',
        statistics.activeRunners.length,
        'of',
        stats.length,
        '| Total rps',
        totalRps,
        '\n'
      )
    }, 1000)
  }, logInterval)
}

/**
 *
 * @returns {Promise<string[]>}
 */
const getSites = async ({ ignoreError = false } = {}) => {
  const urlList = []

  // try get config
  const sitesUrls = { string: [], object: [], [db1000n]: [] }
  try {
    const res = await axios.get(configUrl)
    for (const urlConfig of res.data.urls) {
      if (
        process.env[`ENABLE_${urlConfig.name}_LISTS`] === 'true' ||
        (urlConfig.enabled && process.env[`SKIP_${urlConfig.name}_LISTS`] !== 'true')
      ) {
        sitesUrls[urlConfig.type].push(urlConfig.url)
      }
    }
  } catch (err) {
    console.log(new Date().toISOString(), 'WARN: Failed to fetch config', configUrl)
    if (!ignoreError) {
      throw err
    }
  }

  // uashield, uasword
  urlList.push(
    ...(await getSitesFn(
      sitesUrls.object,
      (d) => !Array.isArray(d) || (d.length > 0 && typeof d[0].page !== 'string'),
      (d) =>
        d.map((x) => ({
          url: x.page,
        })),
      { ignoreError }
    ))
  )

  // UA Cyber SHIELD list
  urlList.push(
    ...(await getSitesFn(
      sitesUrls.string,
      (d) => typeof d !== 'string',
      (d) =>
        d
          .split('\n')
          .filter((s) => s.startsWith('http'))
          .map((url) => ({ url })),
      { ignoreError: true }
    ))
  )

  // db1000n
  urlList.push(
    ...(await getSitesFn(
      sitesUrls[db1000n],
      (d) => !Array.isArray(d.jobs),
      (d) =>
        d.jobs
          .filter(({ type, args }) => type === 'http' && args.request.method === 'GET')
          .map(({ args }) => ({ url: args.request.path })),
      { ignoreError: true }
    ))
  )

  return [...new Set(urlList)]
}

const getSitesFn = async (sitesUrls, assertionFn, parseFn, { ignoreError = false } = {}) => {
  const urlList = []
  for (const sitesUrl of sitesUrls) {
    try {
      const res = await axios.get(sitesUrl)
      if (assertionFn(res.data)) {
        throw new Error('Unable to parse site url', sitesUrl)
      }
      urlList.push(...parseFn(res.data))
    } catch (err) {
      console.log(new Date().toISOString(), 'WARN: Failed to fetch new urls list from', sitesUrl)
      if (!ignoreError) {
        throw err
      }
    }
  }
  return urlList
}

module.exports = { main, statistics }
