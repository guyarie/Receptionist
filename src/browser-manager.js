/**
 * Browser Manager Module
 * 
 * Encapsulates Puppeteer operations for headless browser scraping.
 * Provides functions to launch browsers, fetch pages, and manage cleanup.
 */

const puppeteer = require('puppeteer');

/**
 * Launches a headless browser instance with optimized settings
 * @param {object} options - Browser launch options
 * @param {boolean} options.headless - Run in headless mode (default: true)
 * @param {boolean} options.disableImages - Disable image loading (default: true)
 * @param {boolean} options.disableCSS - Disable CSS loading (default: false)
 * @returns {Promise<Browser>} Puppeteer browser instance
 * @throws {Error} If browser fails to launch
 */
async function launchBrowser(options = {}) {
  const {
    headless = process.env.BROWSER_HEADLESS !== 'false'
  } = options;

  try {
    console.log('🚀 Launching headless browser...');
    
    const browser = await puppeteer.launch({
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ],
      defaultViewport: {
        width: 1280,
        height: 720
      }
    });

    console.log('✅ Browser launched successfully');
    return browser;
  } catch (error) {
    console.error('❌ Failed to launch browser:', error.message);
    console.error('💡 Ensure Chrome/Chromium is installed');
    console.error('💡 Or set SCRAPING_MODE=axios to use fallback mode');
    throw error;
  }
}

/**
 * Fetches a URL using headless browser and returns rendered HTML
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} url - URL to fetch
 * @param {object} options - Page options
 * @param {number} options.timeout - Page load timeout in ms (default: 10000)
 * @param {string} options.waitUntil - When to consider navigation complete (default: 'networkidle2')
 * @param {boolean} options.disableImages - Disable image loading (default: true)
 * @param {boolean} options.disableCSS - Disable CSS loading (default: false)
 * @returns {Promise<string>} Rendered HTML content
 * @throws {Error} If page fails to load
 */
async function fetchWithBrowser(browser, url, options = {}) {
  const {
    timeout = parseInt(process.env.PAGE_LOAD_TIMEOUT) || 10000,
    waitUntil = 'networkidle2',
    disableImages = process.env.BROWSER_DISABLE_IMAGES !== 'false',
    disableCSS = process.env.BROWSER_DISABLE_CSS === 'true'
  } = options;

  let page = null;

  try {
    console.log(`📄 Fetching: ${url}`);
    page = await browser.newPage();

    // Set up request interception for performance optimization
    if (disableImages || disableCSS) {
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        
        if (disableImages && resourceType === 'image') {
          request.abort();
        } else if (disableCSS && resourceType === 'stylesheet') {
          request.abort();
        } else {
          request.continue();
        }
      });
    }

    // Navigate to the page and wait for content to load
    await page.goto(url, {
      timeout: timeout,
      waitUntil: waitUntil
    });

    // Wait a bit for any remaining JavaScript to execute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get the fully rendered HTML
    const html = await page.content();
    
    console.log(`✅ Successfully fetched ${url} (${html.length} bytes)`);
    
    return html;
  } catch (error) {
    console.error(`❌ Failed to fetch ${url}:`, error.message);
    throw error;
  } finally {
    // Always close the page to free resources
    if (page) {
      await page.close().catch(err => {
        console.error('⚠️  Warning: Failed to close page:', err.message);
      });
    }
  }
}

/**
 * Closes browser instance safely with proper cleanup
 * @param {Browser} browser - Puppeteer browser instance
 * @returns {Promise<void>}
 */
async function closeBrowser(browser) {
  if (!browser) {
    return;
  }

  try {
    console.log('🔒 Closing browser...');
    
    // Check if browser is still connected before attempting to close
    if (browser.isConnected()) {
      // Close all pages first to ensure clean shutdown
      const pages = await browser.pages();
      await Promise.all(pages.map(page => 
        page.close().catch(err => {
          console.error('⚠️  Warning: Failed to close page:', err.message);
        })
      ));
      
      // Now close the browser
      await browser.close();
      console.log('✅ Browser closed successfully');
    } else {
      console.log('ℹ️  Browser already disconnected');
    }
  } catch (error) {
    console.error('⚠️  Warning: Failed to close browser:', error.message);
    
    // Try to force kill the browser process if normal close failed
    try {
      if (browser.process()) {
        console.log('🔨 Attempting to force kill browser process...');
        browser.process().kill('SIGKILL');
        console.log('✅ Browser process terminated');
      }
    } catch (killError) {
      console.error('⚠️  Warning: Failed to kill browser process:', killError.message);
    }
    
    // Don't throw - we want cleanup to continue even if close fails
  }
}

module.exports = {
  launchBrowser,
  fetchWithBrowser,
  closeBrowser
};
