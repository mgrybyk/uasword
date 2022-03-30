const stats = require('../src/stats')

test('logInterval', async () => {
  expect(stats.logInterval).toEqual(60 * 1000)
})
