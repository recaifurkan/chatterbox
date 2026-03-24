/**
 * ioredis mock for tests - maps 'ioredis' module to ioredis-mock
 * Used via Jest moduleNameMapper
 */
const RedisMock = require('ioredis-mock');
module.exports = RedisMock;
module.exports.default = RedisMock;

