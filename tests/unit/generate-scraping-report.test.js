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
    expect(report).toContain('Providers missing insurance:** 1');

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

  it('should include timing information when available', () => {
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
        validationWarnings: [],
        timing: {
          total: 5432,
          fetch: 2100,
          extract: 150,
          aiProcessing: 2800,
          fileWriting: 382
        }
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('### Performance Metrics');
    expect(report).toContain('Total duration:** 5432ms (5.43s)');
    expect(report).toContain('Website fetch:** 2100ms');
    expect(report).toContain('Content extraction:** 150ms');
    expect(report).toContain('AI processing:** 2800ms');
    expect(report).toContain('File writing:** 382ms');
  });

  it('should handle missing timing information gracefully', () => {
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

    expect(report).not.toContain('### Performance Metrics');
    expect(report).toContain('# Provider Scraping Report');
  });

  it('should include detailed error information with scraping mode', () => {
    const results = {
      summaries: {
        practiceOverview: '',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: [],
        errors: [
          {
            provider: 'Main Website',
            type: 'timeout',
            message: 'Navigation timeout of 10000 ms exceeded',
            url: 'https://example.com',
            attempts: 3,
            duration: 30500
          },
          {
            provider: 'Provider Page',
            type: 'navigation',
            message: 'net::ERR_NAME_NOT_RESOLVED',
            url: 'https://invalid.example.com',
            attempts: 3,
            duration: 5200
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('## Scraping Errors');
    expect(report).toContain('### Timeout Errors');
    expect(report).toContain('### Navigation Errors');
    
    // Check timeout error details
    expect(report).toContain('**Provider:** Main Website');
    expect(report).toContain('**Error:** Navigation timeout of 10000 ms exceeded');
    expect(report).toContain('**URL:** https://example.com');
    expect(report).toContain('**Scraping mode:** puppeteer');
    expect(report).toContain('**Retry attempts:** 3');
    expect(report).toContain('**Duration:** 30500ms');
    
    // Check navigation error details
    expect(report).toContain('**Provider:** Provider Page');
    expect(report).toContain('**Error:** net::ERR_NAME_NOT_RESOLVED');
    expect(report).toContain('**URL:** https://invalid.example.com');
    expect(report).toContain('**Duration:** 5200ms');
  });

  it('should categorize errors by type', () => {
    const results = {
      summaries: {
        practiceOverview: '',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: [],
        errors: [
          {
            provider: 'Provider 1',
            type: 'timeout',
            message: 'Timeout error',
            url: 'https://example.com/1',
            attempts: 3
          },
          {
            provider: 'Provider 2',
            type: 'navigation',
            message: 'Navigation error',
            url: 'https://example.com/2',
            attempts: 3
          },
          {
            provider: 'Provider 3',
            type: 'parsing',
            message: 'Parsing error',
            url: 'https://example.com/3',
            attempts: 1
          },
          {
            provider: 'Provider 4',
            type: 'unknown',
            message: 'Unknown error',
            url: 'https://example.com/4',
            attempts: 1
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('### Timeout Errors');
    expect(report).toContain('### Navigation Errors');
    expect(report).toContain('### Parsing Errors');
    expect(report).toContain('### Other Errors');
    expect(report).toContain('Provider 1');
    expect(report).toContain('Provider 2');
    expect(report).toContain('Provider 3');
    expect(report).toContain('Provider 4');
  });

  it('should include error recommendations in report', () => {
    const results = {
      summaries: {
        practiceOverview: '',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: [],
        errors: [
          {
            provider: 'Main Website',
            type: 'timeout',
            message: 'Timeout error',
            url: 'https://example.com',
            attempts: 3
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('**Scraping errors:** 1 error(s) occurred during scraping');
    expect(report).toContain('Increasing PAGE_LOAD_TIMEOUT if timeout errors are frequent');
    expect(report).toContain('Trying axios mode as fallback (set SCRAPING_MODE=axios)');
    expect(report).toContain('Reviewing error details above and retrying failed providers');
  });
