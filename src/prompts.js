// Prompt loader - reads prompts from text files
const fs = require('fs');
const path = require('path');

class PromptLoader {
  constructor() {
    this.promptsDir = path.join(__dirname, '..', 'prompts');
    this.cache = {};
    this.loadAllPrompts();
  }
  
  /**
   * Load all prompt files into memory
   */
  loadAllPrompts() {
    const files = {
      systemPrompt: 'system-prompt.txt',
      greeting: 'greeting.txt',
      webchatGreeting: 'webchat-greeting.txt',
      followUp: 'follow-up.txt',
      closing: 'closing.txt',
      noSpeechDetected: 'no-speech-detected.txt',
      error: 'error.txt',
      scrapingInstructions: 'scraping-instructions.txt'
    };
    
    for (const [key, filename] of Object.entries(files)) {
      try {
        const filePath = path.join(this.promptsDir, filename);
        this.cache[key] = fs.readFileSync(filePath, 'utf-8').trim();
        console.log(`✅ Loaded prompt: ${filename}`);
      } catch (error) {
        console.error(`❌ Failed to load ${filename}:`, error.message);
        // Provide fallback defaults
        this.cache[key] = this.getDefaultPrompt(key);
      }
    }
  }
  
  /**
   * Get default prompts if files are missing
   */
  getDefaultPrompt(key) {
    const defaults = {
      systemPrompt: 'You are a helpful receptionist.',
      greeting: 'Hello! How can I help you?',
      webchatGreeting: 'Hello! Welcome to our practice. How can I help you today?',
      followUp: 'Is there anything else?',
      closing: 'Thank you for calling!',
      noSpeechDetected: 'I didn\'t catch that. Could you repeat?',
      error: 'I apologize for the technical difficulty.',
      scrapingInstructions: 'Extract practice and provider information from the website content.'
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
      greeting: { name: 'Greeting', filename: 'greeting.txt' },
      webchatGreeting: { name: 'Webchat Greeting', filename: 'webchat-greeting.txt' },
      followUp: { name: 'Follow-up', filename: 'follow-up.txt' },
      closing: { name: 'Closing', filename: 'closing.txt' },
      noSpeechDetected: { name: 'No Speech Detected', filename: 'no-speech-detected.txt' },
      error: { name: 'Error', filename: 'error.txt' },
      scrapingInstructions: { name: 'Scraping Instructions', filename: 'scraping-instructions.txt' }
    };
    
    return Object.entries(promptMap).map(([key, meta]) => ({
      name: meta.name,
      filename: meta.filename,
      content: this.cache[key] || ''
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
    
    // Write to disk
    const filePath = path.join(this.promptsDir, filename);
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`💾 Saved prompt: ${filename}`);
      
      // Reload all prompts to update cache
      this.reload();
    } catch (error) {
      console.error(`❌ Failed to save ${filename}:`, error.message);
      throw new Error(`Failed to save prompt: ${error.message}`);
    }
  }
  
  // Getters for each prompt
  get systemPrompt() { return this.cache.systemPrompt; }
  get greeting() { return this.cache.greeting; }
  get webchatGreeting() { return this.cache.webchatGreeting; }
  get followUp() { return this.cache.followUp; }
  get closing() { return this.cache.closing; }
  get noSpeechDetected() { return this.cache.noSpeechDetected; }
  get error() { return this.cache.error; }
  get scrapingInstructions() { return this.cache.scrapingInstructions; }
}

module.exports = new PromptLoader();
