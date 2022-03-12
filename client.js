/**
 * @type {import('axios').AxiosStatic}
 */
const { create } = require('axios')

const validateStatus = () => true

const spawnClientInstance = (baseURL) =>
  create({
    baseURL,
    timeout: 10000,
    validateStatus,
  })

module.exports = { spawnClientInstance }
