import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test files pattern
    include: ['tests/**/*.test.js', 'tests/**/*.property.test.js'],
    
    // Environment
    environment: 'node',
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'coverage/',
        '**/*.config.js',
        '**/test-*.js'
      ]
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Property-based testing configuration
    // fast-check will be configured in individual test files
  }
});