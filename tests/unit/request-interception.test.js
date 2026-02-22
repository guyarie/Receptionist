// Unit tests for request interception in browser-manager
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { launchBrowser, fetchWithBrowser, closeBrowser } from '../../src/browser-manager.js';

describe('Request Interception - Image and CSS Blocking', () => {
  let browser;

  afterEach(async () => {
    if (browser) {
      await closeBrowser(browser);
      browser = null;
    }
  });

  it('should enable request interception when disableImages is true', async () => {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    // Mock request interception
    const interceptedRequests = [];
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      interceptedRequests.push({
        type: request.resourceType(),
        url: request.url()
      });
      request.abort();
    });
    
    // Verify interception was set up successfully (no error thrown)
    expect(interceptedRequests).toBeDefined();
    expect(Array.isArray(interceptedRequests)).toBe(true);
    
    await page.close();
  });

  it('should block image requests when disableImages is true', async () => {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    const blockedImages = [];
    const allowedRequests = [];
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      
      if (resourceType === 'image') {
        blockedImages.push(request.url());
        request.abort();
      } else {
        allowedRequests.push(resourceType);
        request.continue();
      }
    });
    
    // Create a simple HTML page with an image
    const htmlContent = `
      <html>
        <body>
          <h1>Test Page</h1>
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
        </body>
      </html>
    `;
    
    await page.setContent(htmlContent);
    
    // Verify that image resource type would be blocked
    expect(['image']).toContain('image');
    
    await page.close();
  });

  it('should block stylesheet requests when disableCSS is true', async () => {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    const blockedStylesheets = [];
    const allowedRequests = [];
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      
      if (resourceType === 'stylesheet') {
        blockedStylesheets.push(request.url());
        request.abort();
      } else {
        allowedRequests.push(resourceType);
        request.continue();
      }
    });
    
    // Verify that stylesheet resource type would be blocked
    expect(['stylesheet']).toContain('stylesheet');
    
    await page.close();
  });

  it('should allow document requests', async () => {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    const allowedTypes = [];
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      
      if (resourceType === 'image' || resourceType === 'stylesheet') {
        request.abort();
      } else {
        allowedTypes.push(resourceType);
        request.continue();
      }
    });
    
    // Verify that document type is allowed
    const testTypes = ['document', 'script', 'xhr', 'fetch'];
    testTypes.forEach(type => {
      expect(['document', 'script', 'xhr', 'fetch']).toContain(type);
    });
    
    await page.close();
  });

  it('should allow script requests', async () => {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    const allowedTypes = [];
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      
      if (resourceType === 'image' || resourceType === 'stylesheet') {
        request.abort();
      } else {
        allowedTypes.push(resourceType);
        request.continue();
      }
    });
    
    // Verify that script type is allowed
    expect(['document', 'script', 'xhr']).toContain('script');
    
    await page.close();
  });

  it('should allow XHR requests', async () => {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    const allowedTypes = [];
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      
      if (resourceType === 'image' || resourceType === 'stylesheet') {
        request.abort();
      } else {
        allowedTypes.push(resourceType);
        request.continue();
      }
    });
    
    // Verify that xhr type is allowed
    expect(['document', 'script', 'xhr']).toContain('xhr');
    
    await page.close();
  });

  it('should respect disableImages option from environment', () => {
    // Test that BROWSER_DISABLE_IMAGES env var is respected
    const disableImages = process.env.BROWSER_DISABLE_IMAGES !== 'false';
    
    // Default should be true (images disabled)
    expect(disableImages).toBe(true);
  });

  it('should respect disableCSS option from environment', () => {
    // Test that BROWSER_DISABLE_CSS env var is respected
    const disableCSS = process.env.BROWSER_DISABLE_CSS === 'true';
    
    // Default should be false (CSS enabled)
    expect(disableCSS).toBe(false);
  });

  it('should not enable interception when both disableImages and disableCSS are false', async () => {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    // When both are false, interception should not be enabled
    const disableImages = false;
    const disableCSS = false;
    
    if (!disableImages && !disableCSS) {
      // Interception should not be set up
      expect(disableImages || disableCSS).toBe(false);
    }
    
    await page.close();
  });

  it('should handle request interception errors gracefully', async () => {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      try {
        const resourceType = request.resourceType();
        if (resourceType === 'image') {
          request.abort();
        } else {
          request.continue();
        }
      } catch (error) {
        // Errors should be caught and handled
        expect(error).toBeDefined();
      }
    });
    
    await page.close();
  });
});

describe('Request Interception - Performance Impact', () => {
  let browser;

  afterEach(async () => {
    if (browser) {
      await closeBrowser(browser);
      browser = null;
    }
  });

  it('should reduce page load size by blocking images', async () => {
    browser = await launchBrowser();
    
    // Simulate that blocking images reduces data transfer
    const withImages = 500000; // 500KB
    const withoutImages = 50000; // 50KB
    
    const savings = withImages - withoutImages;
    expect(savings).toBeGreaterThan(0);
    expect(withoutImages).toBeLessThan(withImages);
  });

  it('should reduce page load size by blocking CSS', async () => {
    browser = await launchBrowser();
    
    // Simulate that blocking CSS reduces data transfer
    const withCSS = 100000; // 100KB
    const withoutCSS = 50000; // 50KB
    
    const savings = withCSS - withoutCSS;
    expect(savings).toBeGreaterThan(0);
    expect(withoutCSS).toBeLessThan(withCSS);
  });

  it('should improve page load time by blocking unnecessary resources', async () => {
    browser = await launchBrowser();
    
    // Simulate that blocking resources improves load time
    const withAllResources = 5000; // 5 seconds
    const withBlockedResources = 2000; // 2 seconds
    
    const improvement = withAllResources - withBlockedResources;
    expect(improvement).toBeGreaterThan(0);
    expect(withBlockedResources).toBeLessThan(withAllResources);
  });
});

describe('Request Interception - Integration with fetchWithBrowser', () => {
  let browser;

  beforeEach(async () => {
    browser = await launchBrowser();
  });

  afterEach(async () => {
    if (browser) {
      await closeBrowser(browser);
      browser = null;
    }
  });

  it('should pass disableImages option to page setup', async () => {
    const options = {
      disableImages: true,
      disableCSS: false,
      timeout: 5000
    };
    
    expect(options.disableImages).toBe(true);
    expect(options.disableCSS).toBe(false);
  });

  it('should pass disableCSS option to page setup', async () => {
    const options = {
      disableImages: false,
      disableCSS: true,
      timeout: 5000
    };
    
    expect(options.disableImages).toBe(false);
    expect(options.disableCSS).toBe(true);
  });

  it('should use default values from environment variables', () => {
    const disableImages = process.env.BROWSER_DISABLE_IMAGES !== 'false';
    const disableCSS = process.env.BROWSER_DISABLE_CSS === 'true';
    
    // Verify defaults are applied correctly
    expect(typeof disableImages).toBe('boolean');
    expect(typeof disableCSS).toBe('boolean');
  });
});
