const spawnRunner = require('../src/spawnRunner')

test('maxConcurrentUdpRequests', async () => {
  expect(spawnRunner.maxConcurrentUdpRequests).toEqual(300)
})
