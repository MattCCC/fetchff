/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  workerThreads: true,
  coverageReporters: ['lcov', 'text', 'html'],
  // Measure every source file, including ones no test imports, and require full coverage
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/utils/',
    '/test/mocks/',
    '/dist/',
  ],
  moduleNameMapper: {
    '^fetchff$': '<rootDir>/src/index.ts',
    '^fetchff/(.*)$': '<rootDir>/src/$1.ts',
  },
};
