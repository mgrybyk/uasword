const { MAX_CONCURRENT_REQUESTS } = require('./constants')

/**
 *
 * @param {string} url
 * @returns string
 */
const getUrl = (url) => {
  if (typeof url !== 'string' || url.length < 10 || !url.startsWith('http')) {
    console.log('Invalid value for URL', url)
    process.exit(1)
  }
  return url
}

const getConcurrentRequests = (value) => {
  const CONCURRENT_REQUESTS = parseInt(value, 10)

  if (typeof CONCURRENT_REQUESTS !== 'number' || isNaN(CONCURRENT_REQUESTS) || CONCURRENT_REQUESTS < 1 || CONCURRENT_REQUESTS > 9999) {
    console.log(
      'Invalid value for CONCURRENT_REQUESTS',
      CONCURRENT_REQUESTS,
      `\nOnly values between 1 and ${MAX_CONCURRENT_REQUESTS} are allowed`
    )
    process.exit(1)
  }

  return CONCURRENT_REQUESTS
}

module.exports = { getUrl, getConcurrentRequests }
