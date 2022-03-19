const { sleep } = require('./helpers')
const { pw, isAvailalbe, getActiveContexts } = require('./browser')

// stop process is service is down within DELAY * ATTEMPTS (1 hour)
const FAILURE_DELAY = 60 * 1000
const ATTEMPTS = 60

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

  console.log('Starting process for', printUrl)

  let isRunning = true
  let isActive = true
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
      activeContexts: getActiveContexts(),
      isActive,
    })
    new_reqs = 0
  }
  eventEmitter.on('GET_STATS', getStatsFn)

  const stopEventFn = () => {
    isRunning = false
  }
  eventEmitter.once('RUNNER_STOP', stopEventFn)

  while (isRunning) {
    if (errRate > 90) {
      console.log(printUrl, 'is not reachable. Retrying in', FAILURE_DELAY, 'ms...')
      failureAttempts++
      // stop process
      if (failureAttempts >= ATTEMPTS) {
        isRunning = false
      } else {
        isActive = false
        await sleep(FAILURE_DELAY)
        isActive = true
        lastMinuteOk = 0
        lastMinuteErr = 0
        errRate = 0
      }
    } else if (isAvailalbe()) {
      pw(url)
        .then(() => {
          failureAttempts = 0
          lastMinuteOk++
        })
        .catch(() => {
          lastMinuteErr++
        })
        .finally(() => {
          total_reqs++
          new_reqs++
          errRate = Math.floor(100 * (lastMinuteErr / (1 + lastMinuteErr + lastMinuteOk)))
        })
    }
    await sleep(140)
  }

  eventEmitter.off('GET_STATS', getStatsFn)
  eventEmitter.off('RUNNER_STOP', stopEventFn)
  console.log('Stopping runner for:', printUrl)
}

module.exports = { runner }
