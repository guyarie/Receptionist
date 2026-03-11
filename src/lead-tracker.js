// Lead Tracker - Detects and stores qualified leads from webchat conversations
const fs = require('fs');
const path = require('path');
const https = require('https');

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
      /(?:my name is|i'm|i am|this is|name:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s|,|\.|\!|$)/gi,
      /(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:here|speaking)/gi
    ];
    const stopWords = ['and', 'in', 'from', 'at', 'the', 'a', 'my', 'i', 'we', 'or', 'but', 'so', 'looking', 'need', 'want', 'have', 'got'];

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
        let candidate = match[1].trim();
        // Remove trailing stop words
        const parts = candidate.split(/\s+/);
        while (parts.length > 1 && stopWords.includes(parts[parts.length - 1].toLowerCase())) {
          parts.pop();
        }
        candidate = parts.join(' ');
        if (candidate.length >= 2 && !stopWords.includes(candidate.toLowerCase())) {
          name = candidate;
          break;
        }
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
        this.sendTelegramAlert(existing);
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
    
    // Instant push notification
    this.sendTelegramAlert(lead);
    
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

  /**
   * Send instant Telegram notification for new lead
   */
  sendTelegramAlert(lead) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const threadId = process.env.TELEGRAM_THREAD_ID;
    
    if (!botToken || !chatId) {
      console.log('⚠️ Telegram notifications not configured (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)');
      return;
    }

    const name = lead.name || 'Unknown';
    const phone = lead.phone || 'not provided';
    const email = lead.email || 'not provided';
    const msgs = lead.messageCount || 0;
    const time = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: true });

    let text = `🎯 *New Lead from David!*\n\n`;
    text += `👤 *Name:* ${name}\n`;
    text += `📱 *Phone:* ${phone}\n`;
    text += `📧 *Email:* ${email}\n`;
    text += `💬 *Messages:* ${msgs}\n`;
    text += `🕐 *Time:* ${time} PT\n\n`;
    text += `[View in Admin](https://receptionist.chargewizards.com/admin/leads.html)`;

    const payload = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      message_thread_id: threadId ? parseInt(threadId) : undefined,
      disable_web_page_preview: true
    });

    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`📨 Telegram alert sent for lead: ${name} (${phone})`);
        } else {
          console.error(`❌ Telegram alert failed: ${res.statusCode} - ${data}`);
        }
      });
    });
    req.on('error', (e) => console.error('❌ Telegram alert error:', e.message));
    req.write(payload);
    req.end();
  }

  saveLeads(leads) {
    fs.writeFileSync(this.leadsFile, JSON.stringify(leads, null, 2));
  }
}

module.exports = new LeadTracker();
