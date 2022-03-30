const getTargets = require('../src/getTargets')

test('exports', async () => {
  expect(getTargets).toEqual({ siteListUpdater: expect.any(Function), getSites: expect.any(Function) })
})
