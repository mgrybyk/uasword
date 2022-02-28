/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')

const URL = process.env.URL

// make sure to not have more than 60000 per PC, ex 60 urls, 1000 MAX_CONCURRENT_REQUESTS per each
let MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || 1, 10)
// interval between requests. 1000 / 4 means 250 max requests per second (per worker) is allowed
const INTERVAL = 4

// stop process is service is down within DELAY * ATTEMPTS (2 hours)
const DELAY = 1 * 60 * 1000
const ATTEMPTS = 2 * 60

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
  console.log(`Starting process for ${URL} with ${MAX_CONCURRENT_REQUESTS} max concurrent requests...`)

  let pending = 0
  let err = 0

  let failures = 0
  let failureAttempts = 0

  let errRate = 0
  let requests_made = 0

  const interval = setInterval(() => {
    if (failureAttempts === 0) {
      console.log(URL, 'Total Req', requests_made, '|', 'Error Rate,%', errRate, ' | ', 'R', MAX_CONCURRENT_REQUESTS)

      if (errRate > 90) {
        MAX_CONCURRENT_REQUESTS = Math.floor(MAX_CONCURRENT_REQUESTS * 0.3) + 1
      } else if (errRate > 80) {
        MAX_CONCURRENT_REQUESTS = Math.floor(MAX_CONCURRENT_REQUESTS * 0.2) + 1
      } else if (errRate < 5) {
        MAX_CONCURRENT_REQUESTS = Math.floor(MAX_CONCURRENT_REQUESTS * 1.5) + 1
      } else if (errRate < 1) {
        MAX_CONCURRENT_REQUESTS = Math.floor(MAX_CONCURRENT_REQUESTS * 2) + 1
      } else if (errRate < 10) {
        MAX_CONCURRENT_REQUESTS = Math.floor(MAX_CONCURRENT_REQUESTS * 1.25) + 1
      } else if (errRate < 20) {
        MAX_CONCURRENT_REQUESTS = Math.floor(MAX_CONCURRENT_REQUESTS * 1.1) + 1
      }
    }
  }, 61 * 1000)

  while (true) {
    await sleep(INTERVAL)

    if (pending < MAX_CONCURRENT_REQUESTS) {
      pending++

      client
        .get('')
        .then(() => {
          failures = 0
          failureAttempts = 0
        })
        .catch(() => {
          err++
          failures++
        })
        .finally(() => {
          pending--
          requests_made++
          errRate = Math.floor(100 * (err / requests_made))
        })
    }

    // pause if requests fail for all MAX_CONCURRENT_REQUESTS
    if (failures > MAX_CONCURRENT_REQUESTS) {
      console.log('WARN:', URL, 'down. Sleeping for', DELAY, 'ms')
      failureAttempts++
      MAX_CONCURRENT_REQUESTS = Math.floor(MAX_CONCURRENT_REQUESTS * 0.5) + 1
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
    'Upgrade-Insecure-Requests': '1',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': '*',
    'Cache-Control': 'max-age=0',
    Connection: 'keep-alive',
  },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

runner()
