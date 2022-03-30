const browser = require('../src/browser')

test('exports', async () => {
  expect(browser).toEqual({ runBrowser: expect.any(Function), getRealBrowserHeaders: expect.any(Function) })
})
