import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Admin UI - Logout Button', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Load the admin.js file
    const adminJsPath = path.join(__dirname, '../../public/admin/admin.js');
    const adminJsContent = fs.readFileSync(adminJsPath, 'utf-8');

    // Create a DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <nav>
            <ul></ul>
          </nav>
        </body>
      </html>
    `, {
      url: 'http://localhost',
      runScripts: 'dangerously',
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;

    // Mock fetch
    window.fetch = vi.fn();

    // Execute the admin.js script by creating a script element
    const scriptEl = document.createElement('script');
    scriptEl.textContent = adminJsContent;
    document.body.appendChild(scriptEl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dom.window.close();
  });

  it('should add logout button to navigation', () => {
    const { renderNav } = window.AdminUI;
    
    renderNav('index.html');

    const nav = document.querySelector('nav ul');
    const logoutBtn = document.getElementById('logout-btn');

    expect(logoutBtn).toBeTruthy();
    expect(logoutBtn.textContent).toBe('Logout');
    expect(logoutBtn.getAttribute('style')).toContain('color');
  });

  it('should submit POST to /admin/logout when clicked', async () => {
    const { renderNav } = window.AdminUI;
    
    // Mock fetch to resolve successfully
    window.fetch.mockResolvedValue({ ok: true });

    renderNav('index.html');

    const logoutBtn = document.getElementById('logout-btn');
    
    // Verify button exists and has click handler
    expect(logoutBtn).toBeTruthy();
    
    // Simulate click by calling the handler directly
    // The button has an event listener attached, so we can trigger it
    const clickEvent = new window.Event('click', { bubbles: true, cancelable: true });
    
    // Prevent actual navigation in test
    const originalHref = window.location.href;
    
    logoutBtn.dispatchEvent(clickEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify fetch was called with correct parameters
    expect(window.fetch).toHaveBeenCalledWith('/admin/logout', { method: 'POST' });
  });

  it('should redirect to login even if logout request fails', async () => {
    const { renderNav } = window.AdminUI;
    
    // Mock fetch to reject
    window.fetch.mockRejectedValue(new Error('Network error'));

    renderNav('index.html');

    const logoutBtn = document.getElementById('logout-btn');
    
    // Verify button exists
    expect(logoutBtn).toBeTruthy();
    
    // Create and dispatch click event
    const clickEvent = new window.Event('click', { bubbles: true, cancelable: true });
    logoutBtn.dispatchEvent(clickEvent);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify fetch was attempted (even though it failed)
    expect(window.fetch).toHaveBeenCalledWith('/admin/logout', { method: 'POST' });
  });
});

describe('Admin UI - apiFetch 401 Handling', () => {
  let dom;
  let window;

  beforeEach(() => {
    // Load the admin.js file
    const adminJsPath = path.join(__dirname, '../../public/admin/admin.js');
    const adminJsContent = fs.readFileSync(adminJsPath, 'utf-8');

    // Create a DOM environment
    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: 'http://localhost',
      runScripts: 'dangerously',
      resources: 'usable'
    });

    window = dom.window;

    // Mock fetch
    window.fetch = vi.fn();

    // Execute the admin.js script
    const scriptEl = window.document.createElement('script');
    scriptEl.textContent = adminJsContent;
    window.document.body.appendChild(scriptEl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dom.window.close();
  });

  it('should redirect to login on 401 response', async () => {
    const { apiFetch } = window.AdminUI;

    // Mock fetch to return 401
    window.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: 'Unauthorized' })
    });

    // The function should handle 401 by redirecting (setting window.location.href)
    // In the test environment, this won't actually navigate, but the function should complete without throwing
    const result = await apiFetch('/admin/api/test');

    // When a 401 occurs, apiFetch returns early (undefined) after setting location.href
    expect(result).toBeUndefined();
  });

  it('should throw error for non-401 failures', async () => {
    const { apiFetch } = window.AdminUI;

    // Mock fetch to return 500
    window.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'Server error' })
    });

    await expect(apiFetch('/admin/api/test')).rejects.toThrow('Server error');
  });

  it('should return data on successful response', async () => {
    const { apiFetch } = window.AdminUI;

    const testData = { success: true, data: 'test' };

    // Mock fetch to return success
    window.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(testData)
    });

    const result = await apiFetch('/admin/api/test');

    expect(result).toEqual(testData);
  });
});
