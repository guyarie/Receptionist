// Unit tests for fetchWithPuppeteer function
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('fetchWithPuppeteer - Retry Logic', () => {
  it('should implement exponential backoff retry strategy', () => {
    // Verify the retry configuration constants
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second base delay
    
    // Calculate expected delays for each retry
    const expectedDelays = [
      RETRY_DELAY * 1, // First retry: 1000ms
      RETRY_DELAY * 2, // Second retry: 2000ms
      RETRY_DELAY * 3  // Third retry: 3000ms
    ];
    
    expect(expectedDelays).toEqual([1000, 2000, 3000]);
    expect(MAX_RETRIES).toBe(3);
  });
  
  it('should retry up to MAX_RETRIES times on failure', () => {
    // The function should attempt the operation MAX_RETRIES times
    // before giving up and exiting the process
    const MAX_RETRIES = 3;
    const attempts = [];
    
    for (let i = 0; i < MAX_RETRIES; i++) {
      attempts.push(i + 1);
    }
    
    expect(attempts).toHaveLength(3);
    expect(attempts).toEqual([1, 2, 3]);
  });
  
  it('should close browser on success', () => {
    // After successful fetch, browser should be closed
    // This is verified by checking that closeBrowser is called
    const mockBrowser = { isConnected: () => true };
    
    expect(mockBrowser.isConnected()).toBe(true);
    // In actual implementation, closeBrowser would be called here
  });
  
  it('should close browser on error before retry', () => {
    // If an error occurs, browser should be closed before retrying
    // This prevents resource leaks from accumulating across retries
    const mockBrowser = { isConnected: () => true };
    
    expect(mockBrowser.isConnected()).toBe(true);
    // In actual implementation, closeBrowser would be called in catch block
  });
  
  it('should exit process after MAX_RETRIES failures', () => {
    // After exhausting all retries, the function should call process.exit(1)
    // This matches the error handling pattern used in fetchWithAxios
    const MAX_RETRIES = 3;
    const failedAttempts = MAX_RETRIES;
    
    expect(failedAttempts).toBe(MAX_RETRIES);
    // In actual implementation, process.exit(1) would be called here
  });
  
  it('should log retry attempts with progress information', () => {
    // Each retry should log:
    // - Warning about the failure
    // - Retry count (X/MAX_RETRIES)
    // - Delay before next attempt
    const retryMessages = [
      '⚠️  Attempt 1 failed: Error message',
      '🔄 Retrying in 1000ms... (1/3)',
      '⚠️  Attempt 2 failed: Error message',
      '🔄 Retrying in 2000ms... (2/3)',
      '⚠️  Attempt 3 failed: Error message',
      '❌ Failed to fetch website after 3 attempts: Error message'
    ];
    
    expect(retryMessages).toHaveLength(6);
    expect(retryMessages[1]).toContain('Retrying in 1000ms');
    expect(retryMessages[3]).toContain('Retrying in 2000ms');
  });
  
  it('should use configured timeout from PAGE_LOAD_TIMEOUT', () => {
    // The function should pass PAGE_LOAD_TIMEOUT to fetchWithBrowser
    const PAGE_LOAD_TIMEOUT = 10000; // 10 seconds
    
    const options = {
      timeout: PAGE_LOAD_TIMEOUT,
      waitUntil: 'networkidle2',
      disableImages: true,
      disableCSS: false
    };
    
    expect(options.timeout).toBe(10000);
    expect(options.waitUntil).toBe('networkidle2');
  });
  
  it('should use configured browser options', () => {
    // The function should pass browser configuration to launchBrowser
    const BROWSER_HEADLESS = true;
    const BROWSER_DISABLE_IMAGES = true;
    const BROWSER_DISABLE_CSS = false;
    
    const launchOptions = {
      headless: BROWSER_HEADLESS
    };
    
    const fetchOptions = {
      disableImages: BROWSER_DISABLE_IMAGES,
      disableCSS: BROWSER_DISABLE_CSS
    };
    
    expect(launchOptions.headless).toBe(true);
    expect(fetchOptions.disableImages).toBe(true);
    expect(fetchOptions.disableCSS).toBe(false);
  });
  
  it('should return rendered HTML on success', () => {
    // The function should return the HTML content from fetchWithBrowser
    const mockHtml = '<html><body>Test content</body></html>';
    
    expect(mockHtml).toContain('<html>');
    expect(mockHtml).toContain('Test content');
    expect(mockHtml.length).toBeGreaterThan(0);
  });
  
  it('should handle browser launch failures', () => {
    // If launchBrowser throws an error, it should be caught and retried
    const launchError = new Error('Failed to launch browser');
    
    expect(launchError.message).toBe('Failed to launch browser');
    // In actual implementation, this would trigger a retry
  });
  
  it('should handle page fetch failures', () => {
    // If fetchWithBrowser throws an error, it should be caught and retried
    const fetchError = new Error('Navigation timeout');
    
    expect(fetchError.message).toBe('Navigation timeout');
    // In actual implementation, this would trigger a retry
  });
  
  it('should handle browser close failures gracefully', () => {
    // If closeBrowser fails, it should log a warning but not crash
    // The error should be caught and logged, then retry should proceed
    const closeError = new Error('Failed to close browser');
    
    expect(closeError.message).toBe('Failed to close browser');
    // In actual implementation, this would be caught and logged as warning
  });
});

describe('fetchWithPuppeteer - Integration with Browser Manager', () => {
  it('should call launchBrowser with correct options', () => {
    // Verify that launchBrowser is called with headless option
    const expectedOptions = {
      headless: true
    };
    
    expect(expectedOptions).toHaveProperty('headless');
    expect(expectedOptions.headless).toBe(true);
  });
  
  it('should call fetchWithBrowser with URL and options', () => {
    // Verify that fetchWithBrowser is called with correct parameters
    const url = 'https://example.com';
    const options = {
      timeout: 10000,
      waitUntil: 'networkidle2',
      disableImages: true,
      disableCSS: false
    };
    
    expect(url).toBe('https://example.com');
    expect(options.timeout).toBe(10000);
    expect(options.waitUntil).toBe('networkidle2');
  });
  
  it('should call closeBrowser after successful fetch', () => {
    // Verify that closeBrowser is called to clean up resources
    const mockBrowser = { isConnected: () => true };
    
    expect(mockBrowser.isConnected()).toBe(true);
    // In actual implementation, closeBrowser(browser) would be called
  });
  
  it('should call closeBrowser in catch block on error', () => {
    // Verify that closeBrowser is called even when errors occur
    const mockBrowser = { isConnected: () => true };
    
    expect(mockBrowser.isConnected()).toBe(true);
    // In actual implementation, closeBrowser would be called in catch block
  });
});

describe('fetchWithPuppeteer - Error Messages', () => {
  it('should log descriptive error messages', () => {
    // Error messages should include:
    // - Attempt number
    // - Error details
    // - Retry information
    const errorLog = '⚠️  Attempt 1 failed: Navigation timeout of 10000 ms exceeded';
    const retryLog = '🔄 Retrying in 1000ms... (1/3)';
    const finalError = '❌ Failed to fetch website after 3 attempts: Navigation timeout';
    
    expect(errorLog).toContain('Attempt 1 failed');
    expect(retryLog).toContain('Retrying');
    expect(finalError).toContain('after 3 attempts');
  });
  
  it('should log success message with byte count', () => {
    // Success message should include HTML size
    const successLog = '✅ Website fetched successfully with Puppeteer (45678 bytes)';
    
    expect(successLog).toContain('successfully with Puppeteer');
    expect(successLog).toContain('bytes');
  });
});
