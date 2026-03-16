// Unit tests for writeReport function
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeReport } from '../../src/scrape-providers.js';
import fs from 'fs';
import path from 'path';

describe('writeReport', () => {
  const reportsDir = path.join(process.cwd(), 'reports');
  let createdFiles = [];

  // Ensure reports directory exists before each test
  beforeEach(() => {
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
  });

  // Clean up created files after each test
  afterEach(() => {
    createdFiles.forEach(filepath => {
      try {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    createdFiles = [];

    // Remove reports directory if empty
    try {
      if (fs.existsSync(reportsDir) && fs.readdirSync(reportsDir).length === 0) {
        fs.rmdirSync(reportsDir);
      }
    } catch (e) {
      // Ignore cleanup errors — directory may not be empty due to concurrent tests
    }
  });

  it('should create reports directory if it does not exist', () => {
    // Ensure directory doesn't exist
    if (fs.existsSync(reportsDir)) {
      fs.rmSync(reportsDir, { recursive: true });
    }

    const reportContent = '# Test Report\n\nThis is a test report.';
    const filepath = writeReport(reportContent);

    expect(filepath).toBeTruthy();
    expect(fs.existsSync(reportsDir)).toBe(true);
    
    if (filepath) {
      createdFiles.push(filepath);
    }
  });

  it('should generate timestamped filename', () => {
    const reportContent = '# Test Report\n\nThis is a test report.';
    const filepath = writeReport(reportContent);

    expect(filepath).toBeTruthy();
    
    if (filepath) {
      const filename = path.basename(filepath);
      // Filename uses Pacific time: scraping-report-YYYY-MM-DD-HH-MM-SS.md
      expect(filename).toMatch(/^scraping-report-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.md$/);
      createdFiles.push(filepath);
    }
  });

  it('should write report content to file', () => {
    const reportContent = '# Test Report\n\nThis is a test report with content.';
    const filepath = writeReport(reportContent);

    expect(filepath).toBeTruthy();
    
    if (filepath) {
      expect(fs.existsSync(filepath)).toBe(true);
      const fileContent = fs.readFileSync(filepath, 'utf8');
      expect(fileContent).toBe(reportContent);
      createdFiles.push(filepath);
    }
  });

  it('should handle write errors gracefully and return null', () => {
    // Mock fs.writeFileSync to throw an error
    const originalWriteFileSync = fs.writeFileSync;
    fs.writeFileSync = () => {
      throw new Error('Permission denied');
    };

    const reportContent = '# Test Report';
    const filepath = writeReport(reportContent);

    // Should return null on error
    expect(filepath).toBeNull();

    // Restore original function
    fs.writeFileSync = originalWriteFileSync;
  });

  it('should write multiple reports with different timestamps', () => {
    const reportContent1 = '# Report 1';
    const reportContent2 = '# Report 2';

    const filepath1 = writeReport(reportContent1);
    
    // Verify first file exists immediately after write
    expect(filepath1).toBeTruthy();
    if (filepath1) {
      expect(fs.existsSync(filepath1)).toBe(true);
      createdFiles.push(filepath1);
    }

    // Wait at least 1 second to ensure different Pacific-time timestamps (second granularity)
    const start = Date.now();
    while (Date.now() - start < 1100) {
      // Wait for timestamp to change
    }
    
    const filepath2 = writeReport(reportContent2);

    // Verify second file exists and paths differ
    expect(filepath2).toBeTruthy();
    expect(filepath1).not.toBe(filepath2);

    if (filepath2) {
      expect(fs.existsSync(filepath2)).toBe(true);
      createdFiles.push(filepath2);
    }
  });

  it('should handle empty report content', () => {
    const reportContent = '';
    const filepath = writeReport(reportContent);

    expect(filepath).toBeTruthy();
    
    if (filepath) {
      expect(fs.existsSync(filepath)).toBe(true);
      const fileContent = fs.readFileSync(filepath, 'utf8');
      expect(fileContent).toBe('');
      createdFiles.push(filepath);
    }
  });

  it('should handle large report content', () => {
    // Create a large report (1MB of text)
    const largeContent = '# Large Report\n\n' + 'x'.repeat(1024 * 1024);
    const filepath = writeReport(largeContent);

    expect(filepath).toBeTruthy();
    
    if (filepath) {
      expect(fs.existsSync(filepath)).toBe(true);
      const fileContent = fs.readFileSync(filepath, 'utf8');
      expect(fileContent.length).toBe(largeContent.length);
      createdFiles.push(filepath);
    }
  });

  it('should handle special characters in report content', () => {
    const reportContent = '# Test Report\n\n✅ Success\n⚠️ Warning\n💥 Error\n\nSpecial chars: <>&"\'';
    const filepath = writeReport(reportContent);

    expect(filepath).toBeTruthy();
    
    if (filepath) {
      expect(fs.existsSync(filepath)).toBe(true);
      const fileContent = fs.readFileSync(filepath, 'utf8');
      expect(fileContent).toBe(reportContent);
      createdFiles.push(filepath);
    }
  });

  it('should return filepath with correct structure', () => {
    const reportContent = '# Test Report';
    const filepath = writeReport(reportContent);

    expect(filepath).toBeTruthy();
    
    if (filepath) {
      expect(filepath).toContain('reports');
      expect(filepath).toContain('scraping-report-');
      expect(filepath.endsWith('.md')).toBe(true);
      createdFiles.push(filepath);
    }
  });
});
