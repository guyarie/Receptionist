// ChargeWizards Chat Widget — Embeddable on any site
// Usage: <script src="https://receptionist.chargewizards.com/chat-widget.js"></script>
(function () {
  'use strict';
  var cfg = window.ChargeWizardsChatConfig || {};
  var API_URL = cfg.apiUrl || 'https://receptionist.chargewizards.com';
  var PRIMARY = cfg.primaryColor || '#1a73e8';
  var ACCENT = cfg.accentColor || '#0d5bba';
  var TITLE = cfg.title || 'David';
  var SUBTITLE = cfg.subtitle || 'EV Charging Specialist';
  var POSITION = cfg.position || 'bottom-right';
  var isRight = POSITION.includes('right');

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  async function callAPI(sessionId, messages) {
    var res = await fetch(API_URL + '/api/webchat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, messages: messages })
    });
    if (!res.ok) throw new Error('Server error ' + res.status);
    var data = await res.json();
    var reply = data.response || data.message;
    if (typeof reply !== 'string') throw new Error('Bad response format');
    return reply;
  }

  async function uploadFiles(files, sessionId) {
    var formData = new FormData();
    formData.append('sessionId', sessionId);
    for (var i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    var res = await fetch(API_URL + '/api/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    var data = await res.json();
    return data.files || [];
  }

  function init() {
    // Styles
    var style = document.createElement('style');
    style.textContent = [
      '@keyframes cw-typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}',
      '#cw-chat-btn:hover{transform:scale(1.08)!important}',
      '#cw-chat-input:focus{border-color:' + PRIMARY + '!important}',
      '#cw-chat-messages::-webkit-scrollbar{width:5px}',
      '#cw-chat-messages::-webkit-scrollbar-thumb{background:#ccc;border-radius:3px}',
      '.cw-photo-btn{cursor:pointer;padding:6px 8px;display:flex;align-items:center;border-radius:50%;transition:all 0.15s;color:' + PRIMARY + ';opacity:0.7;}',
      '.cw-photo-btn:hover{opacity:1;background:rgba(26,115,232,0.1);}',
      '.cw-photo-btn svg{width:22px;height:22px;}',
      '.cw-upload-preview{display:flex;gap:8px;padding:0 12px 8px;flex-wrap:wrap;}',
      '.cw-upload-preview:empty{display:none;}',
      '.cw-preview-item{position:relative;width:56px;height:56px;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;}',
      '.cw-preview-item img{width:100%;height:100%;object-fit:cover;}',
      '.cw-preview-remove{position:absolute;top:-3px;right:-3px;background:#424245;color:white;border:2px solid white;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
      '.cw-message-images{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}',
      '.cw-message-images img{max-width:140px;max-height:110px;border-radius:10px;cursor:pointer;}',
      '@media(max-width:420px){#cw-chat-window{width:100vw!important;height:100%!important;max-height:100%!important;bottom:0!important;top:0!important;left:0!important;right:0!important;border-radius:0!important;position:fixed!important;}#cw-chat-btn{z-index:99998!important;}}'
    ].join('\n');
    document.head.appendChild(style);

    // Auto-open on contact page
    var isContactPage = window.location.pathname.toLowerCase().indexOf('contact') !== -1 ||
                        window.location.href.toLowerCase().indexOf('contact') !== -1;

    // Container
    var container = document.createElement('div');
    container.id = 'cw-chat-widget';
    container.style.cssText = 'position:fixed;' + (isRight ? 'right:20px' : 'left:20px') +
      ';bottom:20px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    // Button
    var btn = document.createElement('button');
    btn.id = 'cw-chat-btn';
    btn.setAttribute('aria-label', 'Chat with ChargeWizards');
    btn.style.cssText = 'width:60px;height:60px;border-radius:30px;background:' + PRIMARY +
      ';border:none;box-shadow:0 4px 15px rgba(0,0,0,0.25);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
    btn.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    // Notification dot
    var dot = document.createElement('span');
    dot.id = 'cw-chat-dot';
    dot.style.cssText = 'position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#e53e3e;border-radius:50%;border:2px solid white;';
    btn.style.position = 'relative';
    btn.appendChild(dot);

    // Chat window
    var win = document.createElement('div');
    win.id = 'cw-chat-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Chat window');
    win.style.cssText = 'display:none;flex-direction:column;position:absolute;bottom:75px;' +
      (isRight ? 'right:0' : 'left:0') + ';width:380px;max-width:calc(100vw - 40px);height:550px;max-height:calc(100vh - 120px);background:white;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.2);overflow:hidden;';

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'background:' + PRIMARY + ';color:white;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
    header.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><img src="' + API_URL +
      '/logo-dark.png" alt="CW" style="height:30px;width:auto;" onerror="this.style.display=\'none\'"><div><div style="font-size:17px;font-weight:600;margin-bottom:2px;">' +
      TITLE + '</div><div style="font-size:12px;opacity:0.85;">' + SUBTITLE + '</div></div></div>';

    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.style.cssText = 'background:none;border:none;color:white;font-size:22px;cursor:pointer;padding:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;opacity:0.8;';
    closeBtn.textContent = '×';
    header.appendChild(closeBtn);

    // Messages area
    var messagesEl = document.createElement('div');
    messagesEl.id = 'cw-chat-messages';
    messagesEl.setAttribute('aria-live', 'polite');
    messagesEl.style.cssText = 'flex:1;overflow-y:auto;padding:16px;background:#f8f9fa;';

    // Preview area
    var previewArea = document.createElement('div');
    previewArea.id = 'cw-upload-preview';
    previewArea.className = 'cw-upload-preview';
    previewArea.style.cssText = 'display:none;';

    // Input area
    var inputArea = document.createElement('div');
    inputArea.style.cssText = 'padding:12px 16px;background:white;border-top:1px solid #e5e7eb;flex-shrink:0;';

    var form = document.createElement('form');
    form.id = 'cw-chat-form';
    form.style.cssText = 'display:flex;gap:6px;align-items:center;min-width:0;';

    // Photo button
    var photoBtn = document.createElement('label');
    photoBtn.className = 'cw-photo-btn';
    photoBtn.title = 'Add photos';
    photoBtn.style.cssText = 'flex-shrink:0;';
    photoBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    photoBtn.appendChild(fileInput);

    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'cw-chat-input';
    input.placeholder = 'Message David...';
    input.autocomplete = 'off';
    input.style.cssText = 'flex:1;min-width:0;padding:10px 16px;border:2px solid #e5e7eb;border-radius:24px;font-size:14px;outline:none;';

    var sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.style.cssText = 'background:' + PRIMARY + ';color:white;border:none;padding:10px 18px;border-radius:24px;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0;white-space:nowrap;';
    sendBtn.textContent = 'Send';

    form.appendChild(photoBtn);
    form.appendChild(input);
    form.appendChild(sendBtn);
    inputArea.appendChild(previewArea);
    inputArea.appendChild(form);

    // Assemble
    win.appendChild(header);
    win.appendChild(messagesEl);
    win.appendChild(inputArea);
    container.appendChild(btn);
    container.appendChild(win);
    document.body.appendChild(container);

    // State
    var sessionId = uuid();
    var history = [];
    var isOpen = false;
    var busy = false;
    var greeted = false;
    var isMobile = window.innerWidth <= 500;
    var pendingFiles = [];

    function open() {
      isOpen = true;
      win.style.display = 'flex';
      dot.style.display = 'none';
      if (isMobile) {
        btn.style.display = 'none';
        win.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;height:100dvh;background:white;border-radius:0;box-shadow:none;overflow:hidden;z-index:999999;';
      }
      if (!greeted) {
        greeted = true;
        fetchGreeting();
      }
      setTimeout(function() { input.focus(); }, 100);
    }

    function close() {
      isOpen = false;
      win.style.display = 'none';
      btn.style.display = 'flex';
      if (isMobile) {
        win.style.cssText = 'display:none;flex-direction:column;position:absolute;bottom:75px;' +
          (isRight ? 'right:0' : 'left:0') + ';width:380px;max-width:calc(100vw - 40px);height:550px;max-height:calc(100vh - 120px);background:white;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.2);overflow:hidden;';
      }
    }

    btn.addEventListener('click', function () { isOpen ? close() : open(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) close(); });

    // Expose global API so site buttons can open the chat
    window.ChargeWizardsChat = {
      open: function() { open(); },
      close: function() { close(); },
      toggle: function() { isOpen ? close() : open(); }
    };

    // Auto-intercept "Get a Free Quote" / "Free Estimate" links/buttons on the page
    function interceptQuoteButtons() {
      var allClickables = document.querySelectorAll('a, button, [role="button"], [data-testid*="button"]');
      allClickables.forEach(function(el) {
        if (el._cwIntercepted) return; // don't double-bind
        var text = (el.textContent || el.innerText || '').toLowerCase().trim();
        if (text.indexOf('free quote') !== -1 || text.indexOf('get a quote') !== -1 ||
            text.indexOf('free estimate') !== -1 || text.indexOf('get started') !== -1 ||
            text.indexOf('contact us') !== -1) {
          el._cwIntercepted = true;
          el.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            open();
          }, true); // capture phase to beat Wix handlers
        }
      });
    }

    // Run interception after page loads (Wix is slow to render)
    setTimeout(interceptQuoteButtons, 1500);
    setTimeout(interceptQuoteButtons, 3000);
    setTimeout(interceptQuoteButtons, 6000);
    // Also observe DOM changes for Wix's dynamic rendering
    if (window.MutationObserver) {
      var observer = new MutationObserver(function() { interceptQuoteButtons(); });
      observer.observe(document.body, { childList: true, subtree: true });
      // Stop observing after 15s to avoid perf hit
      setTimeout(function() { observer.disconnect(); }, 15000);
    }

    // Auto-open on contact page
    if (isContactPage) {
      setTimeout(function() { open(); }, 500);
    }

    // Handle mobile keyboard resize
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        if (!isOpen) return;
        var vp = window.visualViewport;
        win.style.height = vp.height + 'px';
        win.style.top = vp.offsetTop + 'px';
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }

    async function fetchGreeting() {
      try {
        var res = await fetch(API_URL + '/api/greeting');
        var data = await res.json();
        var text = (data && data.greeting) || 'Hi! My name is David from ChargeWizards — How can I help?';
        history.push({ role: 'assistant', content: text });
        addBubble('ai', text);
      } catch (e) {
        var fb = 'Hi! My name is David from ChargeWizards — How can I help?';
        history.push({ role: 'assistant', content: fb });
        addBubble('ai', fb);
      }
    }

    // File upload handlers
    fileInput.addEventListener('change', function(e) {
      for (var i = 0; i < e.target.files.length; i++) {
        if (pendingFiles.length >= 5) break;
        var file = e.target.files[i];
        pendingFiles.push(file);
        addPreview(file);
      }
      fileInput.value = '';
      previewArea.style.display = pendingFiles.length > 0 ? 'flex' : 'none';
    });

    function addPreview(file) {
      var item = document.createElement('div');
      item.className = 'cw-preview-item';
      var img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      item.appendChild(img);

      var removeBtn = document.createElement('button');
      removeBtn.className = 'cw-preview-remove';
      removeBtn.textContent = '×';
      removeBtn.onclick = function() {
        pendingFiles = pendingFiles.filter(function(f) { return f !== file; });
        item.remove();
        previewArea.style.display = pendingFiles.length > 0 ? 'flex' : 'none';
      };
      item.appendChild(removeBtn);
      previewArea.appendChild(item);
    }

    function sendMessage(text, uploadedFiles) {
      if (busy) return;

      var imageHtml = '';
      if (uploadedFiles && uploadedFiles.length > 0) {
        imageHtml = '<div class="cw-message-images">' + uploadedFiles.map(function(f) {
          return '<img src="' + f.url + '" onclick="window.open(this.src)">';
        }).join('') + '</div>';
      }

      var fullText = (text || '') + (imageHtml ? '\n[Attached ' + uploadedFiles.length + ' photo(s)]' : '');

      history.push({ role: 'user', content: fullText });
      addBubble('user', (text || '') + imageHtml);
      input.value = '';

      busy = true;
      input.disabled = true;
      sendBtn.disabled = true;

      var typing = addTyping();
      callAPI(sessionId, history).then(function (reply) {
        typing.remove();
        history.push({ role: 'assistant', content: reply });
        addBubble('ai', reply);
      }).catch(function () {
        typing.remove();
        addBubble('ai', "Sorry, something went wrong. Please try again or call us at (650) 542-8877.");
      }).finally(function () {
        busy = false;
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text && pendingFiles.length === 0) return;

      if (pendingFiles.length > 0) {
        var filesToSend = pendingFiles.slice();
        pendingFiles = [];
        previewArea.innerHTML = '';
        previewArea.style.display = 'none';

        uploadFiles(filesToSend, sessionId).then(function(uploaded) {
          sendMessage(text, uploaded);
        }).catch(function(err) {
          console.error('Upload error:', err);
          sendMessage(text, []);
        });
      } else {
        sendMessage(text, []);
      }
    });

    function addBubble(type, content) {
      var row = document.createElement('div');
      row.style.cssText = 'margin-bottom:12px;display:flex;' + (type === 'user' ? 'justify-content:flex-end;' : '');

      var bubble = document.createElement('div');
      bubble.style.cssText = 'max-width:80%;padding:10px 14px;border-radius:16px;line-height:1.5;font-size:14px;word-wrap:break-word;' +
        (type === 'ai' ? 'background:white;color:#1a1a2e;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08);' :
          'background:' + PRIMARY + ';color:white;border-bottom-right-radius:4px;');

      // Parse content for image HTML
      if (content.includes('<div class="cw-message-images"')) {
        var parts = content.split('<div class="cw-message-images"');
        bubble.innerHTML = parts[0] + '<div class="cw-message-images"' + parts[1];
      } else {
        bubble.textContent = content;
      }

      row.appendChild(bubble);
      messagesEl.appendChild(row);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addTyping() {
      var row = document.createElement('div');
      row.style.cssText = 'margin-bottom:12px;';
      row.setAttribute('aria-label', 'David is typing');
      var bubble = document.createElement('div');
      bubble.style.cssText = 'display:inline-flex;gap:4px;padding:10px 16px;background:white;border-radius:16px;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08);';
      [0, 0.15, 0.3].forEach(function (d) {
        var dot = document.createElement('span');
        dot.style.cssText = 'width:7px;height:7px;background:#aaa;border-radius:50%;animation:cw-typing 1.2s infinite ' + d + 's;';
        bubble.appendChild(dot);
      });
      row.appendChild(bubble);
      messagesEl.appendChild(row);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return row;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
