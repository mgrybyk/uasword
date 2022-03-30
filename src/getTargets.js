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
 *
 * @returns {Promise<Array<{method: 'get'; page: string; ip?: string; useBrowser?:boolean} | {method: 'dns'; host: string; port: number;}>>}
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

module.exports = { siteListUpdater, getSites }
