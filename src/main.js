/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')
const { EventEmitter } = require('events')

const { sleep } = require('./helpers')
const { runner } = require('./runner')
const { runnerDns, setMaxDnsReqs } = require('./runner-dns')
const { runBrowser } = require('./browser')

// interval between printing stats and calculating error rate
const logInterval = 60 * 1000
const urlsPoolInterval = 15 * 60 * 1000
const configUrl = 'https://raw.githubusercontent.com/mgrybyk/uasword/master/data/config.json'

const maxConcurrentUdpRequests = 800

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
 * @param {Array<{method:'get'|'dns';}>} urlList
 */
const run = async (eventEmitter, urlList) => {
  const dnsRunners = urlList.filter((x) => x.method === 'dns').length || 1
  setMaxDnsReqs(Math.floor(maxConcurrentUdpRequests / dnsRunners))

  for (let i = 0; i < urlList.length; i++) {
    await sleep(1000)
    if (urlList[i].method === 'get') {
      runner(urlList[i], eventEmitter)
    } else if (urlList[i].method === 'dns') {
      runnerDns(urlList[i], eventEmitter)
    } else {
      console.log('skipping runner', urlList[i])
    }
  }
}

/**
 * @param {EventEmitter} eventEmitter
 */
const statsLogger = (eventEmitter) => {
  let stats = []
  let totalDnsRequests = 0
  let totalHttpRequests = 0

  eventEmitter.on('RUNNER_STATS', (s) => {
    stats.push(s)
    if (s.type === 'http') {
      totalHttpRequests += s.new_reqs
    } else if (s.type === 'dns') {
      totalDnsRequests += s.new_reqs
    }
  })

  setInterval(() => {
    stats.length = 0
    eventEmitter.emit('GET_STATS')
    setTimeout(() => {
      statistics.activeRunners = stats.filter(({ isActive, rps }) => isActive && rps > 0)
      statistics.slowRunners = stats.filter(({ isActive, rps }) => isActive && rps === 0)

      const totalHttpRps = statistics.activeRunners
        .filter(({ type }) => type === 'http')
        .reduce((prev, { rps }) => prev + rps, 0)
      const totalDnsRps = statistics.activeRunners
        .filter(({ type }) => type === 'dns')
        .reduce((prev, { rps }) => prev + rps, 0)

      statistics.total = {
        totalHttpRequests,
        totalDnsRequests,
        totalHttpRps,
        totalDnsRps,
        activeRunners: statistics.activeRunners.length,
        slowRunners: statistics.slowRunners.length,
        totalRunners: stats.length,
      }

      if (statistics.activeRunners.length > 0) {
        const tableData = []
        statistics.activeRunners.sort((a, b) => b.rps - a.rps)

        statistics.activeRunners
          .filter(({ type }) => type === 'http')
          .forEach(({ url, ip, total_reqs, errRate, rps }) => {
            tableData.push({ ip: ip || '-', url, Requests: total_reqs, 'Errors,%': errRate, 'Req/s': rps })
          })

        statistics.activeRunners
          .filter(({ type }) => type === 'dns')
          .forEach(({ host, port, total_reqs, errRate, rps }) => {
            tableData.push({
              ip: `${host}:${port}`,
              url: 'N/A',
              Requests: total_reqs,
              'Errors,%': errRate,
              'Req/s': rps,
            })
          })

        console.table(tableData)
      }

      console.log(
        `http reqs: ${totalHttpRequests}, rps: ${totalHttpRps}`,
        '|',
        `dns reqs: ${totalDnsRequests}, rps: ${totalDnsRps}`,
        '| Runners (active/slow/total)',
        `${statistics.total.activeRunners}/${statistics.total.slowRunners}/${statistics.total.totalRunners}`,
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
      (d) => !Array.isArray(d) || (d.length > 0 && typeof d[0] !== 'object'),
      (d) => d.filter((x) => x.method === 'get' || x.method === 'dns'),
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
          .map((page) => ({ page, method: 'get' })),
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
          .map(({ args }) => ({
            method: 'get',
            page: args.request.path,
            ip: args.client?.static_host?.addr.split(':')[0],
          })),
      { ignoreError: true }
    ))
  )

  return urlList
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
