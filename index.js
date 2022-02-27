/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')

if (process.argv.length !== 4) {
  console.log('Only 2 args are allowed: URL and THREADS')
  process.exit(1)
}

const URL = process.argv[2]
if (typeof URL !== 'string' || URL.length < 10 || !URL.startsWith('http')) {
  console.log('Invalid valud for URL', URL)
  process.exit(1)
}
const THREADS = parseInt(process.argv[3] || 1, 10)
if (typeof THREADS !== 'number' || isNaN(THREADS) || THREADS < 1 || THREADS > 9999) {
  console.log('Invalid value for THREADS', THREADS, '\nOnly values between 1 and 6000 are allowed')
  process.exit(1)
}
// interval between reqests
const INTERVAL = 2

// stop process is service is down within DELAY * ATTEMPTS
const DELAY = 1 * 60 * 1000
const ATTEMPTS = 5 * 60

const INFO_INTERVAL = 60 * 1000 // 1 minute

const runner = async () => {
  console.log(`\nStarting process for ${URL} in ${THREADS} threads...\n`)

  let pending = 0
  let err = 0
  let ok = 0

  let failures = 0
  let failureAttempts = 0

  const interval = setInterval(() => {
    if (failureAttempts === 0) {
      const requests_made = err + ok + 0.1
      console.log('Total Req', Math.floor(requests_made), '|', 'Error Rate,%', Math.floor(100 * (err / (0.1 + requests_made))))
    }
  }, INFO_INTERVAL)

  while (true) {
    await sleep(INTERVAL)

    if (pending < THREADS) {
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

    // pause if requests fail in all the threads
    if (failures > THREADS) {
      console.log('WARN:', URL, 'down. Sleeping for', DELAY, 'ms')
      failureAttempts++
      await sleep(DELAY)
    }

    // stop process
    if (failureAttempts >= ATTEMPTS) {
      clearInterval(interval)
      console.log('INFO:', URL, 'is still down after', ATTEMPTS * DELAY, 'ms.', 'Terminating...')
      process.exit(0)
    }
  }
}

const client = axios.create({
  baseURL: URL,
  timeout: 10000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
  },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

runner()
