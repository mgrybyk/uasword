const cluster = require('cluster')

if (cluster.isPrimary) {
  require('./main')
} else {
  require('./runner')
}
