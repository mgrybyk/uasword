/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')

const { sleep } = require('./helpers')
const { runner } = require('./runner')

const main = async () => {
  let urlList = await getSites()

  await run(urlList)

  // add new sites
  setInterval(async () => {
    const updatedUrlList = await getSites()
    const newUrlList = updatedUrlList.filter((s) => !urlList.includes(s))
    urlList.length = 0
    urlList = newUrlList
    run(urlList)
  }, 5 * 60 * 1000)
}

const run = async (urlList) => {
  for (let i = 0; i < urlList.length; i++) {
    await sleep(100)
    runner(urlList[i])
  }
}

/**
 *
 * @returns {Promise<string[]>}
 */
const getSites = async () => {
  const res = await axios.get('https://raw.githubusercontent.com/opengs/uashieldtargets/v2/sites.json')
  return res.data.map((x) => x.page)
}

module.exports = { main }
