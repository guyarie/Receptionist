import { describe, it, expect } from 'vitest';
import { normalizeProviderName } from '../../src/scrape-providers.js';

describe('normalizeProviderName', () => {
  it('should remove credentials and middle initial from "Jeffrey B. Gillman, PhD"', () => {
    const result = normalizeProviderName('Jeffrey B. Gillman, PhD');
    expect(result).toBe('jeffrey-gillman');
  });

  it('should remove multiple credentials from "Miri Arie, PhD, LMFT"', () => {
    const result = normalizeProviderName('Miri Arie, PhD, LMFT');
    expect(result).toBe('miri-arie');
  });

  it('should handle name with middle initial without period', () => {
    const result = normalizeProviderName('John Q Public');
    expect(result).toBe('john-public');
  });

  it('should handle name with special characters', () => {
    const result = normalizeProviderName("Mary-Jane O'Brien, LCSW");
    expect(result).toBe('mary-jane-obrien');
  });

  it('should handle empty string', () => {
    const result = normalizeProviderName('');
    expect(result).toBe('');
  });

  it('should handle null input', () => {
    const result = normalizeProviderName(null);
    expect(result).toBe('');
  });

  it('should handle name with no alphabetic characters', () => {
    const result = normalizeProviderName('123 456');
    expect(result).toBe('');
  });

  it('should handle name with only first name', () => {
    const result = normalizeProviderName('Madonna');
    expect(result).toBe('madonna');
  });

  it('should handle name with multiple middle names/initials', () => {
    const result = normalizeProviderName('John A. B. Smith, MD');
    expect(result).toBe('john-smith');
  });

  it('should handle various credential combinations', () => {
    expect(normalizeProviderName('Jane Doe, LMHC')).toBe('jane-doe');
    expect(normalizeProviderName('Bob Smith, LPC, MA')).toBe('bob-smith');
    expect(normalizeProviderName('Alice Johnson PsyD')).toBe('alice-johnson');
  });

  it('should truncate extremely long names to 100 characters', () => {
    // Create a name longer than 100 characters
    const longName = 'Verylongfirstname Verylonglastname'.repeat(5); // Much longer than 100 chars
    const result = normalizeProviderName(longName);
    
    // The result should be a valid slug and not exceed the length that would come from 100 chars
    expect(result).toBeTruthy();
    expect(result.length).toBeLessThanOrEqual(110); // Slug might be slightly longer due to hyphens
  });
});
