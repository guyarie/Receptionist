// Admin UI Shared JavaScript

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
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  success(message) {
    this.show(message, 'success');
  },

  error(message) {
    this.show(message, 'error');
  },

  info(message) {
    this.show(message, 'info');
  }
};

// Navigation component
function renderNav(activePage) {
  const nav = document.querySelector('nav ul');
  if (!nav) return;

  const pages = [
    { name: 'Dashboard', path: 'index.html' },
    { name: 'Prompts', path: 'prompts.html' },
    { name: 'Call Logs', path: 'calls.html' },
    { name: 'Availability', path: 'availability.html' }
  ];

  nav.innerHTML = pages.map(page => {
    const isActive = activePage === page.path ? 'active' : '';
    return `<li><a href="${page.path}" class="${isActive}">${page.name}</a></li>`;
  }).join('');
}

// Format timestamp
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

// Format duration
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

// Format uptime
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show loading spinner
function showLoading(container) {
  container.innerHTML = '<div class="spinner"></div>';
}

// Show error message
function showError(container, message) {
  container.innerHTML = `<p class="text-muted text-center">${escapeHtml(message)}</p>`;
}

// Debounce function for input handlers
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export for use in other scripts
window.AdminUI = {
  apiFetch,
  Toast,
  renderNav,
  formatTimestamp,
  formatDuration,
  formatUptime,
  escapeHtml,
  showLoading,
  showError,
  debounce
};
