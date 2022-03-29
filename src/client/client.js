/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')

const validateStatus = () => true

const spawnClientInstance = (baseURL) => {
  const client = axios.create({
    baseURL,
    timeout: 12000,
    validateStatus,
    responseType: 'arraybuffer',
    maxRedirects: 10,
  })

  client.interceptors.request.use((config) => {
    if (config.ip) {
      const url = new URL(config.url, config.baseURL)
      config.headers.Host = url.hostname
      url.hostname = config.ip
      config.url = url.toString()
    }
    return config
  })

  return client
}

module.exports = { spawnClientInstance }
