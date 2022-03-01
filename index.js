const cluster = require('cluster')

if (cluster.isPrimary) {
  require('./main')

  if (!process.env.PORT) {
    return
  }

  // some cloud services require http server to be running
  const express = require('express')
  const app = express()

  app.get('/', (req, res) => res.send('ok'))

  app.listen(process.env.PORT)
} else {
  require('./runner')
}
