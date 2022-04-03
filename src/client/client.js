/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')
const { Resolver } = require('dns/promises')

const { randomInt } = require('../helpers')

const resolver = new Resolver()
resolver.setServers(['77.88.8.8', '77.88.8.1', '1.1.1.1', '8.8.8.8'])

const resolve4 = async (hostname, prevIp) => {
  try {
    const r = await resolver.resolve4(hostname)
    return r[randomInt(r.length)] || prevIp
  } catch {
    return prevIp
  }
}

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

module.exports = { spawnClientInstance, resolve4 }
