// Admin UI Shared JavaScript — ChargeWizards AI Receptionist

// API fetch wrapper with error handling
async function apiFetch(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Toast notification system
const Toast = {
  show(message, type = 'info') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastIn .25s ease-out reverse';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  },
  success(message) { this.show(message, 'success'); },
  error(message)   { this.show(message, 'error'); },
  info(message)    { this.show(message, 'info'); }
};

// Render sidebar navigation
function renderNav(activePage) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const pages = [
    { name: 'Dashboard',   path: 'index.html',        icon: '📊' },
    { name: 'Leads',       path: 'leads.html',         icon: '🎯' },
    { name: 'Call Logs',   path: 'calls.html',         icon: '📞' },
    { name: 'Prompts',     path: 'prompts.html',       icon: '📝' },
    { name: 'Availability',path: 'availability.html',  icon: '📅' },
    { name: 'Providers',   path: 'providers.html',     icon: '👷' },
  ];

  nav.innerHTML = pages.map(page => {
    const isActive = activePage === page.path ? 'active' : '';
    return `<a href="${page.path}" class="${isActive}">
      <span class="nav-icon">${page.icon}</span>${page.name}
    </a>`;
  }).join('');
}

// Format timestamp in Pacific time
function formatTimestamp(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// Format timestamp relative/short
function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000)        return 'Just now';
  if (diff < 3600000)      return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000)     return `${Math.floor(diff/3600000)}h ago`;
  if (diff < 604800000)    return `${Math.floor(diff/86400000)}d ago`;

  return date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Format duration
function formatDuration(seconds) {
  if (seconds == null) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

// Format uptime
function formatUptime(seconds) {
  const hours   = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs    = seconds % 60;
  if (hours > 0)   return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// Show loading spinner
function showLoading(container) {
  container.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
}

// Show error message
function showError(container, message) {
  container.innerHTML = `<p class="text-muted text-center" style="padding:24px">${escapeHtml(message)}</p>`;
}

// Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Logout handler — attached by each page that calls renderNav
function attachLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await fetch('/admin/logout', { method: 'POST' }); } catch {}
      window.location.href = '/admin/login';
    });
  }
}

// Export
window.AdminUI = {
  apiFetch,
  Toast,
  renderNav,
  formatTimestamp,
  formatDate,
  formatDuration,
  formatUptime,
  escapeHtml,
  showLoading,
  showError,
  debounce,
  attachLogout
};
