// Website scraper - fetches and parses RTC website content
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class WebsiteScraper {
  constructor(websiteUrl) {
    this.websiteUrl = websiteUrl;
    this.data = {
      lastUpdated: null,
      practiceInfo: {},
      clinicians: [],
      services: [],
      insurance: [],
      rawContent: ''
    };
    this.cacheFile = path.join(__dirname, '..', 'data', 'practice', 'website-cache.json');
  }
  
  /**
   * Fetch and parse website content
   */
  async scrape() {
    try {
      console.log(`🌐 Fetching website: ${this.websiteUrl}`);
      
      const response = await axios.get(this.websiteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract practice information
      this.extractPracticeInfo($);
      
      // Extract clinician information
      this.extractClinicians($);
      
      // Extract all text content for AI context
      this.extractRawContent($);
      
      // Save timestamp
      this.data.lastUpdated = new Date().toISOString();
      
      // Cache the data
      this.saveCache();
      
      console.log(`✅ Website scraped successfully`);
      console.log(`   - Clinicians found: ${this.data.clinicians.length}`);
      console.log(`   - Practice info extracted`);
      
      return this.data;
      
    } catch (error) {
      console.error('❌ Error scraping website:', error.message);
      
      // Try to load from cache
      if (this.loadCache()) {
        console.log('📦 Using cached website data');
        return this.data;
      }
      
      throw error;
    }
  }
  
  /**
   * Extract practice information
   */
  extractPracticeInfo($) {
    // Extract main description
    const description = $('p').first().text().trim();
    
    this.data.practiceInfo = {
      name: 'Relational Therapy Collective',
      shortName: 'RTC',
      description: description || 'A collaborative group of clinicians serving clients through all stages of life.',
      location: 'Bellevue, WA',
      website: this.websiteUrl,
      approach: 'Relational, evidence-based, trauma-informed care'
    };
  }
  
  /**
   * Extract clinician information
   */
  extractClinicians($) {
    const clinicians = [];
    
    // Look for clinician sections
    $('h3, h4').each((i, elem) => {
      const name = $(elem).text().trim();
      
      // Check if this looks like a clinician name (has comma or PhD/LMFT/etc)
      if (name.includes(',') || /PhD|LMFT|LCSW|LMHC|PsyD|MD|NP/i.test(name)) {
        const clinician = {
          name: name,
          specialties: [],
          services: [],
          contact: {}
        };
        
        // Get the description (next paragraph or div)
        let description = $(elem).next('p, div').text().trim();
        
        // Extract specialties from description
        if (description.toLowerCase().includes('anxiety')) {
          clinician.specialties.push('anxiety');
        }
        if (description.toLowerCase().includes('trauma')) {
          clinician.specialties.push('trauma');
        }
        if (description.toLowerCase().includes('couples')) {
          clinician.specialties.push('couples therapy');
        }
        if (description.toLowerCase().includes('family')) {
          clinician.specialties.push('family therapy');
        }
        if (description.toLowerCase().includes('child')) {
          clinician.specialties.push('child therapy');
        }
        if (description.toLowerCase().includes('adolescent')) {
          clinician.specialties.push('adolescent therapy');
        }
        if (description.toLowerCase().includes('group')) {
          clinician.specialties.push('group therapy');
        }
        
        // Extract contact info
        const emailMatch = description.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
          clinician.contact.email = emailMatch[1];
        }
        
        const phoneMatch = description.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        if (phoneMatch) {
          clinician.contact.phone = phoneMatch[0];
        }
        
        const websiteMatch = description.match(/(https?:\/\/[^\s]+)/);
        if (websiteMatch) {
          clinician.contact.website = websiteMatch[1];
        }
        
        clinician.description = description;
        
        clinicians.push(clinician);
      }
    });
    
    this.data.clinicians = clinicians;
  }
  
  /**
   * Extract all text content for AI context
   */
  extractRawContent($) {
    // Remove script and style elements
    $('script, style, nav, footer').remove();
    
    // Get all text content
    const text = $('body').text()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
    
    this.data.rawContent = text;
  }
  
  /**
   * Save data to cache file
   */
  saveCache() {
    try {
      const dataDir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.data, null, 2));
      console.log('💾 Website data cached');
    } catch (error) {
      console.error('❌ Error saving cache:', error.message);
    }
  }
  
  /**
   * Load data from cache file
   */
  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cached = fs.readFileSync(this.cacheFile, 'utf-8');
        this.data = JSON.parse(cached);
        return true;
      }
    } catch (error) {
      console.error('❌ Error loading cache:', error.message);
    }
    return false;
  }
  
  /**
   * Get formatted data for AI context
   */
  getAIContext() {
    const context = [];
    
    // Practice info
    context.push(`Practice: ${this.data.practiceInfo.name} (${this.data.practiceInfo.shortName})`);
    context.push(`Location: ${this.data.practiceInfo.location}`);
    context.push(`Approach: ${this.data.practiceInfo.approach}`);
    context.push(`\nAbout: ${this.data.practiceInfo.description}`);
    
    // Load custom info (address, hours, etc.)
    try {
      const customInfoPath = path.join(__dirname, '..', 'data', 'practice', 'custom-info.json');
      if (fs.existsSync(customInfoPath)) {
        const customInfo = JSON.parse(fs.readFileSync(customInfoPath, 'utf-8'));
        
        if (customInfo.address) {
          context.push(`\nAddress: ${customInfo.address.full}`);
        }
        
        if (customInfo.hours) {
          context.push(`Hours: ${customInfo.hours.note}`);
        }
        
        if (customInfo.parking) {
          context.push(`Parking: ${customInfo.parking.note}`);
        }
        
        if (customInfo.additionalInfo && customInfo.additionalInfo.length > 0) {
          context.push(`\nAdditional Information:`);
          customInfo.additionalInfo.forEach(info => {
            context.push(`- ${info}`);
          });
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not load custom info:', error.message);
    }
    
    // Add full raw content which includes all clinician details
    if (this.data.rawContent) {
      context.push(`\n\nFULL PRACTICE INFORMATION:`);
      context.push(this.data.rawContent);
    }
    
    return context.join('\n');
  }
  
  /**
   * Get data
   */
  getData() {
    return this.data;
  }
}

module.exports = WebsiteScraper;
