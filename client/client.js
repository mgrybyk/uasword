/**
 * @type {import('axios').AxiosStatic}
 */
const axios = require('axios')

const validateStatus = () => true

const spawnClientInstance = (baseURL) =>
  axios.create({
    baseURL,
    timeout: 12000,
    validateStatus,
    responseType: 'arraybuffer',
  })

module.exports = { spawnClientInstance }
