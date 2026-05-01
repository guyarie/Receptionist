// Prompt loader - reads prompts from text files
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { dataDir, promptsDir: repoPromptsDir } = require('./paths');

class PromptLoader {
  constructor() {
    this.dataPromptsDir = path.join(dataDir, 'prompts');
    this.promptsDir = repoPromptsDir;
    this.cache = {};
    this.sources = {};
    this.loadAllPrompts();
  }
  
  /**
   * Resolve a prompt file path. Checks data/prompts/ first (user override),
   * then falls back to prompts/ (repo default).
   * @param {string} filename - The prompt filename
   * @returns {{ filePath: string, source: string }} Resolved path and source label
   */
  resolvePromptPath(filename) {
    const dataPath = path.join(this.dataPromptsDir, filename);
    if (fs.existsSync(dataPath)) {
      return { filePath: dataPath, source: 'data' };
    }
    return { filePath: path.join(this.promptsDir, filename), source: 'default' };
  }

  /**
   * Load all prompt files into memory.
   * For each prompt, checks data/prompts/ first (deployment-specific override),
   * then falls back to prompts/ (repo defaults).
   */
  loadAllPrompts() {
    const files = {
      systemPrompt: 'system-prompt.txt',
      webchatGreeting: 'webchat-greeting.txt',
      scrapingInstructions: 'scraping-instructions.txt',
      postCallAgent: 'post-call-agent.txt',
      dailyDigestAgent: 'daily-digest-agent.txt'
    };
    
    for (const [key, filename] of Object.entries(files)) {
      try {
        const { filePath, source } = this.resolvePromptPath(filename);
        this.cache[key] = this.substituteVars(fs.readFileSync(filePath, 'utf-8').trim());
        this.sources[key] = source;
        const label = source === 'data' ? '✅ Loaded prompt (override)' : '✅ Loaded prompt (default)';
        console.log(`${label}: ${filename}`);
      } catch (error) {
        console.error(`❌ Failed to load ${filename}:`, error.message);
        // Provide fallback defaults
        this.cache[key] = this.getDefaultPrompt(key);
        this.sources[key] = 'fallback';
      }
    }
  }
  
  /**
   * Replace {{VAR}} placeholders with values from config/env.
   */
  substituteVars(text) {
    const vars = {
      BUSINESS_NAME:     config.business.name,
      RECEPTIONIST_NAME: config.business.receptionistName,
      OWNER_NAME:        config.business.ownerName,
      OWNER_PHONE:       config.business.ownerPhone || '[owner phone]',
      PUBLIC_URL:        config.business.publicUrl || '[your domain]',
      ADMIN_EMAIL:       config.adminEmail || '[admin email]',
    };
    for (const [key, value] of Object.entries(vars)) {
      // Match both {{KEY}} and [KEY] formats
      text = text
        .replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
        .replace(new RegExp(`\\[${key}\\]`, 'g'), value);
    }
    return text;
  }

  /**
   * Get default prompts if files are missing
   */
  getDefaultPrompt(key) {
    const defaults = {
      systemPrompt: 'You are a helpful receptionist.',
      webchatGreeting: 'Hello! How can I help you today?',
      scrapingInstructions: 'Extract practice and provider information from the website content.',
      postCallAgent: 'You are a post-call processing agent. Generate a summary of the call.',
      dailyDigestAgent: 'You are a daily digest agent. Compose a summary of today\'s calls.'
    };
    return defaults[key] || '';
  }
  
  /**
   * Reload prompts from disk (useful for live updates)
   */
  reload() {
    console.log('🔄 Reloading prompts...');
    this.loadAllPrompts();
  }
  
  /**
   * Get all prompts with metadata for admin UI
   * @returns {Array} Array of { name, filename, content } objects
   */
  getAll() {
    const promptMap = {
      systemPrompt: { name: 'System Prompt', filename: 'system-prompt.txt' },
      webchatGreeting: { name: 'Webchat Greeting', filename: 'webchat-greeting.txt' },
      scrapingInstructions: { name: 'Scraping Instructions', filename: 'scraping-instructions.txt' },
      postCallAgent: { name: 'Post-Call Agent', filename: 'post-call-agent.txt' },
      dailyDigestAgent: { name: 'Daily Digest Agent', filename: 'daily-digest-agent.txt' }
    };
    
    return Object.entries(promptMap).map(([key, meta]) => ({
      name: meta.name,
      filename: meta.filename,
      content: this.cache[key] || '',
      source: this.sources[key] || 'unknown'
    }));
  }
  
  /**
   * Save a prompt to disk and reload
   * @param {string} filename - The prompt filename (e.g., 'system-prompt.txt')
   * @param {string} content - The new prompt content
   * @throws {Error} If content is empty or whitespace-only
   */
  savePrompt(filename, content) {
    // Validate content is non-empty and non-whitespace
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Prompt content cannot be empty or whitespace-only');
    }
    
    // Always write to data/prompts/ (user override dir), never modify repo defaults
    try {
      if (!fs.existsSync(this.dataPromptsDir)) {
        fs.mkdirSync(this.dataPromptsDir, { recursive: true });
      }
      const filePath = path.join(this.dataPromptsDir, filename);
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`💾 Saved prompt (override): ${filename}`);
      
      // Reload all prompts to update cache
      this.reload();
    } catch (error) {
      console.error(`❌ Failed to save ${filename}:`, error.message);
      throw new Error(`Failed to save prompt: ${error.message}`);
    }
  }
  
  // Getters for each prompt
  get systemPrompt() { return this.cache.systemPrompt; }
  get webchatGreeting() { return this.cache.webchatGreeting; }
  get scrapingInstructions() { return this.cache.scrapingInstructions; }
  get postCallAgent() { return this.cache.postCallAgent; }
  get dailyDigestAgent() { return this.cache.dailyDigestAgent; }
}

module.exports = new PromptLoader();
