/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')

const spawnClientInstance = (baseURL) =>
  axios.create({
    baseURL,
    timeout: 20000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
      'Upgrade-Insecure-Requests': '1',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': '*',
      'Cache-Control': 'max-age=0',
      Connection: 'keep-alive',
    },
  })

module.exports = { spawnClientInstance }
