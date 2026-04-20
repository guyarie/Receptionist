const fs = require('fs');
const path = require('path');
const { dataDir } = require('./paths');

/**
 * AvailabilityLoader manages provider availability markdown files.
 * Loads all .md files from a directory and provides them to the AI context.
 */
class AvailabilityLoader {
  constructor(availabilityDir = null) {
    this.availabilityDir = availabilityDir || path.join(dataDir, 'availability');
    this.files = new Map(); // Map<filename, content>
  }

  /**
   * Ensures the availability directory exists, creates it if missing
   */
  ensureDirectory() {
    if (!fs.existsSync(this.availabilityDir)) {
      fs.mkdirSync(this.availabilityDir, { recursive: true });
      console.log(`📁 Created availability directory: ${this.availabilityDir}`);
    }
  }

  /**
   * Loads all .md files from the availability directory into memory
   */
  loadAll() {
    this.ensureDirectory();
    
    try {
      const files = fs.readdirSync(this.availabilityDir);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      
      this.files.clear();
      
      for (const filename of mdFiles) {
        const filePath = path.join(this.availabilityDir, filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        this.files.set(filename, content);
      }
      
      console.log(`📋 Loaded ${this.files.size} availability file(s)`);
    } catch (error) {
      console.error('❌ Error loading availability files:', error.message);
      throw error;
    }
  }

  /**
   * Returns all availability files as a map
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
   * Returns combined availability content as a single string for AI context
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
      const filePath = path.join(this.availabilityDir, filename);
      fs.writeFileSync(filePath, content, 'utf-8');
      this.files.set(filename, content);
      console.log(`💾 Saved availability file: ${filename}`);
    } catch (error) {
      console.error(`❌ Error saving availability file ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Reloads all files from disk
   */
  reload() {
    console.log('🔄 Reloading availability files...');
    this.loadAll();
  }
}

// Export singleton instance
const availabilityLoader = new AvailabilityLoader();
module.exports = availabilityLoader;
