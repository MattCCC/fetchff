/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  workerThreads: true,
  coverageReporters: ['lcov', 'text', 'html'],
  moduleNameMapper: {
    '^fetchff$': '<rootDir>/src/index.ts',
    '^fetchff/(.*)$': '<rootDir>/src/$1.ts',
  },
};
