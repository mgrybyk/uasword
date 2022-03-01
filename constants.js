module.exports = {
  // interval between requests. 1000 / 2 means 500 max requests per second (per worker) is allowed
  REQ_DELAY: 2,
  // stop process is service is down within DELAY * ATTEMPTS (2 hours)
  FAILURE_DELAY: 1.5 * 60 * 1000,
  ATTEMPTS: 80,
  // concurrent requests adopts based on error rate, but won't exceed the max value
  MAX_CONCURRENT_REQUESTS: 9999,
  // interval between printing stats and calculating error rate
  INTERVAL: 60 * 1000,
}
