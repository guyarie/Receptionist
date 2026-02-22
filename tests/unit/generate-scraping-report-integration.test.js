import { describe, it, expect } from 'vitest';
import { generateScrapingReport, normalizeProviderName } from '../../src/scrape-providers.js';

describe('generateScrapingReport - Integration', () => {
  it('should generate report matching actual scraper output format', () => {
    // Simulate actual scraper results structure
    const results = {
      summaries: {
        practiceOverview: 'Relational Therapy Collective is a group practice...',
        providers: [
          {
            name: 'Jeffrey B. Gillman, PhD',
            content: '# Jeffrey Gillman\n\nCredentials: PhD\n\nContact: jeffrey@rtc.com',
            insurance: ['Aetna', 'Blue Cross Blue Shield', 'Cigna'],
            email: 'jeffrey@rtc.com',
            phone: '(555) 123-4567'
          },
          {
            name: 'Miri Arie, PhD, LMFT',
            content: '# Miri Arie\n\nCredentials: PhD, LMFT\n\nContact: miri@rtc.com',
            insurance: ['UnitedHealthcare', 'Aetna'],
            email: 'miri@rtc.com',
            phone: '555-234-5678'
          },
          {
            name: 'Sarah Johnson, LCSW',
            content: '# Sarah Johnson\n\nCredentials: LCSW\n\nContact: sarah@rtc.com',
            insurance: [],
            email: 'sarah@rtc.com',
            phone: '555-345-6789'
          }
        ]
      },
      operations: {
        created: ['jeffrey-gillman', 'sarah-johnson'],
        updated: ['miri-arie'],
        validationWarnings: [
          {
            provider: 'Sarah Johnson, LCSW',
            slug: 'sarah-johnson',
            warnings: ['Insurance information is empty or missing']
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    // Verify the report is comprehensive
    expect(report).toBeTruthy();
    expect(report.length).toBeGreaterThan(500);

    // Verify all providers are listed with correct normalization
    expect(report).toContain('Jeffrey B. Gillman, PhD');
    expect(report).toContain('jeffrey-gillman.md');
    expect(report).toContain('Miri Arie, PhD, LMFT');
    expect(report).toContain('miri-arie.md');
    expect(report).toContain('Sarah Johnson, LCSW');
    expect(report).toContain('sarah-johnson.md');

    // Verify operation types are correct
    expect(report).toContain('🆕 NEW');
    expect(report).toContain('🔄 UPDATED');

    // Verify insurance information is displayed
    expect(report).toContain('Aetna, Blue Cross Blue Shield, Cigna');
    expect(report).toContain('UnitedHealthcare, Aetna');

    // Verify validation warnings are included
    expect(report).toContain('Sarah Johnson, LCSW');
    expect(report).toContain('Insurance information is empty or missing');

    // Verify summary statistics
    expect(report).toContain('Total providers processed:** 3');
    expect(report).toContain('New files created:** 2');
    expect(report).toContain('Existing files updated:** 1');
    expect(report).toContain('Validation warnings:** 1');
    expect(report).toContain('Providers without insurance:** 1');
  });

  it('should demonstrate report usage in scraper workflow', () => {
    // This test demonstrates how the function would be called in main()
    const summaries = {
      practiceOverview: 'Practice overview',
      providers: [
        {
          name: 'John Doe, PhD',
          content: 'Provider content',
          insurance: ['Aetna'],
          email: 'john@example.com',
          phone: '555-1234'
        }
      ]
    };

    const operations = {
      created: ['john-doe'],
      updated: [],
      validationWarnings: []
    };

    // This is how it would be called in the main() function
    const report = generateScrapingReport({ summaries, operations });

    // Verify report can be written to file or logged
    expect(typeof report).toBe('string');
    expect(report).toContain('# Provider Scraping Report');
    expect(report).toContain('John Doe, PhD');
  });

  it('should handle edge case of all providers having issues', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          {
            name: 'Provider One',
            content: 'Content',
            insurance: [],
            email: 'invalid-email',
            phone: 'abc'
          },
          {
            name: 'Provider Two',
            content: 'Content',
            insurance: [],
            email: 'also-invalid',
            phone: 'xyz'
          }
        ]
      },
      operations: {
        created: ['provider-one', 'provider-two'],
        updated: [],
        validationWarnings: [
          {
            provider: 'Provider One',
            slug: 'provider-one',
            warnings: [
              'Insurance information is empty or missing',
              'Invalid email format: invalid-email',
              'Invalid phone format: abc'
            ]
          },
          {
            provider: 'Provider Two',
            slug: 'provider-two',
            warnings: [
              'Insurance information is empty or missing',
              'Invalid email format: also-invalid',
              'Invalid phone format: xyz'
            ]
          }
        ]
      }
    };

    const report = generateScrapingReport(results);

    // Verify all issues are reported
    expect(report).toContain('Validation warnings:** 2');
    expect(report).toContain('Providers without insurance:** 2');
    expect(report).toContain('### Missing Insurance Information');
    expect(report).toContain('### Email Format Issues');
    expect(report).toContain('### Phone Format Issues');
    expect(report).toContain('Provider One');
    expect(report).toContain('Provider Two');
  });
});
