/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')
const { assert } = require('console')
const { EventEmitter } = require('events')

const { sleep } = require('./helpers')
const { runner } = require('./runner')

// interval between printing stats and calculating error rate
const logInterval = 60 * 1000
const urlsPoolInterval = 15 * 60 * 1000
const sitesUrl = process.env.SITES_URL || 'https://raw.githubusercontent.com/opengs/uashieldtargets/v2/sites.json'

const main = async () => {
  const eventEmitter = new EventEmitter()
  eventEmitter.setMaxListeners(100)

  let urlList = await getSites()

  await run(urlList, eventEmitter)

  statsLogger(eventEmitter)

  // add new sites
  setInterval(async () => {
    const updatedUrlList = await getSites({ ignoreError: true })
    const newUrlList = updatedUrlList.filter((s) => !urlList.includes(s))

    if (newUrlList.length > 0) {
      console.log('\nUpdating url list, added', newUrlList.length, 'urls\n')
      urlList.length = 0
      urlList = newUrlList
      run(urlList, eventEmitter)
    }
  }, urlsPoolInterval)
}

const run = async (urlList, eventEmitter) => {
  for (let i = 0; i < urlList.length; i++) {
    await sleep(1000)
    runner(urlList[i], eventEmitter)
  }
}

/**
 * @param {EventEmitter} eventEmitter
 */
const statsLogger = (eventEmitter) => {
  let stats = []
  let totalRequests = 0

  eventEmitter.on('RUNNER_STATS', (s) => {
    stats.push(s)
    totalRequests += s.new_reqs
  })

  setInterval(() => {
    stats.length = 0
    eventEmitter.emit('GET_STATS')
    setTimeout(() => {
      const activeRunners = stats.filter(({ isActive }) => isActive)
      activeRunners.forEach(({ url, total_reqs, errRate, rps, concurrentReqs }) => {
        console.log(url, '|', 'Req', total_reqs, '|', 'Current Errors,%', errRate, '| rps', rps, '| CR', concurrentReqs)
      })
      console.log('Total Requests', totalRequests, '| Active runners', activeRunners.length, 'of', stats.length)
    }, 1000)
  }, logInterval)
}

/**
 *
 * @returns {Promise<string[]>}
 */
const getSites = async ({ ignoreError = false } = {}) => {
  try {
    const res = await axios.get(sitesUrl)
    assert(Array.isArray(res.data))
    assert(res.data.length > 0)
    assert(typeof res.data[0].page === 'string')
    return res.data.map((x) => x.page)
  } catch (err) {
    if (ignoreError) {
      console.log('WARN: Failed to get new urls list from github')
      return []
    }
    throw err
  }
}

module.exports = { main }
