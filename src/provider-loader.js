const fs = require('fs');
const path = require('path');

/**
 * ProviderLoader manages provider profile markdown files.
 * Loads all .md files from a directory and provides them to the AI context.
 */
class ProviderLoader {
  constructor(providerDir = null) {
    this.providerDir = providerDir || path.join(__dirname, '..', 'data', 'providers');
    this.files = new Map(); // Map<filename, content>
  }

  /**
   * Ensures the provider directory exists, creates it if missing
   */
  ensureDirectory() {
    if (!fs.existsSync(this.providerDir)) {
      fs.mkdirSync(this.providerDir, { recursive: true });
      console.log(`📁 Created provider directory: ${this.providerDir}`);
    }
  }

  /**
   * Loads all .md files from the provider directory into memory
   */
  loadAll() {
    this.ensureDirectory();
    
    try {
      const files = fs.readdirSync(this.providerDir);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      
      this.files.clear();
      
      for (const filename of mdFiles) {
        const filePath = path.join(this.providerDir, filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        this.files.set(filename, content);
      }
      
      console.log(`📋 Loaded ${this.files.size} provider profile(s)`);
    } catch (error) {
      console.error('❌ Error loading provider files:', error.message);
      throw error;
    }
  }

  /**
   * Returns all provider files as a map
   * @returns {Object} Map of filename to content
   */
  getAll() {
    const result = {};
    for (const [filename, content] of this.files.entries()) {
      result[filename] = content;
    }
    return result;
  }

  /**
   * Returns combined provider content as a single string for AI context
   * @returns {string} Combined markdown content
   */
  getAIContext() {
    if (this.files.size === 0) {
      return '';
    }
    
    const sections = [];
    for (const [filename, content] of this.files.entries()) {
      sections.push(`## ${filename}\n\n${content}`);
    }
    
    return sections.join('\n\n---\n\n');
  }

  /**
   * Gets content of a specific file
   * @param {string} filename - Name of the file to retrieve
   * @returns {string|null} File content or null if not found
   */
  getFile(filename) {
    return this.files.get(filename) || null;
  }

  /**
   * Saves content to a file and updates in-memory map
   * @param {string} filename - Name of the file to save
   * @param {string} content - Content to write
   */
  saveFile(filename, content) {
    this.ensureDirectory();
    
    try {
      const filePath = path.join(this.providerDir, filename);
      fs.writeFileSync(filePath, content, 'utf-8');
      this.files.set(filename, content);
      console.log(`💾 Saved provider file: ${filename}`);
    } catch (error) {
      console.error(`❌ Error saving provider file ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Reloads all files from disk
   */
  reload() {
    console.log('🔄 Reloading provider files...');
    this.loadAll();
  }
}

// Export singleton instance
const providerLoader = new ProviderLoader();
module.exports = providerLoader;
