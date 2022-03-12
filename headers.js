const UserAgent = require('user-agents')

const { randomBool, randomInt } = require('./helpers')

const headersMap = {
  UA: 'User-Agent',
  AcceptLanguage: 'Accept-Language',
  Accept: 'Accept',
  Referers: 'Referers',
  CacheControl: 'Cache-Control',
  UpgradeInsecureRequests: 'Upgrade-Insecure-Requests',
  AcceptEncoding: 'Accept-Encoding',
}

const acceptEncoding = 'gzip, deflate, br'
const cacheControlOptions = ['no-cache', 'max-age=0']
const acceptLanguages = ['ru-RU,ru', 'ru,en;q=0.9,en-US;q=0.8']
const referers = [
  'https://www.google.com/',
  'https://vk.com/',
  'https://go.mail.ru/search/',
  'https://yandex.ru/search/',
  'https://yandex.ru/search/', // don't remove the second line this is on purpose
]
const accept =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
const secHeaders = {
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-dest': 'document',
  'sec-fetch-user': '?1',
  'sec-ch-ua-platform': 'Windows',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="98", "Google Chrome";v="98"',
}

const generateRequestHeaders = () => {
  const headers = getAdditionalRandomHeaders()

  headers[headersMap.UA] = new UserAgent().toString()
  headers[headersMap.AcceptLanguage] = acceptLanguages[randomInt(acceptLanguages.length)]
  headers[headersMap.Accept] = accept

  return headers
}

const getAdditionalRandomHeaders = () => {
  const headers = randomBool() ? {} : { ...secHeaders }
  if (randomBool()) {
    headers[headersMap.Referers] = referers[randomInt(referers.length)]
  }
  if (randomBool()) {
    headers[headersMap.CacheControl] = cacheControlOptions[randomInt(cacheControlOptions.length)]
  }
  if (randomBool()) {
    headers[headersMap.UpgradeInsecureRequests] = 1
  }
  if (randomBool()) {
    headers[headersMap.AcceptEncoding] = acceptEncoding
  }
  return headers
}

module.exports = { generateRequestHeaders }
