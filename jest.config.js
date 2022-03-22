module.exports = {
  testTimeout: 600000,
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', 'src/test/'],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  moduleDirectories: ['node_modules', 'src/main', 'src/test'],
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '@app/(.*)': '<rootDir>/src/main/$1',
    '@test/(.*)': '<rootDir>/src/test/$1',
  },
  modulePaths: ['<rootDir>/src/main/', '<rootDir>/src/test/'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
}
