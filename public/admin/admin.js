// Admin UI Shared JavaScript

// Runtime config fetched from server (timezone, business name)
let _adminConfig = { businessName: 'AI Receptionist', timezone: 'America/Los_Angeles' };

async function loadAdminConfig() {
  try {
    const cfg = await fetch('/admin/api/config').then(r => r.json());
    _adminConfig = cfg;

    // Update header h1 and page title with business name
    const h1 = document.querySelector('header h1');
    if (h1) h1.textContent = `🤖 ${cfg.businessName} — Admin`;
    document.title = document.title.replace('AI Phone Receptionist', cfg.businessName);
  } catch (e) {
    // Non-fatal — fall back to defaults
  }
}

document.addEventListener('DOMContentLoaded', loadAdminConfig);

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
      // Handle 401 Unauthorized by redirecting to login
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
    { name: 'Availability', path: 'availability.html' },
    { name: 'Provider Profiles', path: 'providers.html' }
  ];

  nav.innerHTML = pages.map(page => {
    const isActive = activePage === page.path ? 'active' : '';
    return `<li><a href="${page.path}" class="${isActive}">${page.name}</a></li>`;
  }).join('') + `
    <li style="margin-left: auto;">
      <a href="#" id="logout-btn" style="color: #dc3545;">Logout</a>
    </li>
  `;

  // Attach logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/admin/logout', { method: 'POST' });
        window.location.href = '/admin/login';
      } catch (error) {
        console.error('Logout error:', error);
        // Redirect to login anyway
        window.location.href = '/admin/login';
      }
    });
  }
}

// Format timestamp using server-configured timezone
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    timeZone: _adminConfig.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
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
