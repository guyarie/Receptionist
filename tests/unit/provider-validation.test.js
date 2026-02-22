// Unit tests for provider validation functions
import { describe, it, expect } from 'vitest';

// Import the functions we're testing
const { validateProvider, isValidEmail, isValidPhone } = require('../../src/scrape-providers.js');

describe('isValidEmail', () => {
  it('should accept valid email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.com',
      'user+tag@example.co.uk',
      'first.last@subdomain.example.com',
      'user123@test-domain.com'
    ];
    
    validEmails.forEach(email => {
      expect(isValidEmail(email)).toBe(true);
    });
  });
  
  it('should reject invalid email formats', () => {
    const invalidEmails = [
      'notanemail',
      '@example.com',
      'user@',
      'user @example.com',
      'user@example',
      '',
      'user@.com',
      'user..name@example.com'
    ];
    
    invalidEmails.forEach(email => {
      expect(isValidEmail(email)).toBe(false);
    });
  });
  
  it('should handle null and undefined inputs', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
  
  it('should handle non-string inputs', () => {
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail({})).toBe(false);
    expect(isValidEmail([])).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('should accept valid phone formats', () => {
    const validPhones = [
      '1234567890',
      '(123) 456-7890',
      '123-456-7890',
      '123 456 7890',
      '(123)456-7890',
      '123.456.7890'.replace(/\./g, '-'), // Dots not allowed, but hyphens are
      '1-800-555-5555'
    ];
    
    validPhones.forEach(phone => {
      expect(isValidPhone(phone)).toBe(true);
    });
  });
  
  it('should reject invalid phone formats', () => {
    const invalidPhones = [
      'abc-def-ghij',
      '123-456-789x',
      '(123) 456-7890 ext 123', // 'ext' contains letters
      '',
      '123.456.7890', // Dots not allowed
      'phone: 1234567890' // Letters not allowed
    ];
    
    invalidPhones.forEach(phone => {
      expect(isValidPhone(phone)).toBe(false);
    });
  });
  
  it('should handle null and undefined inputs', () => {
    expect(isValidPhone(null)).toBe(false);
    expect(isValidPhone(undefined)).toBe(false);
  });
  
  it('should handle non-string inputs', () => {
    expect(isValidPhone(1234567890)).toBe(false);
    expect(isValidPhone({})).toBe(false);
    expect(isValidPhone([])).toBe(false);
  });
});

describe('validateProvider', () => {
  it('should validate a complete provider with all fields', () => {
    const provider = {
      name: 'John Doe, PhD',
      content: 'Dr. John Doe is a licensed therapist...',
      email: 'john@example.com',
      phone: '(123) 456-7890',
      insurance: ['Aetna', 'Blue Cross']
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
  
  it('should warn when name is missing', () => {
    const provider = {
      content: 'Provider content',
      insurance: ['Aetna']
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Missing or invalid name field');
  });
  
  it('should warn when name is empty string', () => {
    const provider = {
      name: '   ',
      content: 'Provider content',
      insurance: ['Aetna']
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Missing or invalid name field');
  });
  
  it('should warn when content is missing', () => {
    const provider = {
      name: 'John Doe',
      insurance: ['Aetna']
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Missing or invalid content field');
  });
  
  it('should warn when content is empty string', () => {
    const provider = {
      name: 'John Doe',
      content: '   ',
      insurance: ['Aetna']
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Missing or invalid content field');
  });
  
  it('should warn when email format is invalid', () => {
    const provider = {
      name: 'John Doe',
      content: 'Provider content',
      email: 'notanemail',
      insurance: ['Aetna']
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Invalid email format: notanemail');
  });
  
  it('should warn when phone format is invalid', () => {
    const provider = {
      name: 'John Doe',
      content: 'Provider content',
      phone: 'abc-def-ghij',
      insurance: ['Aetna']
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Invalid phone format: abc-def-ghij');
  });
  
  it('should warn when insurance array is empty', () => {
    const provider = {
      name: 'John Doe',
      content: 'Provider content',
      insurance: []
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Insurance information is empty or missing');
  });
  
  it('should warn when insurance is missing', () => {
    const provider = {
      name: 'John Doe',
      content: 'Provider content'
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Insurance information is empty or missing');
  });
  
  it('should warn when insurance is not an array', () => {
    const provider = {
      name: 'John Doe',
      content: 'Provider content',
      insurance: 'Aetna, Blue Cross'
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Insurance information is empty or missing');
  });
  
  it('should collect multiple warnings', () => {
    const provider = {
      name: '',
      content: '',
      email: 'invalid',
      phone: 'abc',
      insurance: []
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(1);
    expect(result.warnings).toContain('Missing or invalid name field');
    expect(result.warnings).toContain('Missing or invalid content field');
    expect(result.warnings).toContain('Invalid email format: invalid');
    expect(result.warnings).toContain('Invalid phone format: abc');
    expect(result.warnings).toContain('Insurance information is empty or missing');
  });
  
  it('should not warn about missing optional fields', () => {
    const provider = {
      name: 'John Doe',
      content: 'Provider content',
      insurance: ['Aetna']
      // No email or phone provided
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
  
  it('should handle provider with valid email but no phone', () => {
    const provider = {
      name: 'John Doe',
      content: 'Provider content',
      email: 'john@example.com',
      insurance: ['Aetna']
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
  
  it('should handle provider with valid phone but no email', () => {
    const provider = {
      name: 'John Doe',
      content: 'Provider content',
      phone: '123-456-7890',
      insurance: ['Aetna']
    };
    
    const result = validateProvider(provider);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
  
  it('should handle null provider input gracefully', () => {
    const result = validateProvider(null);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Missing or invalid name field');
    expect(result.warnings).toContain('Missing or invalid content field');
  });
  
  it('should handle undefined provider input gracefully', () => {
    const result = validateProvider(undefined);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Missing or invalid name field');
    expect(result.warnings).toContain('Missing or invalid content field');
  });
  
  it('should handle empty object provider input', () => {
    const result = validateProvider({});
    expect(result.valid).toBe(false);
    expect(result.warnings).toContain('Missing or invalid name field');
    expect(result.warnings).toContain('Missing or invalid content field');
    expect(result.warnings).toContain('Insurance information is empty or missing');
  });
  
  it('should never throw exceptions with malformed inputs', () => {
    const malformedInputs = [
      null,
      undefined,
      {},
      { name: null, content: null },
      { name: 123, content: 456 },
      { name: [], content: {} },
      'not an object',
      123,
      []
    ];
    
    malformedInputs.forEach(input => {
      expect(() => validateProvider(input)).not.toThrow();
    });
  });
});
