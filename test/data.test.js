test('config', () => {
  const config = require('../data/config.json')
  expect(config).toEqual({
    urls: [
      {
        enabled: expect.any(Boolean),
        name: 'UASWORD',
        url: expect.stringMatching(/^https:\/\//),
        type: 'object',
      },
      {
        enabled: expect.any(Boolean),
        name: 'SHIELD',
        url: expect.stringMatching(/^https:\/\//),
        type: 'object',
      },
      {
        enabled: expect.any(Boolean),
        name: 'DDOSER',
        url: expect.stringMatching(/^https:\/\//),
        type: 'string',
      },
      {
        enabled: expect.any(Boolean),
        name: 'DB1000N',
        url: expect.stringMatching(/^https:\/\//),
        type: 'db1000n_v0.7',
      },
    ],
  })
})
