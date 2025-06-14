module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'], // Optional: for global setup like DB connection
  testPathIgnorePatterns: ['/node_modules/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/config/', '/utils/logger.js'], // Exclude from coverage
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
};