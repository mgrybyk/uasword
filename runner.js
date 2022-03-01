const { sleep } = require('./sleep')
const { spawnClientInstance } = require('./client')
const { ATTEMPTS, FAILURE_DELAY, REQ_DELAY, INTERVAL, MAX_CONCURRENT_REQUESTS } = require('./constants')
const { getConcurrentRequests, getUrl } = require('./args')

/**
 * @param {string} url
 * @param {number|string} cr CONCURRENT_REQUESTS
 */
const runner = async (url, cr) => {
  const URL = getUrl(url)
  let CONCURRENT_REQUESTS = getConcurrentRequests(cr)
  console.log(`Starting process for ${URL} with ${CONCURRENT_REQUESTS} max concurrent requests...`)

  const client = spawnClientInstance(URL)

  let pending = 0
  let lastMinuteOk = 0
  let lastMinuteErr = 0

  let failures = 0
  let failureAttempts = 0

  let errRate = 0
  let requests_made = 0

  const interval = setInterval(() => {
    if (failureAttempts === 0) {
      console.log(URL, '|', 'Req', requests_made, '|', 'Errors last min,%', errRate, '|', 'R', CONCURRENT_REQUESTS)

      if (errRate > 90) {
        CONCURRENT_REQUESTS = Math.floor(CONCURRENT_REQUESTS * 0.5)
      } else if (errRate > 80) {
        CONCURRENT_REQUESTS = Math.floor(CONCURRENT_REQUESTS * 0.8)
      } else if (errRate < 1) {
        CONCURRENT_REQUESTS = Math.floor(CONCURRENT_REQUESTS * 2)
      } else if (errRate < 5) {
        CONCURRENT_REQUESTS = Math.floor(CONCURRENT_REQUESTS * 1.5)
      } else if (errRate < 10) {
        CONCURRENT_REQUESTS = Math.floor(CONCURRENT_REQUESTS * 1.3)
      } else if (errRate < 20) {
        CONCURRENT_REQUESTS = Math.floor(CONCURRENT_REQUESTS * 1.2)
      } else if (errRate < 30) {
        CONCURRENT_REQUESTS = Math.floor(CONCURRENT_REQUESTS * 1.05)
      }
      if (CONCURRENT_REQUESTS > MAX_CONCURRENT_REQUESTS) {
        CONCURRENT_REQUESTS = MAX_CONCURRENT_REQUESTS
      } else if (CONCURRENT_REQUESTS < 1) {
        CONCURRENT_REQUESTS = 1
      }

      lastMinuteOk = 0
      lastMinuteErr = 0
    }
  }, INTERVAL)

  while (true) {
    await sleep(REQ_DELAY)

    if (pending < CONCURRENT_REQUESTS) {
      pending++

      client
        .get('')
        .then(() => {
          failures = 0
          failureAttempts = 0
          lastMinuteOk++
        })
        .catch(() => {
          lastMinuteErr++
          failures++
        })
        .finally(() => {
          pending--
          requests_made++
          if (lastMinuteErr > 0 || lastMinuteOk > 0) {
            errRate = Math.floor(100 * (lastMinuteErr / (lastMinuteErr + lastMinuteOk)))
          }
        })
    }

    // pause if requests fail for all CONCURRENT_REQUESTS
    if (failures > CONCURRENT_REQUESTS) {
      console.log('WARN:', URL, 'down. Sleeping for', FAILURE_DELAY, 'ms')
      failureAttempts++
      CONCURRENT_REQUESTS = Math.floor(CONCURRENT_REQUESTS * 0.25) + 1
      await sleep(FAILURE_DELAY)
    }

    // stop process
    if (failureAttempts >= ATTEMPTS) {
      clearInterval(interval)
      console.log('INFO:', URL, 'is still down after', ATTEMPTS * FAILURE_DELAY, 'ms.', 'Terminating...')
      return
    }
  }
}

module.exports = { runner }
