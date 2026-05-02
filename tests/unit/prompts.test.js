import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Prompts Module', () => {
  let prompts;
  const testFilename = 'webchat-greeting.txt';
  // savePrompt() writes to the install-specific data/prompts/ override dir
  const dataPromptsDir = path.resolve(process.env.INSTALL_DIR || 'installs/dev', 'data', 'prompts');
  const overrideFilePath = path.join(dataPromptsDir, testFilename);
  let originalOverrideContent;
  let overrideExisted;

  beforeEach(async () => {
    // Store original override content if it exists
    overrideExisted = fs.existsSync(overrideFilePath);
    if (overrideExisted) {
      originalOverrideContent = fs.readFileSync(overrideFilePath, 'utf-8');
    }
    
    // Dynamic import to get fresh instance
    const module = await import('../../src/prompts.js?update=' + Date.now());
    prompts = module.default;
  });

  afterEach(() => {
    // Restore or remove the override file
    if (overrideExisted) {
      fs.writeFileSync(overrideFilePath, originalOverrideContent, 'utf-8');
    } else if (fs.existsSync(overrideFilePath)) {
      fs.unlinkSync(overrideFilePath);
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
      expect(filenames).toContain('webchat-greeting.txt');
      expect(filenames).toContain('scraping-instructions.txt');
      expect(filenames).toContain('post-call-agent.txt');
      expect(filenames).toContain('daily-digest-agent.txt');
    });
  });

  describe('savePrompt()', () => {
    it('should save valid content and reload', () => {
      const newContent = 'Test greeting content';
      
      prompts.savePrompt(testFilename, newContent);
      
      // savePrompt writes to data/prompts/ (override dir)
      const savedContent = fs.readFileSync(overrideFilePath, 'utf-8');
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
