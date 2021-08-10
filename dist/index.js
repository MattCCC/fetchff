
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./axios-multi-api.cjs.production.min.js')
} else {
  module.exports = require('./axios-multi-api.cjs.development.js')
}
