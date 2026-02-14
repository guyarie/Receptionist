// AI Receptionist Chat Widget - Embeddable version
(function() {
  'use strict';
  
  // Configuration
  const config = {
    apiUrl: window.RTCChatConfig?.apiUrl || 'http://localhost:3000',
    position: window.RTCChatConfig?.position || 'bottom-right', // bottom-right, bottom-left
    primaryColor: window.RTCChatConfig?.primaryColor || '#667eea',
    title: window.RTCChatConfig?.title || 'Chat with us'
  };
  
  // Generate unique session ID
  const sessionId = 'web-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  // Create widget HTML
  const widgetHTML = `
    <div id="rtc-chat-widget" style="position: fixed; ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'} bottom: 20px; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Chat Button -->
      <button id="rtc-chat-button" style="
        width: 60px;
        height: 60px;
        border-radius: 30px;
        background: linear-gradient(135deg, ${config.primaryColor} 0%, #764ba2 100%);
        border: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      ">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
      
      <!-- Chat Window -->
      <div id="rtc-chat-window" style="
        display: none;
        position: absolute;
        bottom: 80px;
        ${config.position.includes('right') ? 'right: 0;' : 'left: 0;'}
        width: 380px;
        max-width: calc(100vw - 40px);
        height: 600px;
        max-height: calc(100vh - 120px);
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      ">
        <!-- Header -->
        <div style="
          background: linear-gradient(135deg, ${config.primaryColor} 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div>
            <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">${config.title}</div>
            <div style="font-size: 13px; opacity: 0.9;">Relational Therapy Collective</div>
          </div>
          <button id="rtc-chat-close" style="
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">×</button>
        </div>
        
        <!-- Messages -->
        <div id="rtc-chat-messages" style="
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f7f7f7;
        "></div>
        
        <!-- Input -->
        <div style="
          padding: 15px;
          background: white;
          border-top: 1px solid #e0e0e0;
        ">
          <form id="rtc-chat-form" style="display: flex; gap: 10px;">
            <input 
              type="text" 
              id="rtc-chat-input" 
              placeholder="Type your message..."
              style="
                flex: 1;
                padding: 12px 16px;
                border: 2px solid #e0e0e0;
                border-radius: 24px;
                font-size: 14px;
                outline: none;
              "
            >
            <button type="submit" style="
              background: linear-gradient(135deg, ${config.primaryColor} 0%, #764ba2 100%);
              color: white;
              border: none;
              padding: 12px 20px;
              border-radius: 24px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
            ">Send</button>
          </form>
        </div>
      </div>
    </div>
  `;
  
  // Inject widget into page
  document.addEventListener('DOMContentLoaded', function() {
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
    
    const chatButton = document.getElementById('rtc-chat-button');
    const chatWindow = document.getElementById('rtc-chat-window');
    const chatClose = document.getElementById('rtc-chat-close');
    const chatForm = document.getElementById('rtc-chat-form');
    const chatInput = document.getElementById('rtc-chat-input');
    const chatMessages = document.getElementById('rtc-chat-messages');
    
    let isOpen = false;
    let isLoaded = false;
    
    // Toggle chat window
    chatButton.addEventListener('click', function() {
      isOpen = !isOpen;
      chatWindow.style.display = isOpen ? 'flex' : 'none';
      
      if (isOpen && !isLoaded) {
        loadGreeting();
        isLoaded = true;
      }
      
      if (isOpen) {
        chatInput.focus();
      }
    });
    
    chatClose.addEventListener('click', function() {
      isOpen = false;
      chatWindow.style.display = 'none';
    });
    
    // Load greeting
    async function loadGreeting() {
      try {
        const response = await fetch(config.apiUrl + '/api/greeting');
        const data = await response.json();
        addMessage('ai', data.greeting);
      } catch (error) {
        console.error('Error loading greeting:', error);
        addMessage('ai', 'Hello! How can I help you today?');
      }
    }
    
    // Handle form submission
    chatForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const message = chatInput.value.trim();
      if (!message) return;
      
      addMessage('user', message);
      chatInput.value = '';
      
      const typingIndicator = addTypingIndicator();
      chatInput.disabled = true;
      
      try {
        const response = await fetch(config.apiUrl + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message })
        });
        
        const data = await response.json();
        typingIndicator.remove();
        addMessage('ai', data.response);
      } catch (error) {
        typingIndicator.remove();
        addMessage('ai', 'Sorry, I encountered an error. Please try again.');
        console.error('Error:', error);
      }
      
      chatInput.disabled = false;
      chatInput.focus();
    });
    
    // Add message to chat
    function addMessage(type, content) {
      const messageDiv = document.createElement('div');
      messageDiv.style.cssText = `
        margin-bottom: 15px;
        display: flex;
        ${type === 'user' ? 'justify-content: flex-end;' : ''}
      `;
      
      const bubble = document.createElement('div');
      bubble.style.cssText = `
        max-width: 70%;
        padding: 12px 16px;
        border-radius: 18px;
        line-height: 1.4;
        font-size: 14px;
        ${type === 'ai' 
          ? 'background: white; color: #333; border-bottom-left-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);'
          : 'background: ' + config.primaryColor + '; color: white; border-bottom-right-radius: 4px;'
        }
      `;
      bubble.textContent = content;
      
      messageDiv.appendChild(bubble);
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Add typing indicator
    function addTypingIndicator() {
      const typingDiv = document.createElement('div');
      typingDiv.style.cssText = 'margin-bottom: 15px;';
      typingDiv.innerHTML = `
        <div style="
          display: inline-block;
          padding: 12px 16px;
          background: white;
          border-radius: 18px;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        ">
          <span style="display: inline-block; width: 8px; height: 8px; background: #999; border-radius: 50%; margin-right: 4px; animation: typing 1.4s infinite;"></span>
          <span style="display: inline-block; width: 8px; height: 8px; background: #999; border-radius: 50%; margin-right: 4px; animation: typing 1.4s infinite 0.2s;"></span>
          <span style="display: inline-block; width: 8px; height: 8px; background: #999; border-radius: 50%; animation: typing 1.4s infinite 0.4s;"></span>
        </div>
      `;
      chatMessages.appendChild(typingDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return typingDiv;
    }
    
    // Add typing animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-10px); }
      }
      #rtc-chat-button:hover {
        transform: scale(1.05);
      }
      #rtc-chat-input:focus {
        border-color: ${config.primaryColor};
      }
    `;
    document.head.appendChild(style);
  });
})();
