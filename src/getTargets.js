/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')

const { run } = require('./spawnRunner')

const urlsPoolInterval = 15 * 60 * 1000
const configUrl = 'https://raw.githubusercontent.com/mgrybyk/uasword/master/data/config.json'

const db1000n = 'db1000n_v0.7'

/**
 * @param {EventEmitter} eventEmitter
 * @param {Array<{method: 'get'; page: string; ip?: string; useBrowser?:boolean} | {method: 'dns'; host: string; port: number;}>} urlList
 */
const siteListUpdater = (eventEmitter, urlList) => {
  setInterval(async () => {
    const updatedUrlList = await getSites()

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
 *
 * @returns {Promise<Array<{method: 'get'; page: string; ip?: string; useBrowser?:boolean} | {method: 'dns'; host: string; port: number;}>>}
 */
const getSites = async () => {
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
  }

  // uashield, uasword
  urlList.push(
    ...(await getSitesFn(
      sitesUrls.object,
      (d) => !Array.isArray(d) || (d.length > 0 && typeof d[0] !== 'object'),
      (d) => d.filter((x) => x.method === 'get' || x.method === 'dns')
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
          .map((page) => ({ page, method: 'get' }))
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
          }))
    ))
  )

  return filterDups(urlList)
}

const getSitesFn = async (sitesUrls, assertionFn, parseFn) => {
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
    }
  }
  return urlList
}

/**
 * @param {Array<{method: 'get'; page: string; ip?: string; useBrowser?:boolean} | {method: 'dns'; host: string; port: number;}>} urlList
 */
const filterDups = (urlList) => {
  const toDelete = []
  const processed = []

  urlList.forEach((x) => {
    if (typeof x.page === 'string' && x.page.endsWith('/')) {
      x.page = x.page.slice(0, -1)
    }
  })

  urlList
    .filter((x) => x.method === 'get')
    .forEach((x) => {
      if (!processed.includes(x)) {
        const possibleDups = urlList.filter((y) => y.page === x.page)
        processed.push(...possibleDups)

        if (possibleDups.length > 1) {
          const withBrowser = possibleDups.findIndex((y) => typeof y.useBrowser === 'boolean')
          if (withBrowser > -1) {
            possibleDups.splice(withBrowser, 1)
          } else {
            const withIp = possibleDups.filter((y) => typeof y.ip !== 'undefined')
            if (withIp.length === 0) {
              possibleDups.length = possibleDups.length - 1
            } else {
              while (withIp.length > 1) {
                const possibleDup = withIp.pop()
                const ipDup = possibleDups.findIndex((y) => y === possibleDup && y.ip === possibleDup.ip)
                if (ipDup > -1) {
                  possibleDups.splice(ipDup, 1)
                }
              }
            }
          }

          toDelete.push(
            ...possibleDups.filter((y) => typeof y.useBrowser === 'undefined' && typeof y.ip === 'undefined')
          )
        }
      }
    })
  processed.length = 0

  while (toDelete.length > 0) {
    const idx = urlList.indexOf(toDelete.pop())
    urlList.splice(idx, 1)
  }

  return urlList
}

module.exports = { siteListUpdater, getSites }
