/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  workerThreads: true,
  coverageReporters: ['lcov', 'text', 'html'],
};
