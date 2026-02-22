// Unit tests for writeReport function
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeReport } from '../../src/scrape-providers.js';
import fs from 'fs';
import path from 'path';

describe('writeReport', () => {
  const reportsDir = path.join(process.cwd(), 'reports');
  let createdFiles = [];

  // Clean up created files after each test
  afterEach(() => {
    createdFiles.forEach(filepath => {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
    createdFiles = [];

    // Remove reports directory if empty
    if (fs.existsSync(reportsDir) && fs.readdirSync(reportsDir).length === 0) {
      fs.rmdirSync(reportsDir);
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
      expect(filename).toMatch(/^scraping-report-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.md$/);
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
    // Create a mock scenario where writing fails
    // We'll try to write to an invalid path by mocking the directory creation
    const originalMkdirSync = fs.mkdirSync;
    
    // Mock mkdirSync to throw an error
    fs.mkdirSync = () => {
      throw new Error('Permission denied');
    };

    const reportContent = '# Test Report';
    const filepath = writeReport(reportContent);

    // Should return null on error
    expect(filepath).toBeNull();

    // Restore original function
    fs.mkdirSync = originalMkdirSync;
  });

  it('should write multiple reports with different timestamps', () => {
    const reportContent1 = '# Report 1';
    const reportContent2 = '# Report 2';

    const filepath1 = writeReport(reportContent1);
    
    // Small delay to ensure different timestamps
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Wait a bit
    }
    
    const filepath2 = writeReport(reportContent2);

    expect(filepath1).toBeTruthy();
    expect(filepath2).toBeTruthy();
    expect(filepath1).not.toBe(filepath2);

    if (filepath1) {
      expect(fs.existsSync(filepath1)).toBe(true);
      createdFiles.push(filepath1);
    }
    
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
