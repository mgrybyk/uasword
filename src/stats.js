const { setMaxDnsReqs } = require('./runner-dns')
const { maxConcurrentUdpRequests } = require('./spawnRunner')
const { analytics } = require('./analytics')

// interval between printing stats and calculating error rate
const logIntervalSeconds = 60
const logInterval = logIntervalSeconds * 1000
const statistics = {}

/**
 * @param {EventEmitter} eventEmitter
 */
const statsLogger = (eventEmitter) => {
  let stats = []
  let totalDnsRequests = 0
  let totalHttpRequests = 0

  eventEmitter.on('RUNNER_STATS', (s) => {
    stats.push(s)
    if (s.type === 'http') {
      totalHttpRequests += s.new_reqs
    } else if (s.type === 'dns') {
      totalDnsRequests += s.new_reqs
    }
  })

  setInterval(() => {
    analytics.onlineEvent()
    stats.length = 0
    eventEmitter.emit('GET_STATS')
    setTimeout(() => {
      stats.forEach((x) => {
        x.rps = Math.floor(10 * (x.new_reqs / logIntervalSeconds)) / 10
      })

      statistics.activeRunners = stats.filter(({ isActive, rps }) => isActive && rps > 0.4)
      statistics.slowRunners = stats.filter(({ isActive, rps }) => isActive && rps <= 0.4)

      const totalHttpRps = statistics.activeRunners
        .filter(({ type }) => type === 'http')
        .reduce((prev, { rps }) => prev + rps, 0)
      const totalDnsRps = statistics.activeRunners
        .filter(({ type }) => type === 'dns')
        .reduce((prev, { rps }) => prev + rps, 0)

      statistics.total = {
        totalHttpRequests,
        totalDnsRequests,
        totalHttpRps,
        totalDnsRps,
        activeRunners: statistics.activeRunners.length,
        slowRunners: statistics.slowRunners.length,
        totalRunners: stats.length,
      }

      if (statistics.activeRunners.length > 0) {
        const tableData = []
        statistics.activeRunners.sort((a, b) => b.rps - a.rps)

        statistics.activeRunners
          .filter(({ type }) => type === 'http')
          .forEach(({ url, ip, total_reqs, errRate, rps }) => {
            tableData.push({ ip: ip || '-', url, Requests: total_reqs, 'Errors,%': errRate, 'Req/s': rps })
          })

        const activeDnsRunners = statistics.activeRunners.filter(({ type }) => type === 'dns')
        activeDnsRunners.forEach(({ host, port, total_reqs, errRate, rps }) => {
          tableData.push({
            ip: `${host}:${port}`,
            url: 'N/A (dns)',
            Requests: total_reqs,
            'Errors,%': errRate,
            'Req/s': rps,
          })
        })

        if (activeDnsRunners.length > 0) {
          setMaxDnsReqs(Math.floor(maxConcurrentUdpRequests / activeDnsRunners.length))
        }

        console.table(tableData)
      }

      console.log(
        `http reqs: ${totalHttpRequests}, rps: ${Math.floor(totalHttpRps)}`,
        '|',
        `dns reqs: ${totalDnsRequests}, rps: ${Math.floor(totalDnsRps)}`,
        '| Runners (active/slow/total)',
        `${statistics.total.activeRunners}/${statistics.total.slowRunners}/${statistics.total.totalRunners}`,
        '\n'
      )
      analytics.statsEvent(statistics)
    }, 1000)
  }, logInterval)
}

module.exports = { statsLogger, statistics, logInterval }
