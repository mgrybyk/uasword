const { sleep } = require('./helpers')
const { pw, isAvailalbe, MAX_BROWSER_CONTEXTS } = require('./browser')

// stop process is service is down within DELAY * ATTEMPTS (1 hour)
const FAILURE_DELAY = 60 * 1000
const ATTEMPTS = 60

/**
 * @param {string} url
 * @param {maxConcurrency} number
 * @param {EventEmitter} eventEmitter
 */
const runner = async (url, maxConcurrency, eventEmitter) => {
  const MAX_CONCURRENT_REQUESTS = maxConcurrency || MAX_BROWSER_CONTEXTS
  if (typeof url !== 'string' || url.length < 10 || !url.startsWith('http')) {
    console.log('Invalid value for URL', url)
    return
  }
  const printUrl = url.length > 55 ? url.substring(0, 55) + '...' : url

  let concurrentReqs = 1
  console.log('Starting process for', printUrl)

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
      url: printUrl,
      total_reqs,
      new_reqs,
      errRate,
      pending,
      isActive,
    })
    new_reqs = 0
  }
  eventEmitter.on('GET_STATS', getStatsFn)

  const adaptivenessInterval = 10
  const adaptIntervalFn = () => {
    if (failureAttempts === 0) {
      lastMinuteOk = 0
      lastMinuteErr = 0

      if (errRate > 20) {
        concurrentReqs = Math.floor(concurrentReqs * 0.6)
      } else if (errRate > 10) {
        concurrentReqs = Math.floor(concurrentReqs * 0.8)
      } else if (errRate > 5) {
        concurrentReqs = Math.floor(concurrentReqs * 0.9)
      } else if (errRate < 2) {
        concurrentReqs = Math.min(concurrentReqs + 4, MAX_CONCURRENT_REQUESTS)
      }
    }
  }
  let adaptInterval = setInterval(adaptIntervalFn, adaptivenessInterval * 1000)

  const stopEventFn = () => {
    clearInterval(adaptInterval)
    isRunning = false
  }
  eventEmitter.once('RUNNER_STOP', stopEventFn)

  while (isRunning) {
    if (concurrentReqs < 1 || errRate > 90) {
      clearInterval(adaptInterval)
      console.log(printUrl, 'is not reachable. Retrying in', FAILURE_DELAY, 'ms...')
      failureAttempts++
      // stop process
      if (failureAttempts >= ATTEMPTS) {
        isRunning = false
      } else {
        concurrentReqs = 1
        isActive = false
        await sleep(FAILURE_DELAY)
        isActive = true
        lastMinuteOk = 0
        lastMinuteErr = 0
        errRate = 0
        adaptInterval = setInterval(adaptIntervalFn, adaptivenessInterval * 1000)
      }
    } else if (isAvailalbe() && pending < concurrentReqs) {
      pending++

      pw(url)
        .then(() => {
          failureAttempts = 0
          lastMinuteOk++
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
    await sleep(140)
  }

  clearInterval(adaptInterval)
  eventEmitter.off('GET_STATS', getStatsFn)
  eventEmitter.off('RUNNER_STOP', stopEventFn)
  console.log('Stopping runner for:', printUrl)
}

module.exports = { runner }
