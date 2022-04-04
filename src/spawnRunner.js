const { sleep } = require('./helpers')
const { runner } = require('./runner')
const { runnerDns, setMaxDnsReqs } = require('./runner-dns')

const maxConcurrentUdpRequests = 900

/**
 * @param {EventEmitter} eventEmitter
 * @param {Array<{method:'get'|'dns';}>} urlList
 */
const run = async (eventEmitter, urlList) => {
  const dnsRunners = urlList.filter((x) => x.method === 'dns').length || 1
  setMaxDnsReqs(Math.floor(maxConcurrentUdpRequests / dnsRunners))

  for (let i = 0; i < urlList.length; i++) {
    await sleep(500)
    if (urlList[i].method === 'get') {
      runner(urlList[i], eventEmitter)
    } else if (urlList[i].method === 'dns') {
      runnerDns(urlList[i], eventEmitter)
    } else {
      console.log('skipping runner', urlList[i])
    }
  }
}

module.exports = { run, maxConcurrentUdpRequests }
