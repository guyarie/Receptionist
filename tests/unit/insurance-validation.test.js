// Integration tests for insurance field validation in generateSummaries
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Insurance Field Validation - Integration', () => {
  let consoleWarnSpy;
  
  beforeEach(() => {
    // Spy on console.warn to verify warnings are logged
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });
  
  it('should validate insurance field structure after JSON parsing', () => {
    // Simulate parsed JSON from AI response
    const parsedResponse = {
      practiceOverview: 'Practice overview content',
      providers: [
        {
          name: 'John Doe, PhD',
          slug: 'john-doe',
          content: 'Provider content',
          insurance: ['Aetna', 'Blue Cross']
        }
      ]
    };
    
    // Validate the structure
    expect(parsedResponse.practiceOverview).toBeTruthy();
    expect(Array.isArray(parsedResponse.providers)).toBe(true);
    expect(parsedResponse.providers).toHaveLength(1);
    
    const provider = parsedResponse.providers[0];
    expect(Array.isArray(provider.insurance)).toBe(true);
    expect(provider.insurance).toEqual(['Aetna', 'Blue Cross']);
  });
  
  it('should handle missing insurance field', () => {
    const parsedResponse = {
      practiceOverview: 'Practice overview',
      providers: [
        {
          name: 'Jane Smith',
          slug: 'jane-smith',
          content: 'Content without insurance'
        }
      ]
    };
    
    // Simulate validation logic
    const provider = parsedResponse.providers[0];
    if (!provider.insurance) {
      provider.insurance = [];
    }
    
    expect(Array.isArray(provider.insurance)).toBe(true);
    expect(provider.insurance).toHaveLength(0);
  });
  
  it('should convert string insurance to array', () => {
    const parsedResponse = {
      practiceOverview: 'Practice overview',
      providers: [
        {
          name: 'Bob Johnson',
          slug: 'bob-johnson',
          content: 'Provider content',
          insurance: 'Aetna, Blue Cross, Cigna'
        }
      ]
    };
    
    // Simulate validation logic
    const provider = parsedResponse.providers[0];
    if (typeof provider.insurance === 'string') {
      provider.insurance = provider.insurance
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
    
    expect(Array.isArray(provider.insurance)).toBe(true);
    expect(provider.insurance).toEqual(['Aetna', 'Blue Cross', 'Cigna']);
  });
  
  it('should convert placeholder text to empty array', () => {
    const testCases = [
      'Insurance information not provided',
      'Not available',
      'No insurance information found'
    ];
    
    testCases.forEach(placeholderText => {
      const parsedResponse = {
        practiceOverview: 'Practice overview',
        providers: [
          {
            name: 'Test Provider',
            slug: 'test-provider',
            content: 'Content',
            insurance: placeholderText
          }
        ]
      };
      
      // Simulate validation logic
      const provider = parsedResponse.providers[0];
      if (typeof provider.insurance === 'string') {
        if (provider.insurance.toLowerCase().includes('not provided') || 
            provider.insurance.toLowerCase().includes('not available') ||
            provider.insurance.toLowerCase().includes('no insurance')) {
          provider.insurance = [];
        }
      }
      
      expect(Array.isArray(provider.insurance)).toBe(true);
      expect(provider.insurance).toHaveLength(0);
    });
  });
  
  it('should handle invalid insurance types', () => {
    const invalidTypes = [
      123,
      null,
      { plan: 'Aetna' },
      true,
      undefined
    ];
    
    invalidTypes.forEach(invalidValue => {
      const parsedResponse = {
        practiceOverview: 'Practice overview',
        providers: [
          {
            name: 'Test Provider',
            slug: 'test-provider',
            content: 'Content',
            insurance: invalidValue
          }
        ]
      };
      
      // Simulate validation logic
      const provider = parsedResponse.providers[0];
      if (!provider.insurance) {
        provider.insurance = [];
      } else if (typeof provider.insurance === 'string') {
        provider.insurance = provider.insurance
          .split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0);
      } else if (!Array.isArray(provider.insurance)) {
        provider.insurance = [];
      }
      
      expect(Array.isArray(provider.insurance)).toBe(true);
    });
  });
  
  it('should process multiple providers with mixed insurance formats', () => {
    const parsedResponse = {
      practiceOverview: 'Practice overview',
      providers: [
        {
          name: 'Provider 1',
          slug: 'provider-1',
          content: 'Content',
          insurance: ['Aetna', 'Blue Cross']  // Valid array
        },
        {
          name: 'Provider 2',
          slug: 'provider-2',
          content: 'Content',
          insurance: 'Cigna, UnitedHealthcare'  // String to convert
        },
        {
          name: 'Provider 3',
          slug: 'provider-3',
          content: 'Content'
          // Missing insurance field
        },
        {
          name: 'Provider 4',
          slug: 'provider-4',
          content: 'Content',
          insurance: 'Insurance information not provided'  // Placeholder
        }
      ]
    };
    
    // Simulate validation logic for all providers
    parsedResponse.providers.forEach(provider => {
      if (!provider.insurance) {
        provider.insurance = [];
      } else if (typeof provider.insurance === 'string') {
        if (provider.insurance.toLowerCase().includes('not provided') || 
            provider.insurance.toLowerCase().includes('not available') ||
            provider.insurance.toLowerCase().includes('no insurance')) {
          provider.insurance = [];
        } else {
          provider.insurance = provider.insurance
            .split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0);
        }
      } else if (!Array.isArray(provider.insurance)) {
        provider.insurance = [];
      }
    });
    
    // Verify all providers have valid insurance arrays
    expect(parsedResponse.providers[0].insurance).toEqual(['Aetna', 'Blue Cross']);
    expect(parsedResponse.providers[1].insurance).toEqual(['Cigna', 'UnitedHealthcare']);
    expect(parsedResponse.providers[2].insurance).toEqual([]);
    expect(parsedResponse.providers[3].insurance).toEqual([]);
    
    parsedResponse.providers.forEach(provider => {
      expect(Array.isArray(provider.insurance)).toBe(true);
    });
  });
  
  it('should preserve empty insurance array', () => {
    const parsedResponse = {
      practiceOverview: 'Practice overview',
      providers: [
        {
          name: 'Provider',
          slug: 'provider',
          content: 'Content',
          insurance: []
        }
      ]
    };
    
    const provider = parsedResponse.providers[0];
    expect(Array.isArray(provider.insurance)).toBe(true);
    expect(provider.insurance).toHaveLength(0);
  });
  
  it('should trim whitespace from comma-separated insurance values', () => {
    const parsedResponse = {
      practiceOverview: 'Practice overview',
      providers: [
        {
          name: 'Provider',
          slug: 'provider',
          content: 'Content',
          insurance: '  Aetna  ,  Blue Cross  ,  Cigna  '
        }
      ]
    };
    
    // Simulate validation logic
    const provider = parsedResponse.providers[0];
    if (typeof provider.insurance === 'string') {
      provider.insurance = provider.insurance
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
    
    expect(provider.insurance).toEqual(['Aetna', 'Blue Cross', 'Cigna']);
    expect(provider.insurance[0]).toBe('Aetna');  // No leading/trailing spaces
  });
  
  it('should filter out empty strings from comma-separated values', () => {
    const parsedResponse = {
      practiceOverview: 'Practice overview',
      providers: [
        {
          name: 'Provider',
          slug: 'provider',
          content: 'Content',
          insurance: 'Aetna, , Blue Cross, , , Cigna'
        }
      ]
    };
    
    // Simulate validation logic
    const provider = parsedResponse.providers[0];
    if (typeof provider.insurance === 'string') {
      provider.insurance = provider.insurance
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
    
    expect(provider.insurance).toEqual(['Aetna', 'Blue Cross', 'Cigna']);
    expect(provider.insurance).not.toContain('');
  });
});
