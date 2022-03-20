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
      updateMaxConcurrentRequestsPerSite(activeRunners.length)
      const totalRps = activeRunners.reduce((prev, { rps }) => prev + rps, 0)
      const tableData = []
      activeRunners
        .sort((a, b) => b.rps - a.rps)
        .forEach(({ url, total_reqs, errRate, rps }) => {
          tableData.push({ url, Requests: total_reqs, 'Current Errors,%': errRate, 'Req/s': rps })
        })
      if (activeRunners.length > 0) {
        console.table(tableData)
      }
      console.log(
        'Total Requests',
        totalRequests,
        '| Active runners',
        activeRunners.length,
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
  const sitesUrls = { string: [], object: [] }
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

  urlList.push(
    ...(await getSitesFn(
      sitesUrls.object,
      (d) => !Array.isArray(d) || (d.length > 0 && typeof d[0].page !== 'string'),
      (d) => d.map((x) => x.page),
      { ignoreError }
    ))
  )
  urlList.push(
    ...(await getSitesFn(
      sitesUrls.string,
      (d) => typeof d !== 'string',
      (d) => d.split('\n').filter((s) => s.startsWith('http')),
      { ignoreError }
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

module.exports = { main }
