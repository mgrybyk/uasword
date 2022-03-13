const { sleep } = require('./helpers')
const { spawnClientInstance } = require('./client')
const { generateRequestHeaders } = require('./headers')

// interval between requests. 1000 / 2 means 500 max requests per second (per worker) is allowed
const REQ_DELAY = 2
// stop process is service is down within DELAY * ATTEMPTS (2 hours)
const FAILURE_DELAY = 2 * 60 * 1000
const ATTEMPTS = 5
// concurrent requests adopts based on error rate, but won't exceed the max value
const MAX_CONCURRENT_REQUESTS = 9999

/**
 * @param {string} url
 * @param {EventEmitter} eventEmitter
 */
const runner = async (url, eventEmitter) => {
  if (typeof url !== 'string' || url.length < 10 || !url.startsWith('http')) {
    console.log('Invalid value for URL', url)
    return
  }

  let concurrentReqs = 3
  console.log('Starting process for', url)

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
    eventEmitter.emit('RUNNER_STATS', { url, total_reqs, new_reqs, errRate, rps, concurrentReqs, isActive })
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
      } else if (errRate > 20) {
        concurrentReqs = Math.floor(rps * 0.8)
      } else if (errRate > 9) {
        concurrentReqs = Math.floor(rps * 0.9)
      } else if (errRate < 2) {
        concurrentReqs = Math.min(Math.floor((rps + 2) * 1.2), MAX_CONCURRENT_REQUESTS)
      }
    }
  }
  let adaptInterval = setInterval(adaptIntervalFn, adaptivenessInterval * 1000)

  while (isRunning) {
    await sleep(REQ_DELAY)

    if (pending < concurrentReqs) {
      pending++

      client
        .get(url, {
          headers: generateRequestHeaders(),
        })
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
          errRate = Math.floor(100 * ((1 + lastMinuteErr) / (1 + lastMinuteErr + lastMinuteOk)))
        })
    } else if (concurrentReqs < 2 || errRate > 99) {
      clearInterval(adaptInterval)
      console.log(url, 'is not reachable. Retrying in', FAILURE_DELAY, 'ms...')
      failureAttempts++
      // stop process
      if (failureAttempts >= ATTEMPTS) {
        isRunning = false
      } else {
        concurrentReqs = 3
        isActive = false
        await sleep(FAILURE_DELAY)
        isActive = true
        lastMinuteOk = 0
        lastMinuteErr = 0
        errRate = 0
        adaptInterval = setInterval(adaptIntervalFn, adaptivenessInterval * 1000)
      }
    }
  }

  eventEmitter.off('GET_STATS', getStatsFn)
  console.log('Stopping runner for:', url)
}

module.exports = { runner }
