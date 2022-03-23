const { sleep } = require('./helpers')
const { spawnClientInstance } = require('./client/client')
const { generateRequestHeaders } = require('./client/headers')
const { pw } = require('./browser')

// stop process is service is down within DELAY * ATTEMPTS (1 hour)
const FAILURE_DELAY = 60 * 1000
const ATTEMPTS = 15
// concurrent requests adopts based on error rate, but won't exceed the max value
let MAX_CONCURRENT_REQUESTS = 16

const UPDATE_COOKIES_INTERVAL = 10 * 60 * 1000

const ignoredErrCode = 'ECONNABORTED'

/**
 * @param {string} url
 * @param {EventEmitter} eventEmitter
 */
const runner = async ({ url, data, headersOverride, method = 'GET' } = {}, eventEmitter) => {
  if (typeof url !== 'string' || url.length < 10 || !url.startsWith('http')) {
    console.log('Invalid value for URL', url)
    return
  }
  const printUrl = url.length > 55 ? url.substring(0, 55) + '...' : url

  let concurrentReqs = 5
  console.log('Starting process for', printUrl)

  let cookies = await pw(url, headersOverride)
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
  let rps = 0

  const getStatsFn = () => {
    eventEmitter.emit('RUNNER_STATS', { url: printUrl, total_reqs, new_reqs, errRate, rps, isActive })
    new_reqs = 0
  }
  eventEmitter.on('GET_STATS', getStatsFn)

  // update cookies every 10 minutes
  const updateCookiesFn = async () => {
    if (isActive && isRunning) {
      cookies = await pw(url, headersOverride)
    }
  }
  let updateCookiesInterval = setInterval(updateCookiesFn, UPDATE_COOKIES_INTERVAL)

  const adaptivenessInterval = 15
  const adaptIntervalFn = () => {
    if (failureAttempts === 0) {
      rps = Math.floor((lastMinuteOk + lastMinuteErr) / adaptivenessInterval)
      lastMinuteOk = 0
      lastMinuteErr = 0

      if (errRate > 40) {
        concurrentReqs = Math.floor(rps * 0.6)
      } else if (errRate > 15) {
        concurrentReqs = Math.floor(rps * 0.8)
      } else if (errRate > 5) {
        concurrentReqs = Math.floor(rps * 0.9)
      } else if (errRate < 2) {
        concurrentReqs = Math.min(Math.floor((rps + 4) * 1.05), MAX_CONCURRENT_REQUESTS)
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
    if (concurrentReqs < 3 || errRate > 95) {
      clearInterval(adaptInterval)
      clearInterval(updateCookiesInterval)
      const nextDelay = FAILURE_DELAY + failureAttempts * FAILURE_DELAY
      console.log(printUrl, 'is not reachable. Retrying in', nextDelay, 'ms...')
      failureAttempts++
      // stop process
      if (failureAttempts >= ATTEMPTS) {
        isRunning = false
      } else {
        concurrentReqs = 5
        isActive = false
        await sleep(nextDelay)
        cookies = await pw(url, headersOverride)
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
        method,
        data,
        headers: headersOverride || generateRequestHeaders(cookies),
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
          if (err.code !== ignoredErrCode) {
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
  console.log('Stopping runner for:', printUrl)
}

const updateMaxConcurrentRequestsPerSite = (activeRunners) => {
  if (activeRunners < 3) {
    MAX_CONCURRENT_REQUESTS = 256
  } else if (activeRunners < 5) {
    MAX_CONCURRENT_REQUESTS = 128
  } else {
    MAX_CONCURRENT_REQUESTS = 64
  }
}

module.exports = { runner, updateMaxConcurrentRequestsPerSite }
