/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
  // mongodb-memory-server can take a while to start (binary download on
  // first run in particular), so integration-test beforeAll hooks need
  // more than Jest's 5s default.
  testTimeout: 30000,
};
