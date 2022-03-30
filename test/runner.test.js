const runner = require('../src/runner')

test('exports', async () => {
  expect(runner).toEqual({ runner: expect.any(Function) })
})
