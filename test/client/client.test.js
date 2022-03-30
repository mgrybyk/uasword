const client = require('../../src/client/client')

test('exports', async () => {
  expect(client).toEqual({ spawnClientInstance: expect.any(Function), resolve4: expect.any(Function) })
})
