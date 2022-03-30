const headers = require('../../src/client/headers')

test('exports', async () => {
  expect(headers).toEqual({ generateRequestHeaders: expect.any(Function) })
})
