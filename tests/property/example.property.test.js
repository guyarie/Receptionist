// Example property test to verify fast-check setup
import { describe, it } from 'vitest';
import fc from 'fast-check';

describe('Property test infrastructure verification', () => {
  it('should verify addition is commutative (property test)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer(),
        fc.integer(),
        async (a, b) => {
          return a + b === b + a;
        }
      ),
      { numRuns: 10 } // Small number for quick verification
    );
  });

  it('should verify string concatenation properties', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.string(),
        async (a, b, c) => {
          // Associativity property
          return (a + b) + c === a + (b + c);
        }
      ),
      { numRuns: 10 }
    );
  });
});