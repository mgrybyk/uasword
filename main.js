const cluster = require('cluster')

const urlList = require('./list.json')

const primary = async () => {
  for (let i = 0; i < urlList.length; i++) {
    await sleep(300)
    cluster.fork({
      URL: urlList[i][0],
      MAX_CONCURRENT_REQUESTS: urlList[i][1],
    })
  }

  cluster.on('exit', (worker) => {
    console.log(`WORKER ${worker.process.pid} terminated.`)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

primary()
