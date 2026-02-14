import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Prompts Module', () => {
  let prompts;
  const testPromptsDir = path.join(__dirname, '..', '..', 'prompts');
  const testFilename = 'greeting.txt';
  const testFilePath = path.join(testPromptsDir, testFilename);
  let originalContent;

  beforeEach(async () => {
    // Store original content
    if (fs.existsSync(testFilePath)) {
      originalContent = fs.readFileSync(testFilePath, 'utf-8');
    }
    
    // Dynamic import to get fresh instance
    const module = await import('../../src/prompts.js?update=' + Date.now());
    prompts = module.default;
  });

  afterEach(() => {
    // Restore original content
    if (originalContent !== undefined) {
      fs.writeFileSync(testFilePath, originalContent, 'utf-8');
    }
  });

  describe('getAll()', () => {
    it('should return array of prompt objects with name, filename, and content', () => {
      const allPrompts = prompts.getAll();
      
      expect(Array.isArray(allPrompts)).toBe(true);
      expect(allPrompts.length).toBeGreaterThan(0);
      
      allPrompts.forEach(prompt => {
        expect(prompt).toHaveProperty('name');
        expect(prompt).toHaveProperty('filename');
        expect(prompt).toHaveProperty('content');
        expect(typeof prompt.name).toBe('string');
        expect(typeof prompt.filename).toBe('string');
        expect(typeof prompt.content).toBe('string');
      });
    });

    it('should include all expected prompt files', () => {
      const allPrompts = prompts.getAll();
      const filenames = allPrompts.map(p => p.filename);
      
      expect(filenames).toContain('system-prompt.txt');
      expect(filenames).toContain('greeting.txt');
      expect(filenames).toContain('follow-up.txt');
      expect(filenames).toContain('closing.txt');
      expect(filenames).toContain('no-speech-detected.txt');
      expect(filenames).toContain('error.txt');
    });
  });

  describe('savePrompt()', () => {
    it('should save valid content and reload', () => {
      const newContent = 'Test greeting content';
      
      prompts.savePrompt(testFilename, newContent);
      
      const savedContent = fs.readFileSync(testFilePath, 'utf-8');
      expect(savedContent).toBe(newContent);
      
      // Verify it's in the cache
      const allPrompts = prompts.getAll();
      const greetingPrompt = allPrompts.find(p => p.filename === testFilename);
      expect(greetingPrompt.content).toBe(newContent.trim());
    });

    it('should reject empty string', () => {
      expect(() => {
        prompts.savePrompt(testFilename, '');
      }).toThrow('Prompt content cannot be empty or whitespace-only');
    });

    it('should reject whitespace-only content', () => {
      expect(() => {
        prompts.savePrompt(testFilename, '   \n\t  ');
      }).toThrow('Prompt content cannot be empty or whitespace-only');
    });

    it('should reject null content', () => {
      expect(() => {
        prompts.savePrompt(testFilename, null);
      }).toThrow('Prompt content cannot be empty or whitespace-only');
    });

    it('should reject undefined content', () => {
      expect(() => {
        prompts.savePrompt(testFilename, undefined);
      }).toThrow('Prompt content cannot be empty or whitespace-only');
    });
  });
});
