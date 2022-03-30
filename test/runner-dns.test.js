const runnerDns = require('../src/runner-dns')

test('exports', async () => {
  expect(runnerDns).toEqual({ runnerDns: expect.any(Function), setMaxDnsReqs: expect.any(Function) })
})
