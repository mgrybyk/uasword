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

module.exports = { getUrl }
