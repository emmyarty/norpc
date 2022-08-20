const test = require('./index')
const success = test.interface('helloworld.js') ? true : false
console.log(success)