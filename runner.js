/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')

const URL = process.env.URL

// make sure to not have more than 60000 per PC, ex 60 urls, 1000 MAX_CONCURRENT_REQUESTS per each
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || 1, 10)
// stop process is service is down within DELAY * ATTEMPTS
const INTERVAL = 2

// stop process is service is down within DELAY * ATTEMPTS
const DELAY = 1 * 60 * 1000
const ATTEMPTS = 5 * 60

if (
  typeof MAX_CONCURRENT_REQUESTS !== 'number' ||
  isNaN(MAX_CONCURRENT_REQUESTS) ||
  MAX_CONCURRENT_REQUESTS < 1 ||
  MAX_CONCURRENT_REQUESTS > 9999
) {
  console.log('Invalid value for MAX_CONCURRENT_REQUESTS', MAX_CONCURRENT_REQUESTS, '\nOnly values between 1 and 9999 are allowed')
  process.exit(1)
}
if (typeof URL !== 'string' || URL.length < 10 || !URL.startsWith('http')) {
  console.log('Invalid valud for URL', URL)
  process.exit(1)
}

const runner = async () => {
  console.log(`\nStarting process for ${URL} with ${MAX_CONCURRENT_REQUESTS} max concurrent requests...\n`)

  let pending = 0
  let err = 0
  let ok = 0

  let failures = 0
  let failureAttempts = 0

  const interval = setInterval(() => {
    if (failureAttempts === 0) {
      const requests_made = err + ok + 0.1
      console.log(URL, 'Total Req', Math.floor(requests_made), '|', 'Error Rate,%', Math.floor(100 * (err / (0.1 + requests_made))))
    }
  }, 60 * 1000)

  while (true) {
    await sleep(INTERVAL)

    if (pending < MAX_CONCURRENT_REQUESTS) {
      pending++

      client
        .get('')
        .then(() => {
          ok++
          failures = 0
          failureAttempts = 0
        })
        .catch(() => {
          err++
          failures++
        })
        .finally(() => {
          pending--
        })
    }

    // pause if requests fail for all MAX_CONCURRENT_REQUESTS
    if (failures > MAX_CONCURRENT_REQUESTS) {
      console.log('WARN:', URL, 'down. Sleeping for', DELAY, 'ms')
      failureAttempts++
      await sleep(DELAY)
    }

    // stop process
    if (failureAttempts >= ATTEMPTS) {
      clearInterval(interval)
      console.log('INFO:', URL, 'is still down after', ATTEMPTS * DELAY, 'ms.', 'Terminating...')
      return
    }
  }
}

const client = axios.create({
  baseURL: URL,
  timeout: 20000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
  },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

runner()
