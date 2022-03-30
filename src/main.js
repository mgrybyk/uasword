const { EventEmitter } = require('events')

const { run } = require('./spawnRunner')
const { getSites, siteListUpdater } = require('./getTargets')
const { statsLogger, statistics } = require('./stats')
const { runBrowser } = require('./browser')

const main = async () => {
  await runBrowser()

  const eventEmitter = new EventEmitter()
  eventEmitter.setMaxListeners(150)

  let urlList = await getSites()
  await run(eventEmitter, urlList)

  statsLogger(eventEmitter)
  siteListUpdater(eventEmitter, urlList)
}

module.exports = { main, statistics }
