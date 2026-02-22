import { describe, it, expect } from 'vitest';
import { generateScrapingReport } from '../../src/scrape-providers.js';

describe('generateScrapingReport', () => {
  it('should generate a complete report with all sections', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview content',
        providers: [
          {
            name: 'John Doe, PhD',
            content: 'Provider content',
            insurance: ['Aetna', 'Blue Cross'],
            email: 'john@example.com',
            phone: '555-1234'
          },
          {
            name: 'Jane Smith, LMFT',
            content: 'Provider content',
            insurance: [],
            email: 'jane@example.com',
            phone: '555-5678'
          }
        ]
      },
      operations: {
        created: ['john-doe'],
        updated: ['jane-smith'],
        validationWarnings: [
          {
            provider: 'Jane Smith, LMFT',
            slug: 'jane-smith',
            warnings: ['Insurance information is empty or missing']
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    // Verify report structure
    expect(report).toContain('# Provider Scraping Report');
    expect(report).toContain('## Summary');
    expect(report).toContain('## Providers');
    expect(report).toContain('## Validation Issues');
    expect(report).toContain('## Recommendations');

    // Verify summary statistics
    expect(report).toContain('Total providers processed:** 2');
    expect(report).toContain('New files created:** 1');
    expect(report).toContain('Existing files updated:** 1');
    expect(report).toContain('Validation warnings:** 1');
    expect(report).toContain('Providers without insurance:** 1');

    // Verify provider details
    expect(report).toContain('### John Doe, PhD');
    expect(report).toContain('`john-doe.md`');
    expect(report).toContain('🆕 NEW');
    expect(report).toContain('✅ Found (2 providers)');
    expect(report).toContain('Aetna, Blue Cross');

    expect(report).toContain('### Jane Smith, LMFT');
    expect(report).toContain('`jane-smith.md`');
    expect(report).toContain('🔄 UPDATED');
    expect(report).toContain('⚠️ Missing');

    // Verify validation issues section
    expect(report).toContain('### Missing Insurance Information');
    expect(report).toContain('Jane Smith, LMFT');
    expect(report).toContain('Insurance information is empty or missing');

    // Verify recommendations
    expect(report).toContain('Insurance extraction:');
  });

  it('should handle providers with no warnings', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          {
            name: 'John Doe',
            content: 'Content',
            insurance: ['Aetna'],
            email: 'john@example.com',
            phone: '555-1234'
          }
        ]
      },
      operations: {
        created: ['john-doe'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('Validation warnings:** 0');
    expect(report).not.toContain('## Validation Issues');
    expect(report).toContain('✅ No issues detected');
  });

  it('should handle multiple insurance providers', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          {
            name: 'John Doe',
            content: 'Content',
            insurance: ['Aetna', 'Blue Cross', 'Cigna', 'UnitedHealthcare'],
            email: 'john@example.com',
            phone: '555-1234'
          }
        ]
      },
      operations: {
        created: ['john-doe'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('✅ Found (4 providers)');
    expect(report).toContain('Aetna, Blue Cross, Cigna, UnitedHealthcare');
  });

  it('should categorize validation warnings by type', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          {
            name: 'John Doe',
            content: 'Content',
            insurance: [],
            email: 'invalid-email',
            phone: 'abc-def'
          }
        ]
      },
      operations: {
        created: ['john-doe'],
        updated: [],
        validationWarnings: [
          {
            provider: 'John Doe',
            slug: 'john-doe',
            warnings: [
              'Insurance information is empty or missing',
              'Invalid email format: invalid-email',
              'Invalid phone format: abc-def'
            ]
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('### Missing Insurance Information');
    expect(report).toContain('### Email Format Issues');
    expect(report).toContain('### Phone Format Issues');
    expect(report).toContain('Invalid email format: invalid-email');
    expect(report).toContain('Invalid phone format: abc-def');
  });

  it('should handle providers with invalid names', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          {
            name: '',
            content: 'Content',
            insurance: [],
            email: 'test@example.com',
            phone: '555-1234'
          }
        ]
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('⚠️ SKIPPED (invalid name)');
  });

  it('should include timestamp in report', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('**Generated:**');
    expect(report).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should provide recommendations based on issues found', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          {
            name: 'John Doe',
            content: 'Content',
            insurance: [],
            email: 'invalid',
            phone: 'abc'
          }
        ]
      },
      operations: {
        created: ['john-doe'],
        updated: [],
        validationWarnings: [
          {
            provider: 'John Doe',
            slug: 'john-doe',
            warnings: [
              'Insurance information is empty or missing',
              'Invalid email format: invalid',
              'Invalid phone format: abc'
            ]
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('Insurance extraction:');
    expect(report).toContain('Email validation:');
    expect(report).toContain('Phone validation:');
  });
});
