// Example test to verify vitest setup
import { describe, it, expect } from 'vitest';

describe('Test infrastructure verification', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should verify test environment is Node.js', () => {
    expect(typeof process).toBe('object');
    expect(process.version).toBeDefined();
  });
});