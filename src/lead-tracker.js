// Lead Tracker - Detects and stores qualified leads from webchat conversations
const fs = require('fs');
const path = require('path');

class LeadTracker {
  constructor() {
    this.leadsDir = path.join(__dirname, '..', 'leads');
    this.leadsFile = path.join(this.leadsDir, 'leads.json');
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    if (!fs.existsSync(this.leadsDir)) {
      fs.mkdirSync(this.leadsDir, { recursive: true });
    }
  }

  /**
   * Extract contact info from conversation messages
   */
  extractContactInfo(messages) {
    const allText = messages.map(m => m.content).join('\n');
    
    // Phone patterns
    const phonePatterns = [
      /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      /\+1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g
    ];
    
    // Email pattern
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    // Name detection - look for patterns like "my name is X", "I'm X", "this is X"
    const namePatterns = [
      /(?:my name is|i'm|i am|this is|name:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:here|speaking)/gi
    ];

    let phone = null;
    let email = null;
    let name = null;

    // Extract from user messages only
    const userText = messages.filter(m => m.role === 'user').map(m => m.content).join('\n');

    for (const pattern of phonePatterns) {
      const match = userText.match(pattern);
      if (match) {
        phone = match[0].replace(/[^\d+]/g, '');
        if (phone.length === 10) phone = '+1' + phone;
        break;
      }
    }

    const emailMatch = userText.match(emailPattern);
    if (emailMatch) email = emailMatch[0];

    for (const pattern of namePatterns) {
      const match = pattern.exec(userText);
      if (match) {
        name = match[1].trim();
        break;
      }
    }

    return { name, phone, email };
  }

  /**
   * Determine if this is a test session
   */
  isTestSession(sessionId) {
    if (!sessionId) return true;
    return sessionId.startsWith('test-') || 
           sessionId.startsWith('web-session-') ||
           sessionId.startsWith('regression-');
  }

  /**
   * Check if we already tracked this session
   */
  isAlreadyTracked(sessionId) {
    const leads = this.getLeads();
    return leads.some(l => l.sessionId === sessionId);
  }

  /**
   * Process a webchat conversation for lead info
   * Returns lead object if new qualified lead found, null otherwise
   */
  processConversation(sessionId, messages) {
    if (this.isTestSession(sessionId)) return null;
    
    const contact = this.extractContactInfo(messages);
    
    // Need at least a phone number or email to qualify
    if (!contact.phone && !contact.email) return null;
    
    // Check if already tracked with same contact info
    const leads = this.getLeads();
    const existing = leads.find(l => l.sessionId === sessionId);
    if (existing) {
      // Update if we got new info
      let updated = false;
      if (contact.name && !existing.name) { existing.name = contact.name; updated = true; }
      if (contact.phone && !existing.phone) { existing.phone = contact.phone; updated = true; }
      if (contact.email && !existing.email) { existing.email = contact.email; updated = true; }
      existing.messageCount = messages.length;
      existing.lastUpdated = new Date().toISOString();
      if (updated) {
        this.saveLeads(leads);
        return { ...existing, isUpdate: true };
      }
      return null; // No new info
    }

    // New lead
    const lead = {
      sessionId,
      name: contact.name || null,
      phone: contact.phone || null,
      email: contact.email || null,
      messageCount: messages.length,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      notified: false
    };

    leads.push(lead);
    this.saveLeads(leads);
    console.log(`🎯 New lead detected: ${contact.name || 'Unknown'} - ${contact.phone || contact.email}`);
    return lead;
  }

  /**
   * Get all leads
   */
  getLeads() {
    try {
      if (!fs.existsSync(this.leadsFile)) return [];
      return JSON.parse(fs.readFileSync(this.leadsFile, 'utf-8'));
    } catch {
      return [];
    }
  }

  /**
   * Get unnotified leads
   */
  getUnnotifiedLeads() {
    return this.getLeads().filter(l => !l.notified);
  }

  /**
   * Mark leads as notified
   */
  markNotified(sessionIds) {
    const leads = this.getLeads();
    for (const lead of leads) {
      if (sessionIds.includes(lead.sessionId)) {
        lead.notified = true;
      }
    }
    this.saveLeads(leads);
  }

  saveLeads(leads) {
    fs.writeFileSync(this.leadsFile, JSON.stringify(leads, null, 2));
  }
}

module.exports = new LeadTracker();
