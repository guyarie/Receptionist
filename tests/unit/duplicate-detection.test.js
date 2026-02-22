// Unit tests for duplicate detection functions
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test directory for provider files
const TEST_PROVIDERS_DIR = path.join(__dirname, '..', '..', 'data', 'providers');

describe('Duplicate Detection Functions', () => {
  let providerFileExists, findExistingProviderFile;

  // Import the CommonJS module dynamically
  beforeEach(async () => {
    const module = await import('../../src/scrape-providers.js');
    providerFileExists = module.providerFileExists;
    findExistingProviderFile = module.findExistingProviderFile;
  });

  describe('providerFileExists()', () => {
    it('should return true for existing provider files', () => {
      // Create a test file
      const testSlug = 'test-provider-exists';
      const testFilePath = path.join(TEST_PROVIDERS_DIR, `${testSlug}.md`);
      
      // Ensure directory exists
      if (!fs.existsSync(TEST_PROVIDERS_DIR)) {
        fs.mkdirSync(TEST_PROVIDERS_DIR, { recursive: true });
      }
      
      // Create test file
      fs.writeFileSync(testFilePath, '# Test Provider\n\nTest content', 'utf-8');
      
      try {
        const exists = providerFileExists(testSlug);
        expect(exists).toBe(true);
      } finally {
        // Cleanup
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should return false for non-existent provider files', () => {
      const nonExistentSlug = 'non-existent-provider-12345';
      const exists = providerFileExists(nonExistentSlug);
      expect(exists).toBe(false);
    });

    it('should handle slugs with special characters', () => {
      const slug = 'provider-with-hyphens';
      const exists = providerFileExists(slug);
      // Should not throw error, just return false
      expect(exists).toBe(false);
    });
  });

  describe('findExistingProviderFile()', () => {
    it('should return file path for existing provider files', () => {
      // Create a test file
      const testSlug = 'test-provider-find';
      const testFilePath = path.join(TEST_PROVIDERS_DIR, `${testSlug}.md`);
      
      // Ensure directory exists
      if (!fs.existsSync(TEST_PROVIDERS_DIR)) {
        fs.mkdirSync(TEST_PROVIDERS_DIR, { recursive: true });
      }
      
      // Create test file
      fs.writeFileSync(testFilePath, '# Test Provider\n\nTest content', 'utf-8');
      
      try {
        const foundPath = findExistingProviderFile(testSlug);
        expect(foundPath).toBe(testFilePath);
        expect(foundPath).toContain(`${testSlug}.md`);
      } finally {
        // Cleanup
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should return null for non-existent provider files', () => {
      const nonExistentSlug = 'non-existent-provider-67890';
      const foundPath = findExistingProviderFile(nonExistentSlug);
      expect(foundPath).toBe(null);
    });

    it('should return correct path format', () => {
      // Create a test file
      const testSlug = 'test-provider-path-format';
      const testFilePath = path.join(TEST_PROVIDERS_DIR, `${testSlug}.md`);
      
      // Ensure directory exists
      if (!fs.existsSync(TEST_PROVIDERS_DIR)) {
        fs.mkdirSync(TEST_PROVIDERS_DIR, { recursive: true });
      }
      
      // Create test file
      fs.writeFileSync(testFilePath, '# Test Provider\n\nTest content', 'utf-8');
      
      try {
        const foundPath = findExistingProviderFile(testSlug);
        expect(foundPath).not.toBe(null);
        expect(path.extname(foundPath)).toBe('.md');
        expect(path.basename(foundPath)).toBe(`${testSlug}.md`);
      } finally {
        // Cleanup
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });
  });
});
