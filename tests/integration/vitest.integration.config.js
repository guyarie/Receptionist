import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.js'],
    environment: 'node',
    testTimeout: 120000,
  }
});
