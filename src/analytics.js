const { v4: uuid } = require('uuid')
const universalAnalytics = require('universal-analytics')

const visitor = universalAnalytics('UA-224567752-1', uuid())

const errorFn = () => {}

const analytics = {
  onlineEvent: () => {
    visitor.pageview('/online', errorFn)
  },
  statsEvent: (stats) => {
    visitor.event('total-http-req', `${stats.total.totalHttpRequests}`, errorFn)
    // visitor.event('total-http-rps', `${stats.total.totalHttpRps}`, errorFn)
    visitor.event('total-dns-req', `${stats.total.totalDnsRequests}`, errorFn)
    // visitor.event('total-dns-rps', `${stats.total.totalDnsRps}`, errorFn)
    // visitor.event('active-runners', `${stats.total.activeRunners}`, errorFn)
  },
}

module.exports = { analytics }
