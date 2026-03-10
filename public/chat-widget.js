// AI Receptionist Chat Widget - Embeddable version
// MIT Licensed - No external dependencies required
(function () {
  'use strict';

  // ─── Configuration ────────────────────────────────────────────────────────
  const config = {
    apiUrl: (window.RTCChatConfig && window.RTCChatConfig.apiUrl) || 'http://localhost:3000',
    position: (window.RTCChatConfig && window.RTCChatConfig.position) || 'bottom-right',
    primaryColor: (window.RTCChatConfig && window.RTCChatConfig.primaryColor) || '#667eea',
    title: (window.RTCChatConfig && window.RTCChatConfig.title) || 'Chat with us',
    subtitle: (window.RTCChatConfig && window.RTCChatConfig.subtitle) || 'ChargeWizards'
  };

  // ─── Storage Keys ─────────────────────────────────────────────────────────
  // PRIVACY NOTE: For privacy, we do NOT persist chat history
  // to localStorage. Each session is ephemeral and cleared when the widget closes.

  // ─── Session ID ───────────────────────────────────────────────────────────
  /**
   * Generate a RFC4122 v4 UUID without external dependencies.
   * @returns {string}
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate a new session ID for each widget instance.
   * PRIVACY: Does NOT persist to localStorage - generates fresh ID each time.
   * @returns {string}
   */
  function getOrCreateSessionId() {
    return generateUUID();
  }

  // ─── Conversation History ─────────────────────────────────────────────────
  // PRIVACY: No localStorage persistence - history only exists in memory during session

  // ─── API ──────────────────────────────────────────────────────────────────
  /**
   * Send the full conversation history to /api/webchat and return the
   * assistant's reply text.
   * @param {string} sessionId
   * @param {Array<{role: string, content: string}>} messages
   * @returns {Promise<string>}
   */
  async function sendToAPI(sessionId, messages) {
    const response = await fetch(config.apiUrl + '/api/webchat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, messages: messages })
    });

    if (!response.ok) {
      throw new Error('Server responded with status ' + response.status);
    }

    const data = await response.json();

    // Support both {response: "..."} and {message: "..."} shapes
    const reply = data.response || data.message;
    if (typeof reply !== 'string') {
      throw new Error('Unexpected response format from server');
    }
    return reply;
  }

  // ─── Widget HTML ──────────────────────────────────────────────────────────
  const isRight = config.position.includes('right');
  const positionStyle = isRight ? 'right: 20px;' : 'left: 20px;';
  const windowAlignStyle = isRight ? 'right: 0;' : 'left: 0;';

  const widgetHTML = `
    <div id="rtc-chat-widget" style="position:fixed;${positionStyle}bottom:20px;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

      <!-- Floating bubble button -->
      <button id="rtc-chat-button" aria-label="Open chat" style="
        width:60px;height:60px;border-radius:30px;
        background:linear-gradient(135deg,${config.primaryColor} 0%,#764ba2 100%);
        border:none;box-shadow:0 4px 12px rgba(0,0,0,0.2);
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        transition:transform 0.2s;
      ">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>

      <!-- Chat panel -->
      <div id="rtc-chat-window" role="dialog" aria-label="Chat window" style="
        display:none;flex-direction:column;
        position:absolute;bottom:80px;${windowAlignStyle}
        width:380px;max-width:calc(100vw - 40px);
        height:600px;max-height:calc(100vh - 120px);
        background:white;border-radius:12px;
        box-shadow:0 10px 40px rgba(0,0,0,0.2);overflow:hidden;
      ">
        <!-- Header -->
        <div style="
          background:linear-gradient(135deg,${config.primaryColor} 0%,#764ba2 100%);
          color:white;padding:20px;
          display:flex;justify-content:space-between;align-items:center;
          flex-shrink:0;
        ">
          <div>
            <div style="font-size:18px;font-weight:600;margin-bottom:4px;">${config.title}</div>
            <div style="font-size:13px;opacity:0.9;">${config.subtitle}</div>
          </div>
          <button id="rtc-chat-close" aria-label="Close chat" style="
            background:none;border:none;color:white;font-size:24px;
            cursor:pointer;padding:0;width:30px;height:30px;
            display:flex;align-items:center;justify-content:center;
          ">×</button>
        </div>

        <!-- Messages -->
        <div id="rtc-chat-messages" aria-live="polite" style="
          flex:1;overflow-y:auto;padding:20px;background:#f7f7f7;
        "></div>

        <!-- Input area -->
        <div style="padding:15px;background:white;border-top:1px solid #e0e0e0;flex-shrink:0;">
          <form id="rtc-chat-form" style="display:flex;gap:10px;">
            <input
              type="text"
              id="rtc-chat-input"
              placeholder="Type your message..."
              autocomplete="off"
              style="
                flex:1;padding:12px 16px;
                border:2px solid #e0e0e0;border-radius:24px;
                font-size:14px;outline:none;
              "
            >
            <button type="submit" id="rtc-chat-send" style="
              background:linear-gradient(135deg,${config.primaryColor} 0%,#764ba2 100%);
              color:white;border:none;padding:12px 20px;
              border-radius:24px;font-size:14px;font-weight:600;cursor:pointer;
            ">Send</button>
          </form>
        </div>
      </div>
    </div>
  `;

  // ─── Styles ───────────────────────────────────────────────────────────────
  const widgetStyles = `
    @keyframes rtc-typing {
      0%,60%,100% { transform:translateY(0); }
      30%          { transform:translateY(-8px); }
    }
    #rtc-chat-button:hover { transform:scale(1.05); }
    #rtc-chat-input:focus  { border-color:${config.primaryColor} !important; }
    #rtc-chat-send:hover   { opacity:0.9; }
    #rtc-chat-messages::-webkit-scrollbar { width:6px; }
    #rtc-chat-messages::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
  `;

  // ─── Bootstrap ────────────────────────────────────────────────────────────
  function init() {
    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = widgetStyles;
    document.head.appendChild(styleEl);

    // Inject widget markup
    document.body.insertAdjacentHTML('beforeend', widgetHTML);

    // Element references
    const chatButton   = document.getElementById('rtc-chat-button');
    const chatWindow   = document.getElementById('rtc-chat-window');
    const chatClose    = document.getElementById('rtc-chat-close');
    const chatForm     = document.getElementById('rtc-chat-form');
    const chatInput    = document.getElementById('rtc-chat-input');
    const chatMessages = document.getElementById('rtc-chat-messages');

    // State
    const sessionId = getOrCreateSessionId();
    let conversationHistory = []; // PRIVACY: In-memory only, not persisted
    let isOpen = false;
    let isBusy = false;

    // ── Render persisted history on first open ──────────────────────────────
    // PRIVACY: No history to render - each session starts fresh

    // ── Toggle panel ────────────────────────────────────────────────────────
    function openChat() {
      isOpen = true;
      chatWindow.style.display = 'flex';
      chatButton.setAttribute('aria-expanded', 'true');

      // Always fetch greeting on first open since we don't persist history
      if (conversationHistory.length === 0) {
        fetchGreeting();
      }

      chatInput.focus();
    }

    function closeChat() {
      isOpen = false;
      chatWindow.style.display = 'none';
      chatButton.setAttribute('aria-expanded', 'false');
    }

    chatButton.addEventListener('click', function () {
      if (isOpen) {
        closeChat();
      } else {
        openChat();
      }
    });

    chatClose.addEventListener('click', closeChat);

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeChat();
    });

    // ── Greeting ────────────────────────────────────────────────────────────
    async function fetchGreeting() {
      try {
        const response = await fetch(config.apiUrl + '/api/greeting');
        if (!response.ok) throw new Error('Greeting fetch failed');
        const data = await response.json();
        const greetingText = data.greeting || 'Hello! How can I help you today?';
        conversationHistory.push({ role: 'assistant', content: greetingText }); // In-memory only
        renderMessage('ai', greetingText);
      } catch (e) {
        const fallback = 'Hello! How can I help you today?';
        conversationHistory.push({ role: 'assistant', content: fallback }); // In-memory only
        renderMessage('ai', fallback);
      }
    }

    // ── Form submit ─────────────────────────────────────────────────────────
    chatForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (isBusy) return;

      const text = chatInput.value.trim();
      if (!text) return;

      // Add to in-memory history and render
      conversationHistory.push({ role: 'user', content: text });
      renderMessage('user', text);
      chatInput.value = '';

      // Show typing indicator
      isBusy = true;
      chatInput.disabled = true;
      const typingEl = renderTypingIndicator();

      try {
        const reply = await sendToAPI(sessionId, conversationHistory);
        typingEl.remove();
        conversationHistory.push({ role: 'assistant', content: reply }); // In-memory only
        renderMessage('ai', reply);
      } catch (err) {
        typingEl.remove();
        const errMsg = 'Sorry, something went wrong. Please try again.';
        renderMessage('ai', errMsg);
        console.error('[ChatWidget] API error:', err);
      } finally {
        isBusy = false;
        chatInput.disabled = false;
        chatInput.focus();
      }
    });

    // ── DOM helpers ─────────────────────────────────────────────────────────
    /**
     * Render a single chat bubble.
     * @param {'user'|'ai'} type
     * @param {string} content
     */
    function renderMessage(type, content) {
      const row = document.createElement('div');
      row.style.cssText = [
        'margin-bottom:15px;',
        'display:flex;',
        type === 'user' ? 'justify-content:flex-end;' : ''
      ].join('');

      const bubble = document.createElement('div');
      bubble.style.cssText = [
        'max-width:75%;',
        'padding:12px 16px;',
        'border-radius:18px;',
        'line-height:1.5;',
        'font-size:14px;',
        'word-wrap:break-word;',
        type === 'ai'
          ? 'background:white;color:#333;border-bottom-left-radius:4px;box-shadow:0 2px 5px rgba(0,0,0,0.08);'
          : 'background:' + config.primaryColor + ';color:white;border-bottom-right-radius:4px;'
      ].join('');

      // Use textContent to prevent XSS
      bubble.textContent = content;

      row.appendChild(bubble);
      chatMessages.appendChild(row);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return row;
    }

    /**
     * Render an animated typing indicator and return its element.
     * @returns {HTMLElement}
     */
    function renderTypingIndicator() {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'margin-bottom:15px;';
      wrapper.setAttribute('aria-label', 'Assistant is typing');

      const bubble = document.createElement('div');
      bubble.style.cssText = [
        'display:inline-block;',
        'padding:12px 16px;',
        'background:white;',
        'border-radius:18px;',
        'border-bottom-left-radius:4px;',
        'box-shadow:0 2px 5px rgba(0,0,0,0.08);'
      ].join('');

      [0, 0.2, 0.4].forEach(function (delay) {
        const dot = document.createElement('span');
        dot.style.cssText = [
          'display:inline-block;',
          'width:8px;height:8px;',
          'background:#aaa;',
          'border-radius:50%;',
          'margin-right:4px;',
          'animation:rtc-typing 1.4s infinite ' + delay + 's;'
        ].join('');
        bubble.appendChild(dot);
      });

      wrapper.appendChild(bubble);
      chatMessages.appendChild(wrapper);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return wrapper;
    }

    // PRIVACY: No history rendering - each session starts fresh
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Public API (for testing) ─────────────────────────────────────────────
  // PRIVACY: Removed localStorage functions - no persistent storage
  window._RTCChatWidget = {
    generateUUID: generateUUID,
    getOrCreateSessionId: getOrCreateSessionId,
    sendToAPI: sendToAPI
  };

})();
