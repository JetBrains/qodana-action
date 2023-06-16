module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: false,
  testTimeout: 20000,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['node_modules', 'src/utils.ts', 'src/main.ts'],
  coverageThreshold: {
    global: {
      branches: 59,
      functions: 85,
      lines: 70,
      statements: 65
    }
  },
}