import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateScrapingReport } from '../../src/scrape-providers.js';
import fs from 'fs';
import path from 'path';

describe('Insurance Statistics in Scraping Report', () => {
  const reportsDir = path.join(process.cwd(), 'reports');
  const testReportPath = path.join(reportsDir, 'scraping-report-2024-01-01T00-00-00-000Z.md');

  beforeEach(() => {
    // Clean up ALL existing reports to ensure clean test environment
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir);
      for (const file of files) {
        if (file.startsWith('scraping-report-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(reportsDir, file));
        }
      }
    }
  });

  afterEach(() => {
    // Clean up ALL test reports
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir);
      for (const file of files) {
        if (file.startsWith('scraping-report-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(reportsDir, file));
        }
      }
    }
  });

  it('should count providers with insurance information', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          {
            name: 'John Doe',
            content: 'Content',
            insurance: ['Aetna', 'Blue Cross'],
            email: 'john@example.com',
            phone: '555-1234'
          },
          {
            name: 'Jane Smith',
            content: 'Content',
            insurance: ['Cigna'],
            email: 'jane@example.com',
            phone: '555-5678'
          },
          {
            name: 'Bob Johnson',
            content: 'Content',
            insurance: [],
            email: 'bob@example.com',
            phone: '555-9999'
          }
        ]
      },
      operations: {
        created: ['john-doe', 'jane-smith', 'bob-johnson'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('### Insurance Data Statistics');
    expect(report).toContain('**Providers with insurance:** 2 (66.7%)');
    expect(report).toContain('**Providers missing insurance:** 1');
  });

  it('should count providers missing insurance information', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          {
            name: 'John Doe',
            content: 'Content',
            insurance: [],
            email: 'john@example.com',
            phone: '555-1234'
          },
          {
            name: 'Jane Smith',
            content: 'Content',
            insurance: null,
            email: 'jane@example.com',
            phone: '555-5678'
          },
          {
            name: 'Bob Johnson',
            content: 'Content',
            insurance: ['Aetna'],
            email: 'bob@example.com',
            phone: '555-9999'
          }
        ]
      },
      operations: {
        created: ['john-doe', 'jane-smith', 'bob-johnson'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('**Providers with insurance:** 1 (33.3%)');
    expect(report).toContain('**Providers missing insurance:** 2');
  });

  it('should calculate insurance percentage correctly', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          { name: 'Provider 1', content: 'Content', insurance: ['Aetna'] },
          { name: 'Provider 2', content: 'Content', insurance: ['Blue Cross'] },
          { name: 'Provider 3', content: 'Content', insurance: ['Cigna'] },
          { name: 'Provider 4', content: 'Content', insurance: [] },
          { name: 'Provider 5', content: 'Content', insurance: [] }
        ]
      },
      operations: {
        created: ['provider-1', 'provider-2', 'provider-3', 'provider-4', 'provider-5'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    // 3 out of 5 = 60%
    expect(report).toContain('**Providers with insurance:** 3 (60.0%)');
    expect(report).toContain('**Providers missing insurance:** 2');
  });

  it('should handle 100% insurance coverage', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          { name: 'Provider 1', content: 'Content', insurance: ['Aetna'] },
          { name: 'Provider 2', content: 'Content', insurance: ['Blue Cross'] }
        ]
      },
      operations: {
        created: ['provider-1', 'provider-2'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('**Providers with insurance:** 2 (100.0%)');
    expect(report).toContain('**Providers missing insurance:** 0');
  });

  it('should handle 0% insurance coverage', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          { name: 'Provider 1', content: 'Content', insurance: [] },
          { name: 'Provider 2', content: 'Content', insurance: [] }
        ]
      },
      operations: {
        created: ['provider-1', 'provider-2'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('**Providers with insurance:** 0 (0.0%)');
    expect(report).toContain('**Providers missing insurance:** 2');
  });

  it('should compare with previous run when available', () => {
    // Create a previous report
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const previousReport = `# Provider Scraping Report

**Generated:** 2024-01-01T00:00:00.000Z

---

## Summary

- **Total providers processed:** 3
- **New files created:** 3
- **Existing files updated:** 0
- **Validation warnings:** 0
- **Scraping errors:** 0
- **Scraping mode:** puppeteer

### Insurance Data Statistics

- **Providers with insurance:** 1 (33.3%)
- **Providers missing insurance:** 2

## Providers

### Provider 1
- **Slug:** \`provider-1.md\`
- **Status:** 🆕 NEW
- **Insurance:** ✅ Found (1 provider)
  - Aetna

### Provider 2
- **Slug:** \`provider-2.md\`
- **Status:** 🆕 NEW
- **Insurance:** ⚠️ Missing

### Provider 3
- **Slug:** \`provider-3.md\`
- **Status:** 🆕 NEW
- **Insurance:** ⚠️ Missing

## Recommendations

✅ No issues detected. All provider data appears complete and valid.

---

*Report generated by AI Phone Receptionist - Provider Scraper*
`;

    fs.writeFileSync(testReportPath, previousReport, 'utf-8');

    // Generate new report with improved insurance data
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          { name: 'Provider 1', content: 'Content', insurance: ['Aetna'] },
          { name: 'Provider 2', content: 'Content', insurance: ['Blue Cross'] },
          { name: 'Provider 3', content: 'Content', insurance: [] }
        ]
      },
      operations: {
        created: ['provider-1', 'provider-2', 'provider-3'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    // Should show improvement: 2 providers with insurance (up from 1)
    expect(report).toContain('**Providers with insurance:** 2 (66.7%) 📈 (+1 from previous run)');
    expect(report).toContain('**Providers missing insurance:** 1 📉 (-1 from previous run)');
  });

  it('should show increase in missing insurance', () => {
    // Create a previous report with better insurance coverage
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const previousReport = `# Provider Scraping Report

**Generated:** 2024-01-01T00:00:00.000Z

---

## Summary

- **Total providers processed:** 3
- **New files created:** 3
- **Existing files updated:** 0
- **Validation warnings:** 0
- **Scraping errors:** 0
- **Scraping mode:** puppeteer

### Insurance Data Statistics

- **Providers with insurance:** 3 (100.0%)
- **Providers missing insurance:** 0

## Providers

---

*Report generated by AI Phone Receptionist - Provider Scraper*
`;

    fs.writeFileSync(testReportPath, previousReport, 'utf-8');

    // Generate new report with worse insurance data
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          { name: 'Provider 1', content: 'Content', insurance: ['Aetna'] },
          { name: 'Provider 2', content: 'Content', insurance: [] },
          { name: 'Provider 3', content: 'Content', insurance: [] }
        ]
      },
      operations: {
        created: ['provider-1', 'provider-2', 'provider-3'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    // Should show decline: 1 provider with insurance (down from 3)
    expect(report).toContain('**Providers with insurance:** 1 (33.3%) 📉 (-2 from previous run)');
    expect(report).toContain('**Providers missing insurance:** 2 📈 (+2 from previous run)');
  });

  it('should show no change when insurance stats are the same', () => {
    // Create a previous report
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const previousReport = `# Provider Scraping Report

**Generated:** 2024-01-01T00:00:00.000Z

---

## Summary

- **Total providers processed:** 2
- **New files created:** 2
- **Existing files updated:** 0
- **Validation warnings:** 0
- **Scraping errors:** 0
- **Scraping mode:** puppeteer

### Insurance Data Statistics

- **Providers with insurance:** 1 (50.0%)
- **Providers missing insurance:** 1

## Providers

---

*Report generated by AI Phone Receptionist - Provider Scraper*
`;

    fs.writeFileSync(testReportPath, previousReport, 'utf-8');

    // Generate new report with same insurance stats
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          { name: 'Provider 1', content: 'Content', insurance: ['Aetna'] },
          { name: 'Provider 2', content: 'Content', insurance: [] }
        ]
      },
      operations: {
        created: ['provider-1', 'provider-2'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    // Should show no change
    expect(report).toContain('**Providers with insurance:** 1 (50.0%) ➡️ (0 from previous run)');
    expect(report).toContain('**Providers missing insurance:** 1 ➡️ (0 from previous run)');
  });

  it('should work without previous report', () => {
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          { name: 'Provider 1', content: 'Content', insurance: ['Aetna'] },
          { name: 'Provider 2', content: 'Content', insurance: [] }
        ]
      },
      operations: {
        created: ['provider-1', 'provider-2'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    // Should not show comparison when no previous report exists
    expect(report).toContain('**Providers with insurance:** 1 (50.0%)');
    expect(report).toContain('**Providers missing insurance:** 1');
    expect(report).not.toContain('from previous run');
  });

  it('should include improvement note in recommendations', () => {
    // Create a previous report
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const previousReport = `# Provider Scraping Report

**Generated:** 2024-01-01T00:00:00.000Z

---

## Summary

- **Total providers processed:** 3
- **New files created:** 3
- **Existing files updated:** 0
- **Validation warnings:** 0
- **Scraping errors:** 0
- **Scraping mode:** puppeteer

### Insurance Data Statistics

- **Providers with insurance:** 0 (0.0%)
- **Providers missing insurance:** 3

## Providers

---

*Report generated by AI Phone Receptionist - Provider Scraper*
`;

    fs.writeFileSync(testReportPath, previousReport, 'utf-8');

    // Generate new report with improved insurance data
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          { name: 'Provider 1', content: 'Content', insurance: ['Aetna'] },
          { name: 'Provider 2', content: 'Content', insurance: ['Blue Cross'] },
          { name: 'Provider 3', content: 'Content', insurance: [] }
        ]
      },
      operations: {
        created: ['provider-1', 'provider-2', 'provider-3'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('✅ Improvement: 2 fewer provider(s) missing insurance compared to previous run');
  });

  it('should include warning note in recommendations when insurance data worsens', () => {
    // Create a previous report
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const previousReport = `# Provider Scraping Report

**Generated:** 2024-01-01T00:00:00.000Z

---

## Summary

- **Total providers processed:** 3
- **New files created:** 3
- **Existing files updated:** 0
- **Validation warnings:** 0
- **Scraping errors:** 0
- **Scraping mode:** puppeteer

### Insurance Data Statistics

- **Providers with insurance:** 3 (100.0%)
- **Providers missing insurance:** 0

## Providers

---

*Report generated by AI Phone Receptionist - Provider Scraper*
`;

    fs.writeFileSync(testReportPath, previousReport, 'utf-8');

    // Generate new report with worse insurance data
    const results = {
      summaries: {
        practiceOverview: 'Practice overview',
        providers: [
          { name: 'Provider 1', content: 'Content', insurance: ['Aetna'] },
          { name: 'Provider 2', content: 'Content', insurance: [] },
          { name: 'Provider 3', content: 'Content', insurance: [] }
        ]
      },
      operations: {
        created: ['provider-1', 'provider-2', 'provider-3'],
        updated: [],
        validationWarnings: []
      }
    };

    const report = generateScrapingReport(results);

    expect(report).toContain('⚠️ Note: 2 more provider(s) missing insurance compared to previous run');
  });
});
