const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const randomInt = (num) => Math.floor(Math.random() * num)

const randomBool = () => Math.random() < 0.5

module.exports = { sleep, randomBool, randomInt }
