const cluster = require('cluster')

const urlList = require('./list.json')

if (cluster.isPrimary) {
  for (let i = 0; i < urlList.length; i++) {
    cluster.fork({
      URL: urlList[i][0],
      MAX_CONCURRENT_REQUESTS: urlList[i][1],
    })
  }

  cluster.on('exit', (worker) => {
    console.log(`worker ${worker.process.pid} died`)
  })
} else {
  require('./runner')
}
