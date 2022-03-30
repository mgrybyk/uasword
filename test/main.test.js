jest.mock('../src/spawnRunner', () => ({
  run: jest.fn(),
}))

jest.mock('../src/getTargets', () => ({
  getSites: jest.fn().mockImplementation(async () => 'urlList'),
  siteListUpdater: jest.fn(),
}))

jest.mock('../src/stats', () => ({
  statsLogger: jest.fn(),
  statistics: 'stats',
}))

jest.mock('../src/browser', () => ({
  runBrowser: jest.fn(),
}))

const main = require('../src/main')
const { run } = require('../src/spawnRunner')
const { statsLogger } = require('../src/stats')
const { getSites, siteListUpdater } = require('../src/getTargets')
const { runBrowser } = require('../src/browser')

test('main', async () => {
  await main.main()

  expect(runBrowser).toBeCalledTimes(1)
  expect(getSites).toBeCalledTimes(1)

  expect(run).toBeCalledTimes(1)
  expect(run).toBeCalledWith(expect.any(Object), 'urlList')

  expect(statsLogger).toBeCalledTimes(1)
  expect(statsLogger).toBeCalledWith(expect.any(Object))

  expect(siteListUpdater).toBeCalledTimes(1)
  expect(siteListUpdater).toBeCalledWith(expect.any(Object), 'urlList')
})

test('statistics', async () => {
  expect(main.statistics).toEqual('stats')
})
