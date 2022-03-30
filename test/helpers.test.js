const helpers = require('../src/helpers')

test('randomBool', async () => {
  expect(helpers.randomBool()).toEqual(expect.any(Boolean))
})

test('randomInt', async () => {
  const rnd = helpers.randomInt(5)
  expect(rnd).toBeGreaterThan(-1)
  expect(rnd).toBeLessThan(6)

  expect(helpers.randomInt(0)).toBe(0)
})

test('sleep', async () => {
  await helpers.sleep(1)
})
