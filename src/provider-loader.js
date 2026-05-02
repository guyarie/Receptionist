const fs = require('fs');
const path = require('path');
const { dataDir } = require('./paths');

/**
 * ProviderLoader manages provider profile markdown files.
 * Loads all .md files from a directory and provides them to the AI context.
 */
class ProviderLoader {
  constructor(providerDir = null) {
    this.providerDir = providerDir || path.join(dataDir, 'providers');
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
   * Returns combined provider content as a single string for AI context.
   * Used by the text-chat AI client which has a larger context window.
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
   * Returns a compact provider roster for the OpenAI Realtime session.
   * Keeps startup instructions small; the AI loads full profiles on demand
   * via the get_provider_info tool.
   * @returns {string} One-line-per-provider roster string
   */
  getTrimmedRoster() {
    if (this.files.size === 0) return '';

    const sep = '='.repeat(50);
    const lines = [
      sep,
      'PROVIDER ROSTER (summary only)',
      'For full details on any provider, call get_provider_info.',
      sep,
    ];

    for (const [, content] of this.files.entries()) {
      const name = this._extractName(content);
      const accepting = this._extractAccepting(content);
      const focus = this._extractFocus(content);
      const insurance = this._extractInsurance(content);

      const parts = [`• ${name}`];
      if (accepting) parts.push(`Accepting: ${accepting}`);
      if (focus)     parts.push(`Focus: ${focus}`);
      if (insurance) parts.push(`Insurance: ${insurance}`);
      lines.push(parts.join(' | '));
    }

    lines.push(sep);
    return lines.join('\n');
  }

  /** Extract provider name from the first H1 heading. */
  _extractName(content) {
    const m = content.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : 'Unknown Provider';
  }

  /** Extract accepting-new-clients status. Prefers the structured field, falls back to keyword scan. */
  _extractAccepting(content) {
    const field = content.match(/\*\*Accepting New Clients:\*\*\s*(.+)/i);
    if (field) return field[1].trim();
    const lc = content.toLowerCase();
    if (/not (?:currently )?accepting/i.test(lc)) return 'No';
    if (/currently accepting/i.test(lc))          return 'Yes';
    if (/limited (?:availability|openings)/i.test(lc)) return 'Limited';
    return '';
  }

  /** Extract up to 4 focus/specialty items from common section headings. */
  _extractFocus(content) {
    const sectionRe = /##\s+(?:Areas? of Focus|Specialt(?:y|ies)|Focus Areas?)[^\n]*\n([\s\S]*?)(?=\n##|$)/i;
    const section = content.match(sectionRe);
    if (!section) return '';
    const items = section[1].match(/^[-*•]\s+(.+)$/gm) || [];
    return items.slice(0, 4).map(i => i.replace(/^[-*•]\s+/, '')).join(', ');
  }

  /** Extract a brief insurance summary. */
  _extractInsurance(content) {
    const sectionRe = /##\s+(?:Fees?(?: and Insurance)?|Insurance(?:(?: and)? Fees?)?|Billing)[^\n]*\n([\s\S]*?)(?=\n##|$)/i;
    const section = content.match(sectionRe);
    if (!section) return '';
    const text = section[1];
    const isOutOfNetwork = /out.of.network/i.test(text);
    const isInNetwork    = /in.network/i.test(text);
    const named = text.match(/(?:Aetna|Blue Cross(?:\s*Blue Shield)?|BCBS|Cigna|UnitedHealthcare?|UHC|Anthem|Humana|Kaiser|Medicare|Medicaid|Optum|Oscar)/gi) || [];
    if (named.length > 0) return named.join(', ');
    if (isOutOfNetwork) return 'Out-of-network (superbills)';
    if (isInNetwork)    return 'In-network';
    return '';
  }

  /**
   * Find a provider by fuzzy name match.
   * Returns { filename, content } for the best match, or null.
   * @param {string} query - Name as spoken by caller (e.g. "Dr. Arie", "Miri")
   */
  findByName(query) {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const stopWords = new Set(['dr', 'the', 'and', 'mr', 'ms', 'mrs']);
    const queryWords = normalize(query).split(' ').filter(w => w.length > 1 && !stopWords.has(w));

    if (queryWords.length === 0) return null;

    let bestScore = 0;
    let bestEntry = null;

    for (const [filename, content] of this.files.entries()) {
      const h1 = content.match(/^#\s+(.+)$/m);
      const providerName = h1 ? h1[1] : filename.replace('.md', '').replace(/-/g, ' ');
      const nameWords = normalize(providerName).split(' ').filter(Boolean);

      let hits = 0;
      for (const qw of queryWords) {
        if (nameWords.some(nw => nw === qw || nw.startsWith(qw) || qw.startsWith(nw))) hits++;
      }
      const score = hits / queryWords.length;

      if (score > bestScore) {
        bestScore = score;
        bestEntry = { filename, content, name: this._extractName(content) };
      }
    }

    return bestScore >= 0.5 ? bestEntry : null;
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
