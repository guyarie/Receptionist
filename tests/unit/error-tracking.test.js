import { describe, it, expect } from 'vitest';
import { generateScrapingReport } from '../../src/scrape-providers.js';

describe('Error Tracking in Scraping Operations', () => {
  it('should include error count in summary section', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
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
            attempts: 3
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('Scraping errors:** 1');
    expect(report).toContain('Scraping mode:');
  });

  it('should include scraping errors section with timeout errors', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: [],
        errors: [
          {
            provider: 'Provider A',
            type: 'timeout',
            message: 'Navigation timeout of 10000 ms exceeded',
            url: 'https://example.com/provider-a',
            attempts: 3
          },
          {
            provider: 'Provider B',
            type: 'timeout',
            message: 'Page load timeout',
            url: 'https://example.com/provider-b',
            attempts: 3
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('## Scraping Errors');
    expect(report).toContain('### Timeout Errors');
    expect(report).toContain('Provider A');
    expect(report).toContain('Navigation timeout of 10000 ms exceeded');
    expect(report).toContain('**URL:** https://example.com/provider-a');
    expect(report).toContain('**Retry attempts:** 3');
    expect(report).toContain('Provider B');
  });

  it('should include scraping errors section with navigation errors', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: [],
        errors: [
          {
            provider: 'Main Website',
            type: 'navigation',
            message: 'net::ERR_NAME_NOT_RESOLVED',
            url: 'https://invalid-domain.com',
            attempts: 3
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('## Scraping Errors');
    expect(report).toContain('### Navigation Errors');
    expect(report).toContain('Main Website');
    expect(report).toContain('net::ERR_NAME_NOT_RESOLVED');
    expect(report).toContain('**URL:** https://invalid-domain.com');
  });

  it('should include scraping errors section with parsing errors', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: [],
        errors: [
          {
            provider: 'Provider C',
            type: 'parsing',
            message: 'Failed to parse HTML content',
            url: 'https://example.com/provider-c',
            attempts: 3
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('## Scraping Errors');
    expect(report).toContain('### Parsing Errors');
    expect(report).toContain('Provider C');
    expect(report).toContain('Failed to parse HTML content');
  });

  it('should categorize multiple error types correctly', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: [],
        errors: [
          {
            provider: 'Provider A',
            type: 'timeout',
            message: 'Timeout error',
            url: 'https://example.com/a',
            attempts: 3
          },
          {
            provider: 'Provider B',
            type: 'navigation',
            message: 'Navigation error',
            url: 'https://example.com/b',
            attempts: 3
          },
          {
            provider: 'Provider C',
            type: 'parsing',
            message: 'Parsing error',
            url: 'https://example.com/c',
            attempts: 3
          },
          {
            provider: 'Provider D',
            type: 'unknown',
            message: 'Unknown error',
            url: 'https://example.com/d',
            attempts: 3
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('### Timeout Errors');
    expect(report).toContain('### Navigation Errors');
    expect(report).toContain('### Parsing Errors');
    expect(report).toContain('### Other Errors');
    expect(report).toContain('Provider A');
    expect(report).toContain('Provider B');
    expect(report).toContain('Provider C');
    expect(report).toContain('Provider D');
  });

  it('should include error recommendations when errors exist', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
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

    expect(report).toContain('Scraping errors:');
    expect(report).toContain('Increasing PAGE_LOAD_TIMEOUT if timeout errors are frequent');
    expect(report).toContain('Reviewing error details above and retrying failed providers');
  });

  it('should include navigation error recommendations', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: [],
        errors: [
          {
            provider: 'Main Website',
            type: 'navigation',
            message: 'Navigation error',
            url: 'https://example.com',
            attempts: 3
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('Checking network connectivity and URL accessibility');
  });

  it('should not show "No issues detected" when errors exist', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
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

    expect(report).not.toContain('✅ No issues detected');
  });

  it('should handle missing error details gracefully', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: [],
        errors: [
          {
            message: 'Error without details'
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('## Scraping Errors');
    expect(report).toContain('Unknown');
    expect(report).toContain('**URL:** N/A');
    expect(report).toContain('**Retry attempts:** N/A');
  });

  it('should not include scraping errors section when no errors', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: [],
        errors: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).not.toContain('## Scraping Errors');
    expect(report).toContain('Scraping errors:** 0');
  });

  it('should handle operations without errors array (backward compatibility)', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: []
      },
      operations: {
        created: [],
        updated: [],
        validationWarnings: []
        // No errors array
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('Scraping errors:** 0');
    expect(report).not.toContain('## Scraping Errors');
  });
});
