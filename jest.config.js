export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['netlify/functions/**/*.js'],
  coverageDirectory: 'coverage',
  verbose: true,
};
