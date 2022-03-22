const { main, statistics } = require('./src/main')

main()

if (process.env.PORT) {
  // some cloud services require http server to be running
  const express = require('express')
  const app = express()

  app.get('/', (req, res) => res.send('ok'))
  app.get('/stats', (req, res) => res.send(statistics))

  app.listen(process.env.PORT)
}
