module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: false,
  testTimeout: 400000,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['html', ['lcovonly', { projectRoot: '../' }], 'text-summary'],
  coveragePathIgnorePatterns: ['node_modules', 'src/utils.ts', 'src/main.ts'],
}