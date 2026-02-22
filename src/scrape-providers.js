/**
 * Provider Profile Scraper for AI Phone Receptionist
 * 
 * This script scrapes the Relational Therapy Collective (RTC) website to extract
 * practice information and individual provider profiles. It uses OpenRouter API
 * for AI-powered content extraction and generates structured markdown files.
 * 
 * Key Features:
 * - Name normalization: Removes credentials and middle initials for consistent slugs
 * - Duplicate detection: Updates existing files instead of creating duplicates
 * - Insurance extraction: Emphasizes insurance information in AI prompts
 * - Data validation: Validates email, phone, and required fields (non-blocking)
 * - Comprehensive reporting: Generates detailed reports with validation warnings
 * 
 * Output Structure:
 * - data/practice/practice-overview.md - Practice overview content
 * - data/providers/[slug].md - Individual provider profiles
 * - reports/scraping-report-[timestamp].md - Scraping report with validation results
 * 
 * Usage:
 *   node src/scrape-providers.js
 * 
 * Environment Variables:
 * - WEBSITE_URL: RTC website URL (default: https://www.relationaltherapycollective.com)
 * - OPENROUTER_API_KEY: Required for AI extraction
 * - OPENROUTER_MODEL: AI model to use (default: openai/gpt-4)
 * 
 * @module scrape-providers
 * @requires axios - HTTP client for fetching website content
 * @requires cheerio - HTML parsing and text extraction
 * @requires fs - File system operations
 * @requires path - Path manipulation
 * @requires openai - OpenRouter API client
 * @requires ./prompts - Prompt loader for scraping instructions
 */

// Standalone script to scrape RTC website and generate provider markdown files
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const prompts = require('./prompts');
require('dotenv').config();

// Configuration
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://www.relationaltherapycollective.com';
const PROVIDERS_DIR = path.join(__dirname, '..', 'data', 'providers');
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4';

// Scraping mode configuration
const SCRAPING_MODE = process.env.SCRAPING_MODE || 'puppeteer'; // 'puppeteer' or 'axios'
const PAGE_LOAD_TIMEOUT = parseInt(process.env.PAGE_LOAD_TIMEOUT) || 10000; // Milliseconds
const BROWSER_HEADLESS = process.env.BROWSER_HEADLESS !== 'false'; // Default true
const BROWSER_DISABLE_IMAGES = process.env.BROWSER_DISABLE_IMAGES !== 'false'; // Default true
const BROWSER_DISABLE_CSS = process.env.BROWSER_DISABLE_CSS === 'true'; // Default false
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3; // Max retry attempts
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY) || 1000; // Initial retry delay in ms

// Multi-page scraping feature flag
const MULTI_PAGE_SCRAPING = process.env.MULTI_PAGE_SCRAPING === 'true'; // Default false

// Import browser manager for Puppeteer operations
const browserManager = require('./browser-manager');

/**
 * Fetch HTML content from the specified website URL using axios
 * Uses axios with a browser-like User-Agent to avoid blocking
 * @param {string} url - The website URL to fetch
 * @returns {Promise<string>} HTML content of the website
 * @throws {Error} Exits process if fetch fails (network error, timeout, etc.)
 */
async function fetchWithAxios(url) {
  console.log(`🌐 Fetching website: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    console.log(`✅ Website fetched successfully (${response.data.length} bytes)`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to fetch website: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Fetch HTML content using Puppeteer headless browser with retry logic
 * Launches browser, navigates to URL, waits for dynamic content, and extracts rendered HTML
 * Implements exponential backoff retry strategy for transient failures
 * @param {string} url - The website URL to fetch
 * @param {Browser} browser - Optional Puppeteer browser instance for reuse
 * @param {string} providerName - Optional provider name for error tracking
 * @returns {Promise<string>} Rendered HTML content after JavaScript execution
 * @throws {Error} Throws error with type information if fetch fails after MAX_RETRIES attempts
 */
async function fetchWithPuppeteer(url, browser = null, providerName = null) {
  console.log(`🌐 Fetching website with Puppeteer: ${url}`);
  
  const shouldManageBrowser = !browser;
  let managedBrowser = browser;
  let retries = 0;
  let lastError = null;
  
  while (retries < MAX_RETRIES) {
    try {
      // Launch browser only if not provided
      if (shouldManageBrowser && !managedBrowser) {
        managedBrowser = await browserManager.launchBrowser({
          headless: BROWSER_HEADLESS
        });
      }
      
      // Fetch page with configured options
      const html = await browserManager.fetchWithBrowser(managedBrowser, url, {
        timeout: PAGE_LOAD_TIMEOUT,
        waitUntil: 'networkidle2',
        disableImages: BROWSER_DISABLE_IMAGES,
        disableCSS: BROWSER_DISABLE_CSS
      });
      
      // Close browser only if we launched it
      if (shouldManageBrowser && managedBrowser) {
        await browserManager.closeBrowser(managedBrowser);
      }
      
      console.log(`✅ Website fetched successfully with Puppeteer (${html.length} bytes)`);
      return html;
      
    } catch (error) {
      retries++;
      lastError = error;
      
      // Ensure browser is closed only if we launched it
      if (shouldManageBrowser && managedBrowser) {
        await browserManager.closeBrowser(managedBrowser).catch(err => {
          console.error(`⚠️  Warning: Failed to close browser after error: ${err.message}`);
        });
        managedBrowser = null;
      }
      
      // If we've exhausted retries, throw error with type information
      if (retries >= MAX_RETRIES) {
        console.error(`❌ Failed to fetch website after ${MAX_RETRIES} attempts: ${error.message}`);
        
        // Determine error type based on error message
        let errorType = 'unknown';
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorType = 'timeout';
        } else if (error.message.includes('Navigation') || error.message.includes('net::')) {
          errorType = 'navigation';
        } else if (error.message.includes('parse') || error.message.includes('Parse')) {
          errorType = 'parsing';
        }
        
        // Create enhanced error with type information
        const enhancedError = new Error(error.message);
        enhancedError.type = errorType;
        enhancedError.provider = providerName;
        enhancedError.url = url;
        enhancedError.attempts = MAX_RETRIES;
        
        throw enhancedError;
      }
      
      // Calculate exponential backoff delay
      const delay = RETRY_DELAY * retries;
      console.warn(`⚠️  Attempt ${retries} failed: ${error.message}`);
      console.log(`🔄 Retrying in ${delay}ms... (${retries}/${MAX_RETRIES})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Fetch website content using configured scraping mode
 * Dispatcher function that selects between Puppeteer and axios based on SCRAPING_MODE
 * configuration. Logs which mode is being used for transparency and debugging.
 * @param {string} url - The website URL to fetch
 * @param {Browser} browser - Optional Puppeteer browser instance for reuse
 * @param {string} providerName - Optional provider name for error tracking
 * @returns {Promise<string>} HTML content (rendered or static depending on mode)
 * @throws {Error} Throws error if fetch fails
 */
async function fetchWebsite(url, browser = null, providerName = null) {
  console.log(`🔧 Scraping mode: ${SCRAPING_MODE}`);
  
  if (SCRAPING_MODE === 'puppeteer') {
    console.log(`🤖 Using Puppeteer (headless browser) for dynamic content capture`);
    return fetchWithPuppeteer(url, browser, providerName);
  } else if (SCRAPING_MODE === 'axios') {
    console.log(`📡 Using axios (HTTP client) for static content fetch`);
    return fetchWithAxios(url);
  } else {
    console.error(`❌ Invalid SCRAPING_MODE: ${SCRAPING_MODE}`);
    console.error(`   Valid options: 'puppeteer' or 'axios'`);
    console.error(`   Defaulting to Puppeteer mode...`);
    return fetchWithPuppeteer(url, browser, providerName);
  }
}

/**
 * Extract provider links from homepage HTML
 * Parses HTML to find links to individual provider pages, typically found in
 * "Meet the Team" sections or navigation menus. Filters out non-provider links
 * like about, contact, services pages.
 * 
 * Link detection strategy:
 * 1. Look for links in sections with "team", "provider", "therapist", "clinician" keywords
 * 2. Look for links matching common provider URL patterns (/name, /providers/name, /team/name)
 * 3. Filter out common non-provider pages (about, contact, services, blog, etc.)
 * 4. Extract provider name from link text or URL
 * 
 * @param {string} html - Homepage HTML content
 * @returns {Array<{name: string, url: string}>} Array of provider link objects
 * @throws {Error} Throws error if HTML parsing fails (fatal - cannot proceed)
 */
function extractProviderLinks(html) {
  console.log(`🔍 Extracting provider links from homepage`);

  try {
    const $ = cheerio.load(html);
    const providerLinks = [];
    const seenUrls = new Set(); // Track URLs to avoid duplicates

    // Common non-provider page patterns to filter out
    const excludePatterns = [
      /about/i,
      /contact/i,
      /services/i,
      /service/i,
      /blog/i,
      /resources/i,
      /faq/i,
      /appointment/i,
      /booking/i,
      /insurance/i,
      /location/i,
      /home/i,
      /index/i,
      /privacy/i,
      /terms/i,
      /policy/i,
      /therapy/i,        // Filter out therapy type pages
      /care/i,           // Filter out care type pages
      /treatment/i,      // Filter out treatment pages
      /approach/i,       // Filter out approach pages
      /specialties/i,    // Filter out specialties pages
      /modalities/i      // Filter out modalities pages
    ];

    // Keywords that indicate a service/info page rather than a provider
    const serviceKeywords = [
      'therapy',
      'care',
      'treatment',
      'approach',
      'service',
      'specialty',
      'modality',
      'counseling',
      'psychotherapy',
      'individual',
      'couples',
      'family',
      'group',
      'collaborative',
      'integrative',
      'medication',
      'management',
      'mutism',
      'folder',
      'about me',
      'who we are',
      'meet the team'
    ];

    // Strategy 1: Look for links in sections with team/provider keywords
    const teamSections = $('section, div, nav').filter((i, el) => {
      const text = $(el).text().toLowerCase();
      const id = $(el).attr('id') || '';
      const className = $(el).attr('class') || '';

      return text.includes('meet the team') ||
             text.includes('our team') ||
             text.includes('our providers') ||
             text.includes('our therapists') ||
             text.includes('our clinicians') ||
             id.includes('team') ||
             id.includes('provider') ||
             className.includes('team') ||
             className.includes('provider');
    });

    // Extract links from team sections
    teamSections.find('a').each((i, el) => {
      const href = $(el).attr('href');
      const linkText = $(el).text().trim();

      if (!href || !linkText) return;

      // Normalize URL (handle relative URLs)
      let url = href;
      if (href.startsWith('/')) {
        // Relative URL - prepend base URL
        const baseUrl = new URL(WEBSITE_URL);
        url = `${baseUrl.protocol}//${baseUrl.host}${href}`;
      } else if (!href.startsWith('http')) {
        // Relative URL without leading slash
        url = `${WEBSITE_URL}/${href}`;
      }

      // Skip if already seen
      if (seenUrls.has(url)) return;

      // Skip if matches exclude patterns
      if (excludePatterns.some(pattern => pattern.test(url))) return;

      // Skip if link text is too generic or too long
      if (linkText.length < 3 || linkText.length > 100) return;

      // Skip if link text contains slashes (service pages like "Parent Coaching/Consultation")
      if (linkText.includes('/')) return;

      // Skip if link text contains common non-provider keywords
      const lowerText = linkText.toLowerCase();
      if (lowerText.includes('learn more') ||
          lowerText.includes('read more') ||
          lowerText.includes('click here') ||
          lowerText.includes('view all') ||
          lowerText.includes('see all')) {
        return;
      }

      // NEW: Skip if link text is a service keyword (not a person's name)
      // Provider names typically have 2+ words and don't match service keywords
      const words = linkText.split(/\s+/);
      const isServicePage = serviceKeywords.some(keyword =>
        lowerText === keyword || lowerText.includes(keyword + ' ') || lowerText.includes(' ' + keyword)
      );

      if (isServicePage && words.length < 2) {
        // Single word that matches service keyword - skip
        return;
      }

      if (isServicePage && words.length === 2) {
        // Two words that match service keywords - likely "Individual Therapy", "Collaborative Care"
        // Check if both words are service-related
        const allWordsAreServices = words.every(word =>
          serviceKeywords.some(keyword => word.toLowerCase().includes(keyword))
        );
        if (allWordsAreServices) return;
      }

      // NEW: Provider names typically look like "FirstName LastName" or "FirstName LastName, Credentials"
      // Check if this looks like a person's name (has at least 2 words, first word is capitalized)
      if (words.length >= 2) {
        const firstWord = words[0];
        const secondWord = words[1].replace(/,.*$/, ''); // Remove credentials

        // Skip if the entire text matches a service keyword phrase
        if (serviceKeywords.some(keyword => lowerText === keyword || lowerText.startsWith(keyword + ' ') || lowerText.endsWith(' ' + keyword))) {
          return;
        }

        // Both should start with capital letter (typical for names)
        const looksLikeName = /^[A-Z]/.test(firstWord) && /^[A-Z]/.test(secondWord);

        if (!looksLikeName) {
          // Doesn't look like a person's name - skip
          return;
        }
        
        // Additional check: second word should not be a common service word
        const secondWordLower = secondWord.toLowerCase();
        if (serviceKeywords.includes(secondWordLower)) {
          // e.g., "Medication Management", "Selective Mutism"
          return;
        }
      } else {
        // Single word - unlikely to be a provider name, skip
        return;
      }

      // Add to results
      providerLinks.push({
        name: linkText,
        url: url
      });
      seenUrls.add(url);
    });

    // Strategy 2: Look for links matching common provider URL patterns
    // Only if we didn't find links in team sections
    if (providerLinks.length === 0) {
      console.log(`⚠️ No links found in team sections, trying URL pattern matching...`);

      $('a').each((i, el) => {
        const href = $(el).attr('href');
        const linkText = $(el).text().trim();

        if (!href || !linkText) return;

        // Check if URL matches provider patterns
        const providerPatterns = [
          /\/[a-z]+-[a-z]+$/i,           // /firstname-lastname
          /\/providers\/[a-z-]+$/i,       // /providers/name
          /\/team\/[a-z-]+$/i,            // /team/name
          /\/therapists\/[a-z-]+$/i,      // /therapists/name
          /\/clinicians\/[a-z-]+$/i       // /clinicians/name
        ];

        if (!providerPatterns.some(pattern => pattern.test(href))) return;

        // Normalize URL
        let url = href;
        if (href.startsWith('/')) {
          const baseUrl = new URL(WEBSITE_URL);
          url = `${baseUrl.protocol}//${baseUrl.host}${href}`;
        } else if (!href.startsWith('http')) {
          url = `${WEBSITE_URL}/${href}`;
        }

        // Skip if already seen
        if (seenUrls.has(url)) return;

        // Skip if matches exclude patterns
        if (excludePatterns.some(pattern => pattern.test(url))) return;

        // Skip if link text is too generic or too long
        if (linkText.length < 3 || linkText.length > 100) return;

        // Apply same name validation as Strategy 1
        const words = linkText.split(/\s+/);
        if (words.length >= 2) {
          const firstWord = words[0];
          const secondWord = words[1].replace(/,.*$/, '');
          const looksLikeName = /^[A-Z]/.test(firstWord) && /^[A-Z]/.test(secondWord);
          if (!looksLikeName) return;
        } else {
          return; // Single word - skip
        }

        // Add to results
        providerLinks.push({
          name: linkText,
          url: url
        });
        seenUrls.add(url);
      });
    }

    console.log(`✅ Found ${providerLinks.length} provider link(s)`);

    // Log warning if no links found
    if (providerLinks.length === 0) {
      console.warn(`⚠️ No provider links found in HTML. This may indicate:`);
      console.warn(`   - The website structure has changed`);
      console.warn(`   - Provider links are loaded dynamically via JavaScript`);
      console.warn(`   - The "Meet the Team" section uses different keywords`);
    }

    return providerLinks;

  } catch (error) {
    console.error(`❌ Failed to extract provider links: ${error.message}`);
    throw error; // Fatal error - cannot proceed without provider links
  }
}
/**
 * Generate prompt for single provider extraction
 * Creates a focused prompt for extracting information from an individual provider's page.
 * Emphasizes insurance information extraction and specifies the expected JSON response structure.
 *
 * The prompt instructs the AI to:
 * - Focus on a specific provider by name
 * - Extract comprehensive profile information (bio, credentials, contact)
 * - Prioritize insurance provider information (critical for practice operations)
 * - Return structured JSON with name, content, email, phone, and insurance fields
 *
 * @param {string} providerName - Provider name from link text (e.g., "Jeff", "John Doe")
 * @param {string} text - Extracted text content from provider's page
 * @returns {string} Formatted prompt for LLM with provider-specific instructions
 * @example
 * const prompt = generateProviderPrompt("Jeffrey Gillman", pageText);
 * // Returns prompt focusing on extracting Jeffrey Gillman's information
 */
function generateProviderPrompt(providerName, text) {
  return `Extract information for the provider named "${providerName}" from their profile page.

Focus on:
- Full name and credentials (PhD, LMFT, LCSW, PsyD, etc.)
- Professional bio and specialties
- Contact information (email, phone)
- Insurance providers accepted (CRITICAL - look for insurance, accepted plans, payment options, insurance panels)
- Education and training
- Therapeutic approaches and modalities

Return a JSON object with this structure:
{
  "name": "Full Name with Credentials",
  "content": "Complete markdown content for provider file",
  "email": "email@example.com or null",
  "phone": "phone number or null",
  "insurance": ["Insurance Provider 1", "Insurance Provider 2"] or []
}

IMPORTANT:
- The "insurance" field should be an array of insurance provider names
- If no insurance information is found, return an empty array []
- Do not use placeholder text like "Not provided" or "Not available"
- Extract ALL insurance providers mentioned on the page

Website content:
${text}`;
}

/**
 * Generate prompt for practice overview extraction
 * Creates a prompt for extracting general practice information from the homepage.
 * Focuses on practice-level details like mission, services, location, and policies
 * rather than individual provider information.
 *
 * The prompt instructs the AI to:
 * - Extract practice name and mission statement
 * - Identify services offered by the practice
 * - Capture location and contact information
 * - Note general policies and practice information
 * - Return structured JSON with practiceOverview field
 *
 * @param {string} text - Extracted text content from homepage
 * @returns {string} Formatted prompt for LLM with practice overview instructions
 * @example
 * const prompt = generatePracticeOverviewPrompt(homepageText);
 * // Returns prompt focusing on extracting practice-level information
 */
function generatePracticeOverviewPrompt(text) {
  return `Extract general practice information from the homepage.

Focus on:
- Practice name and mission statement
- Services offered (therapy types, specializations)
- Location and contact information (address, phone, email)
- General policies (hours, payment options, accessibility)
- Practice philosophy and approach

Return a JSON object with this structure:
{
  "practiceOverview": "Complete markdown content for practice overview"
}

IMPORTANT:
- Focus on practice-level information, not individual providers
- The "practiceOverview" field should contain well-formatted markdown
- Include all relevant practice details found on the homepage
- Do not include individual provider profiles

Website content:
${text}`;
}

/**
 * Call LLM for single provider extraction
 * Sends provider page content to OpenRouter API for AI-powered extraction of provider information.
 * Handles various JSON response formats (code blocks, backticks, "json" prefix) and validates
 * the response structure. Normalizes the insurance field to ensure it's always an array.
 *
 * Process flow:
 * 1. Generate prompt using generateProviderPrompt
 * 2. Call OpenRouter API with provider-specific prompt
 * 3. Parse JSON response (handle markdown code blocks and backticks)
 * 4. Validate response structure (name and content required)
 * 5. Normalize insurance field to array
 * 6. Return provider data object
 *
 * Error handling:
 * - Throws error if API call fails
 * - Throws error if response is not valid JSON
 * - Throws error if required fields (name, content) are missing
 * - Logs detailed error information for debugging
 *
 * @param {string} providerName - Provider name from link text (e.g., "Jeff", "John Doe")
 * @param {string} text - Extracted text content from provider's page
 * @returns {Promise<object>} Provider data object
 * @returns {string} returns.name - Provider's full name with credentials
 * @returns {string} returns.content - Markdown content for provider file
 * @returns {string|null} returns.email - Email address or null
 * @returns {string|null} returns.phone - Phone number or null
 * @returns {string[]} returns.insurance - Array of insurance provider names (empty array if none)
 * @throws {Error} Throws error with type 'llm' if API call or parsing fails
 * @example
 * const providerData = await callLLMForProvider("Jeffrey Gillman", pageText);
 * // returns { name: "Jeffrey Gillman, PhD", content: "...", email: "...", phone: "...", insurance: [...] }
 */
async function callLLMForProvider(providerName, text) {
  console.log(`🤖 Calling LLM for provider: ${providerName}`);

  if (!OPENROUTER_API_KEY) {
    const error = new Error('OPENROUTER_API_KEY not set in environment');
    error.type = 'llm';
    throw error;
  }

  // Create OpenRouter client
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Phone Receptionist - Provider Scraper'
    }
  });

  // Generate prompt using generateProviderPrompt
  const prompt = generateProviderPrompt(providerName, text);

  try {
    // Call OpenRouter API
    console.log(`⏳ Waiting for AI response for ${providerName}...`);

    const response = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,  // Lower temperature for more consistent extraction
      max_tokens: 4000   // Sufficient for single provider
    });

    const content = response.choices[0].message.content;
    console.log(`✅ Received response from OpenRouter for ${providerName}`);

    // Parse JSON from response - handle various formats the AI might return
    let jsonText = content.trim();

    // Try to extract JSON from markdown code blocks: ```json\n{...}\n```
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    } else {
      // No code block, might have backticks or "json" prefix directly
      // Remove leading backticks
      jsonText = jsonText.replace(/^`+/, '').trim();

      // Remove "json" prefix if present (case insensitive)
      if (jsonText.toLowerCase().startsWith('json')) {
        jsonText = jsonText.substring(4).trim();
      }

      // Remove trailing backticks
      jsonText = jsonText.replace(/`+$/, '').trim();
    }

    // Parse JSON
    let providerData;
    try {
      providerData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error(`❌ Failed to parse JSON for ${providerName}`);
      console.error(`📋 Problematic JSON (first 500 chars):`);
      console.error(jsonText.substring(0, 500));

      const error = new Error(`Failed to parse JSON response: ${parseError.message}`);
      error.type = 'llm';
      throw error;
    }

    // Validate response structure (name and content required)
    if (!providerData.name || typeof providerData.name !== 'string' || providerData.name.trim() === '') {
      const error = new Error('Invalid response structure: missing or invalid "name" field');
      error.type = 'llm';
      throw error;
    }

    if (!providerData.content || typeof providerData.content !== 'string' || providerData.content.trim() === '') {
      const error = new Error('Invalid response structure: missing or invalid "content" field');
      error.type = 'llm';
      throw error;
    }

    // Normalize insurance field to array
    if (!providerData.insurance) {
      console.warn(`⚠️ Provider "${providerData.name}" missing insurance field, setting to empty array`);
      providerData.insurance = [];
    }
    // Convert string to array if necessary
    else if (typeof providerData.insurance === 'string') {
      console.warn(`⚠️ Provider "${providerData.name}" has insurance as string, converting to array`);
      // If it's a placeholder message, convert to empty array
      if (providerData.insurance.toLowerCase().includes('not provided') ||
          providerData.insurance.toLowerCase().includes('not available') ||
          providerData.insurance.toLowerCase().includes('no insurance')) {
        providerData.insurance = [];
      }
      // Otherwise, try to parse comma-separated values
      else {
        providerData.insurance = providerData.insurance
          .split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0);
      }
    }
    // Ensure it's actually an array
    else if (!Array.isArray(providerData.insurance)) {
      console.warn(`⚠️ Provider "${providerData.name}" has invalid insurance type, setting to empty array`);
      providerData.insurance = [];
    }

    console.log(`✅ Successfully extracted data for ${providerName}`);
    return providerData;

  } catch (error) {
    console.error(`❌ Failed to call LLM for ${providerName}: ${error.message}`);

    // Ensure error has type field
    if (!error.type) {
      error.type = 'llm';
    }

    // Log API response if available
    if (error.response) {
      console.error(`   API response: ${JSON.stringify(error.response.data)}`);
    }

    throw error;
  }
}

/**
 * Extract practice overview from homepage
 * Sends homepage content to OpenRouter API for AI-powered extraction of practice-level information.
 * Handles various JSON response formats (code blocks, backticks, "json" prefix) and validates
 * the response structure. This is a non-fatal operation - errors are logged but don't stop execution.
 *
 * Process flow:
 * 1. Generate prompt using generatePracticeOverviewPrompt
 * 2. Call OpenRouter API with practice overview prompt
 * 3. Parse JSON response (handle markdown code blocks and backticks)
 * 4. Validate response structure (practiceOverview field required)
 * 5. Return practice overview string
 *
 * Error handling:
 * - Returns null if API call fails (non-fatal)
 * - Returns null if response is not valid JSON (non-fatal)
 * - Returns null if required field (practiceOverview) is missing (non-fatal)
 * - Logs warning for all errors (non-fatal operation)
 *
 * @param {string} html - Homepage HTML content (unused but kept for consistency)
 * @param {string} text - Extracted text content from homepage
 * @returns {Promise<string|null>} Practice overview markdown content or null on error
 * @example
 * const overview = await extractPracticeOverview(homepageHtml, homepageText);
 * // returns "# Relational Therapy Collective\n\nWe are a group practice..." or null
 */
async function extractPracticeOverview(html, text) {
  console.log(`🏢 Extracting practice overview from homepage`);

  if (!OPENROUTER_API_KEY) {
    console.warn(`⚠️ OPENROUTER_API_KEY not set, skipping practice overview extraction`);
    return null;
  }

  // Create OpenRouter client
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Phone Receptionist - Provider Scraper'
    }
  });

  // Generate prompt using generatePracticeOverviewPrompt
  const prompt = generatePracticeOverviewPrompt(text);

  try {
    // Call OpenRouter API
    console.log(`⏳ Waiting for AI response for practice overview...`);

    const response = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,  // Lower temperature for more consistent extraction
      max_tokens: 4000   // Sufficient for practice overview
    });

    const content = response.choices[0].message.content;
    console.log(`✅ Received response from OpenRouter for practice overview`);

    // Parse JSON from response - handle various formats the AI might return
    let jsonText = content.trim();

    // Try to extract JSON from markdown code blocks: ```json\n{...}\n```
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    } else {
      // No code block, might have backticks or "json" prefix directly
      // Remove leading backticks
      jsonText = jsonText.replace(/^`+/, '').trim();

      // Remove "json" prefix if present (case insensitive)
      if (jsonText.toLowerCase().startsWith('json')) {
        jsonText = jsonText.substring(4).trim();
      }

      // Remove trailing backticks
      jsonText = jsonText.replace(/`+$/, '').trim();
    }

    // Parse JSON
    let practiceData;
    try {
      practiceData = JSON.parse(jsonText);
    } catch (parseError) {
      console.warn(`⚠️ Failed to parse JSON for practice overview: ${parseError.message}`);
      console.warn(`📋 Problematic JSON (first 500 chars):`);
      console.warn(jsonText.substring(0, 500));
      return null;
    }

    // Validate response structure (practiceOverview field required)
    if (!practiceData.practiceOverview || typeof practiceData.practiceOverview !== 'string' || practiceData.practiceOverview.trim() === '') {
      console.warn(`⚠️ Invalid response structure: missing or invalid "practiceOverview" field`);
      return null;
    }

    console.log(`✅ Successfully extracted practice overview`);
    return practiceData.practiceOverview;

  } catch (error) {
    console.warn(`⚠️ Failed to extract practice overview: ${error.message}`);

    // Log API response if available
    if (error.response) {
      console.warn(`   API response: ${JSON.stringify(error.response.data)}`);
    }

    // Return null (non-fatal error)
    return null;
  }
}

/**
 * Write practice overview to file
 * Writes the practice overview markdown content to data/practice/practice-overview.md.
 * Creates the practice directory if it doesn't exist. This function reuses the existing
 * directory creation logic pattern used throughout the scraper.
 *
 * The practice overview file contains general practice information extracted from the homepage,
 * including practice name, mission, services, location, and policies. This is separate from
 * individual provider profiles which are stored in data/providers/.
 *
 * Directory creation:
 * - Uses fs.mkdirSync with recursive: true to create parent directories if needed
 * - Checks if directory exists before creating to avoid unnecessary operations
 * - Logs directory creation for transparency
 *
 * File writing:
 * - Writes to data/practice/practice-overview.md
 * - Uses UTF-8 encoding for proper character support
 * - Overwrites existing file if present
 * - Logs success message after writing
 *
 * @param {string} practiceOverview - Markdown content for practice overview
 * @returns {void}
 * @throws {Error} Throws error if directory creation or file writing fails
 * @example
 * const overview = await extractPracticeOverview(html, text);
 * if (overview) {
 *   writePracticeOverview(overview);
 * }
 */
function writePracticeOverview(practiceOverview) {
  console.log(`📝 Writing practice overview to file`);

  // Ensure practice directory exists (reuse existing directory creation logic)
  const practiceDir = path.join(__dirname, '..', 'data', 'practice');
  if (!fs.existsSync(practiceDir)) {
    fs.mkdirSync(practiceDir, { recursive: true });
    console.log(`📁 Created directory: ${practiceDir}`);
  }

  // Write practice overview to data/practice/practice-overview.md
  const overviewPath = path.join(practiceDir, 'practice-overview.md');
  fs.writeFileSync(overviewPath, practiceOverview, 'utf-8');
  console.log(`✅ Wrote practice-overview.md to data/practice/`);
}



/**
 * Extract text content from HTML, excluding unwanted elements
 * Removes script, style, nav, and footer elements, then normalizes whitespace
 * @param {string} html - Raw HTML content
 * @returns {string} Cleaned text content with normalized whitespace
 * @throws {Error} Exits process if HTML parsing fails
 */
function extractText(html) {
  console.log(`📄 Extracting text content from HTML`);
  
  try {
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, nav, footer').remove();
    
    // Get all text content from body
    const text = $('body').text()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
    
    console.log(`✅ Text extracted (${text.length} characters)`);
    return text;
  } catch (error) {
    console.error(`❌ Failed to extract text: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Generate provider summaries using OpenRouter API
 * Sends website content to AI for structured extraction of practice overview and provider profiles
 * Handles various JSON response formats (code blocks, backticks, etc.)
 * Validates and normalizes insurance field to ensure it's always an array
 * @param {string} text - Extracted website text content
 * @returns {Promise<object>} Summaries object with practiceOverview (string) and providers (array)
 * @throws {Error} Exits process if API call fails or response is invalid
 */
async function generateSummaries(text) {
  console.log(`🤖 Sending content to OpenRouter API for summarization`);
  
  if (!OPENROUTER_API_KEY) {
    console.error(`❌ OPENROUTER_API_KEY not set in environment`);
    process.exit(1);
  }
  
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Phone Receptionist - Provider Scraper'
    }
  });
  
  // Load scraping instructions from prompts file
  const scrapingInstructions = prompts.scrapingInstructions || 
    'Extract practice and provider information from the website content.';
  
  const prompt = `${scrapingInstructions}

Website content:
${text}`;

  try {
    // Start a progress indicator
    console.log(`⏳ Waiting for AI response (this may take 30-60 seconds)...`);
    const progressInterval = setInterval(() => {
      process.stdout.write('.');
    }, 2000);
    
    const response = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,  // Lower temperature for more consistent extraction
      max_tokens: 8000   // Increased to handle large responses
    });
    
    clearInterval(progressInterval);
    process.stdout.write('\n');
    
    const content = response.choices[0].message.content;
    console.log(`✅ Received response from OpenRouter`);
    
    // Parse JSON from response - handle various formats the AI might return
    let jsonText = content.trim();
    
    // Try to extract JSON from markdown code blocks: ```json\n{...}\n```
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    } else {
      // No code block, might have backticks or "json" prefix directly
      // Remove leading backticks
      jsonText = jsonText.replace(/^`+/, '').trim();
      
      // Remove "json" prefix if present (case insensitive) - only if not in code block
      if (jsonText.toLowerCase().startsWith('json')) {
        jsonText = jsonText.substring(4).trim();
      }
      
      // Remove trailing backticks
      jsonText = jsonText.replace(/`+$/, '').trim();
    }
    
    const summaries = JSON.parse(jsonText);
    
    // Validate structure
    if (!summaries.practiceOverview || !Array.isArray(summaries.providers)) {
      throw new Error('Invalid response structure: missing practiceOverview or providers array');
    }
    
    // Validate and normalize insurance field for each provider
    for (const provider of summaries.providers) {
      // Ensure insurance field exists
      if (!provider.insurance) {
        console.warn(`⚠️ Provider "${provider.name}" missing insurance field, setting to empty array`);
        provider.insurance = [];
      }
      // Convert string to array if necessary
      else if (typeof provider.insurance === 'string') {
        console.warn(`⚠️ Provider "${provider.name}" has insurance as string, converting to array`);
        // If it's a placeholder message, convert to empty array
        if (provider.insurance.toLowerCase().includes('not provided') || 
            provider.insurance.toLowerCase().includes('not available') ||
            provider.insurance.toLowerCase().includes('no insurance')) {
          provider.insurance = [];
        }
        // Otherwise, try to parse comma-separated values
        else {
          provider.insurance = provider.insurance
            .split(',')
            .map(item => item.trim())
            .filter(item => item.length > 0);
        }
      }
      // Ensure it's actually an array
      else if (!Array.isArray(provider.insurance)) {
        console.warn(`⚠️ Provider "${provider.name}" has invalid insurance type, setting to empty array`);
        provider.insurance = [];
      }
    }
    
    console.log(`✅ Parsed summaries: 1 practice overview + ${summaries.providers.length} providers`);
    return summaries;
    
  } catch (error) {
    console.error(`❌ Failed to generate summaries: ${error.message}`);
    if (error.response) {
      console.error(`   API response: ${JSON.stringify(error.response.data)}`);
    }
    // If JSON parse error, show the problematic content
    if (error instanceof SyntaxError && jsonText) {
      console.error(`\n📋 Problematic JSON (first 500 chars):`);
      console.error(jsonText.substring(0, 500));
      console.error(`\n📋 Problematic JSON (last 500 chars):`);
      console.error(jsonText.substring(Math.max(0, jsonText.length - 500)));
    }
    process.exit(1);
  }
}

/**
 * Convert provider name to kebab-case slug
 * Removes non-alphanumeric characters (except spaces and hyphens), converts to lowercase,
 * replaces spaces with hyphens, and collapses multiple hyphens
 * @param {string} name - Provider name to convert
 * @returns {string} Kebab-case slug (e.g., "john-doe")
 */
function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .trim();
}

/**
 * Normalize a provider name to a canonical slug
 * Removes credentials (PhD, LMFT, LCSW, PsyD, MD, DO, MA, MS, MSW, MEd, LPC, LPCC, LMHC),
 * middle initials, and extracts first and last name only. This ensures consistent
 * slug generation regardless of how the name is formatted (e.g., "Jeffrey B. Gillman, PhD"
 * and "Jeffrey Gillman" both normalize to "jeffrey-gillman").
 * 
 * Normalization logic:
 * 1. Remove all credentials using regex pattern matching
 * 2. Remove commas (from credential lists)
 * 3. Collapse multiple whitespace to single spaces
 * 4. Remove middle initials (single letters with optional periods)
 * 5. Extract first and last name components (first word and last word)
 * 6. Apply nameToSlug() to generate final kebab-case slug
 * 
 * @param {string} fullName - Provider name with credentials, middle initials, etc.
 * @returns {string} Normalized slug (e.g., "jeffrey-gillman")
 * @example
 * normalizeProviderName("Jeffrey B. Gillman, PhD") // returns "jeffrey-gillman"
 * normalizeProviderName("Miri Arie, PhD, LMFT") // returns "miri-arie"
 * normalizeProviderName("John Q. Public") // returns "john-public"
 */
function normalizeProviderName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    console.warn(`⚠️ Invalid name input: ${fullName}`);
    return '';
  }
  
  let cleanedName = fullName.trim();
  
  // Handle empty or non-alphabetic names
  if (!cleanedName || !/[a-zA-Z]/.test(cleanedName)) {
    console.warn(`⚠️ Name contains no alphabetic characters: ${fullName}`);
    return '';
  }
  
  // Remove credentials (PhD, LMFT, LCSW, PsyD, MD, DO, MA, MS, MSW, MEd, LPC, LPCC, LMHC)
  // Pattern matches credentials with optional commas and spaces
  const credentialPattern = /,?\s*(PhD|PsyD|MD|DO|LMFT|LCSW|LMHC|LPC|LPCC|MA|MS|MSW|MEd)\b/gi;
  cleanedName = cleanedName.replace(credentialPattern, '');
  
  // Remove any remaining commas (from credential lists)
  cleanedName = cleanedName.replace(/,/g, ' ');
  
  // Collapse multiple whitespace to single spaces
  cleanedName = cleanedName.replace(/\s+/g, ' ').trim();
  
  // Remove middle initials (single letter with optional period, surrounded by spaces)
  // Matches patterns like " B. " or " B " but not at the start or end
  cleanedName = cleanedName.replace(/\s+[A-Z]\.?\s+/g, ' ');
  
  // Extract first and last name (first word and last word)
  const nameParts = cleanedName.split(/\s+/).filter(part => part.length > 0);
  
  if (nameParts.length === 0) {
    console.warn(`⚠️ No name parts remaining after cleaning: ${fullName}`);
    return '';
  }
  
  // Use first and last name only
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  
  // Combine first and last name
  const normalizedName = lastName ? `${firstName} ${lastName}` : firstName;
  
  // Truncate extremely long names
  const truncatedName = normalizedName.length > 100 
    ? normalizedName.substring(0, 100) 
    : normalizedName;
  
  if (truncatedName.length < normalizedName.length) {
    console.warn(`⚠️ Name truncated from ${normalizedName.length} to 100 characters: ${fullName}`);
  }
  
  // Apply existing nameToSlug function
  return nameToSlug(truncatedName);
}
/**
 * Process a single provider page
 * Fetches provider page, extracts text, saves cache, and returns result object.
 * This function is designed to be resilient - it catches all errors and returns
 * a result object with error details rather than throwing, allowing the scraper
 * to continue processing remaining providers.
 *
 * Process flow:
 * 1. Log progress: "Processing provider X of Y: [name]"
 * 2. Start timer for duration tracking
 * 3. Fetch provider page using fetchWebsite (with retry logic)
 * 4. Extract text using extractText
 * 5. Save cache with provider-specific filename
 * 6. Return result object with success status and metadata
 *
 * Error handling:
 * - All errors are caught at function level
 * - Errors are logged with provider name and details
 * - Result object includes error field with type, message, url
 * - Never throws (allows processing to continue)
 *
 * @param {object} providerLink - Provider link object {name, url}
 * @param {string} providerLink.name - Provider name from link text
 * @param {string} providerLink.url - Full URL to provider page
 * @param {Browser} browser - Puppeteer browser instance (optional, null for axios mode)
 * @param {number} index - Provider index for progress tracking (1-based)
 * @param {number} total - Total number of providers
 * @returns {Promise<object>} Result object with status, slug, warnings, errors
 * @returns {boolean} returns.success - Overall success status
 * @returns {string} returns.providerName - Provider name
 * @returns {string} returns.slug - Normalized slug for filename (empty string if normalization failed)
 * @returns {string} returns.operation - 'created' | 'updated' | 'skipped'
 * @returns {string[]} returns.warnings - Validation warnings (empty array if none)
 * @returns {object|null} returns.error - Error details if failed, null if successful
 * @returns {string} returns.error.type - Error type: 'timeout' | 'navigation' | 'parsing' | 'llm' | 'unknown'
 * @returns {string} returns.error.message - Error message
 * @returns {string} returns.error.url - URL that failed
 * @returns {number} returns.duration - Processing time in milliseconds
 * @example
 * const result = await processSingleProvider(
 *   { name: "John Doe", url: "https://example.com/john" },
 *   browser,
 *   1,
 *   10
 * );
 * // returns { success: true, providerName: "John Doe", slug: "john-doe", operation: "created", ... }
 */
async function processSingleProvider(providerLink, browser, index, total) {
  const startTime = Date.now();
  const providerName = providerLink.name;

  // Initialize result object
  const result = {
    success: false,
    providerName: providerName,
    slug: '',
    operation: 'skipped',
    warnings: [],
    error: null,
    duration: 0
  };

  try {
    // Log progress: "Processing provider X of Y: [name]"
    console.log(`\n📋 Processing provider ${index} of ${total}: ${providerName}`);

    // Fetch provider page using fetchWebsite (with retry logic)
    let html;
    try {
      html = await fetchWebsite(providerLink.url, browser, providerName);
    } catch (error) {
      // Fetch failed - populate error details and return
      result.duration = Date.now() - startTime;
      result.error = {
        type: error.type || 'unknown',
        message: error.message,
        provider: providerName,
        url: providerLink.url,
        attempts: error.attempts || MAX_RETRIES,
        duration: result.duration
      };
      console.error(`❌ Failed to fetch provider page: ${error.message}`);
      return result;
    }

    // Extract text using extractText
    let text;
    try {
      text = extractText(html);
    } catch (error) {
      // Extract failed - populate error details and return
      result.duration = Date.now() - startTime;
      result.error = {
        type: 'parsing',
        message: error.message,
        provider: providerName,
        url: providerLink.url,
        attempts: 1,
        duration: result.duration
      };
      console.error(`❌ Failed to extract text: ${error.message}`);
      return result;
    }

    // Save cache with provider-specific filename (before LLM call for debugging)
    try {
      saveScrapeCache(html, text, providerLink.url, providerName);
    } catch (error) {
      // Cache save failure is non-critical - log warning and continue
      console.warn(`⚠️ Failed to save cache for ${providerName}: ${error.message}`);
    }

    // Call LLM for provider extraction
    let providerData;
    try {
      providerData = await callLLMForProvider(providerName, text);
    } catch (error) {
      // LLM call failed - populate error details and return
      result.duration = Date.now() - startTime;
      result.error = {
        type: error.type || 'llm',
        message: error.message,
        provider: providerName,
        url: providerLink.url,
        attempts: 1,
        duration: result.duration
      };
      console.error(`❌ Failed to call LLM for ${providerName}: ${error.message}`);
      return result;
    }

    // Normalize provider name to slug
    const slug = normalizeProviderName(providerData.name);
    result.slug = slug;

    // Skip if normalization failed
    if (!slug) {
      console.warn(`⚠️ Skipping provider with invalid name: ${providerData.name}`);
      result.operation = 'skipped';
      result.duration = Date.now() - startTime;
      console.log(`⏱️  Duration: ${result.duration}ms`);
      return result;
    }

    // Validate provider data before writing (non-blocking)
    const validationResult = validateProvider(providerData);
    
    // Log warnings to console (non-blocking)
    if (!validationResult.valid && validationResult.warnings.length > 0) {
      console.warn(`⚠️ Validation warnings for ${providerData.name}:`);
      validationResult.warnings.forEach(warning => {
        console.warn(`   - ${warning}`);
      });
      
      // Store warnings in result object
      result.warnings = validationResult.warnings;
    }

    // Ensure providers directory exists
    if (!fs.existsSync(PROVIDERS_DIR)) {
      fs.mkdirSync(PROVIDERS_DIR, { recursive: true });
      console.log(`📁 Created directory: ${PROVIDERS_DIR}`);
    }

    // Check for duplicate (existing file)
    const fileExists = providerFileExists(slug);
    
    const filename = `${slug}.md`;
    const filepath = path.join(PROVIDERS_DIR, filename);
    
    // Write the file (continue even with validation warnings)
    try {
      fs.writeFileSync(filepath, providerData.content, 'utf-8');
      
      // Log and track operation
      if (fileExists) {
        console.log(`🔄 Updated existing file: ${filename}`);
        result.operation = 'updated';
      } else {
        console.log(`✅ Created new file: ${filename}`);
        result.operation = 'created';
      }
      
      // Mark as successful
      result.success = true;
      
    } catch (error) {
      // File write failed - populate error details and return
      result.duration = Date.now() - startTime;
      result.error = {
        type: 'filesystem',
        message: error.message,
        provider: providerName,
        url: providerLink.url,
        attempts: 1,
        duration: result.duration
      };
      console.error(`❌ Failed to write file for ${providerName}: ${error.message}`);
      return result;
    }

    result.duration = Date.now() - startTime;

    // Log duration
    console.log(`⏱️  Duration: ${result.duration}ms`);

    return result;

  } catch (error) {
    // Catch-all for any unexpected errors
    result.duration = Date.now() - startTime;
    result.error = {
      type: 'unknown',
      message: error.message,
      provider: providerName,
      url: providerLink.url,
      attempts: 1,
      duration: result.duration
    };
    console.error(`❌ Unexpected error processing ${providerName}: ${error.message}`);
    return result;
  }
}

/**
 * Save scraped content to cache file for debugging
 * Stores raw HTML, extracted text, and metadata to help diagnose extraction issues
 * @param {string} html - Raw HTML content from website
 * @param {string} text - Extracted text content sent to LLM
 * @param {string} url - Website URL that was scraped
 */
/**
 * Save scraped content to cache file for debugging
 * Stores raw HTML, extracted text, and metadata to help diagnose extraction issues.
 * Supports both homepage caching (without provider name) and per-provider caching
 * (with provider name in filename and data structure).
 *
 * @param {string} html - Raw HTML content from website
 * @param {string} text - Extracted text content sent to LLM
 * @param {string} url - Website URL that was scraped
 * @param {string} [providerName] - Optional provider name for per-provider caching
 * @returns {string|null} Cache file path if successful, null if failed
 * @example
 * // Homepage cache
 * saveScrapeCache(html, text, "https://example.com")
 * // returns "data/scrape-cache/scrape-2024-01-15T10-30-45-123Z.json"
 *
 * // Provider cache
 * saveScrapeCache(html, text, "https://example.com/john", "John Doe")
 * // returns "data/scrape-cache/scrape-john-doe-2024-01-15T10-30-45-123Z.json"
 */
function saveScrapeCache(html, text, url, providerName = null) {
  try {
    const cacheDir = path.join(__dirname, '..', 'data', 'scrape-cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const cacheData = {
      timestamp: new Date().toISOString(),
      url: url,
      scrapingMode: SCRAPING_MODE,
      htmlLength: html.length,
      textLength: text.length,
      rawHtml: html,
      extractedText: text
    };

    // Include provider name in cache data if provided
    if (providerName) {
      cacheData.provider = providerName;
    }

    // Generate filename with provider slug if provided
    let filename;
    if (providerName) {
      const providerSlug = normalizeProviderName(providerName);
      filename = `scrape-${providerSlug}-${timestamp}.json`;
    } else {
      filename = `scrape-${timestamp}.json`;
    }

    const cacheFile = path.join(cacheDir, filename);
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log(`💾 Saved scrape cache to: ${cacheFile}`);

    return cacheFile;
  } catch (error) {
    console.warn(`⚠️  Failed to save scrape cache: ${error.message}`);
    return null;
  }
}

/**
 * Check if a provider file already exists in the providers directory
 * Used for duplicate detection to prevent creating multiple files for the same provider
 * @param {string} slug - Normalized provider slug (e.g., "jeffrey-gillman")
 * @returns {boolean} True if file exists, false otherwise
 */
function providerFileExists(slug) {
  const filepath = path.join(PROVIDERS_DIR, `${slug}.md`);
  return fs.existsSync(filepath);
}

/**
 * Find existing provider file path in the providers directory
 * Returns the full file path if the provider file exists, null otherwise
 * @param {string} slug - Normalized provider slug (e.g., "jeffrey-gillman")
 * @returns {string|null} Full file path if exists, null otherwise
 */
function findExistingProviderFile(slug) {
  const filepath = path.join(PROVIDERS_DIR, `${slug}.md`);
  return fs.existsSync(filepath) ? filepath : null;
}

/**
 * Validate email format using standard email regex pattern
 * Checks for basic email structure (local@domain.tld) and rejects invalid patterns
 * like consecutive dots, leading/trailing dots, or dots adjacent to @ symbol
 * 
 * Validation rules:
 * - Must contain @ symbol with text before and after
 * - Must have domain with at least one dot
 * - No consecutive dots (..)
 * - No leading or trailing dots
 * - No dots immediately before or after @ symbol
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid format, false otherwise
 * @example
 * isValidEmail("user@example.com") // returns true
 * isValidEmail("user..name@example.com") // returns false (consecutive dots)
 * isValidEmail("user@.example.com") // returns false (dot after @)
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  // Standard email regex pattern - rejects consecutive dots and leading/trailing dots
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Additional check: no consecutive dots, no leading/trailing dots in local or domain part
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.') || 
      email.includes('@.') || email.includes('.@')) {
    return false;
  }
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * Accepts phone numbers containing only digits, spaces, parentheses, and hyphens
 * Does not validate specific phone number patterns (e.g., US format), only character validity
 * 
 * Validation rules:
 * - Must contain only: digits (0-9), spaces, parentheses (), and hyphens (-)
 * - No letters or special characters allowed
 * 
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid format, false otherwise
 * @example
 * isValidPhone("(555) 123-4567") // returns true
 * isValidPhone("555-123-4567") // returns true
 * isValidPhone("555.123.4567") // returns false (dots not allowed)
 * isValidPhone("555-CALL-NOW") // returns false (letters not allowed)
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  // Phone should contain only digits, spaces, parentheses, and hyphens
  const phoneRegex = /^[\d\s()\-]+$/;
  return phoneRegex.test(phone);
}

/**
 * Validate provider data structure and content
 * Performs comprehensive validation of provider object including required fields,
 * email format, phone format, and insurance information. Returns validation result
 * with warnings array for any issues found.
 * 
 * Validation rules:
 * - Required fields: name (non-empty string), content (non-empty string)
 * - Email: Must match standard email format if present
 * - Phone: Must contain only digits, spaces, parentheses, hyphens if present
 * - Insurance: Warns if empty array or missing
 * 
 * This function is non-blocking - it returns warnings but does not prevent file creation.
 * All validation errors are logged and included in the scraping report.
 * 
 * @param {object} provider - Provider object from AI extraction
 * @param {string} provider.name - Provider's full name
 * @param {string} provider.content - Provider's markdown content
 * @param {string} [provider.email] - Provider's email address (optional)
 * @param {string} [provider.phone] - Provider's phone number (optional)
 * @param {string[]} [provider.insurance] - Array of insurance providers (optional)
 * @returns {object} Validation result object
 * @returns {boolean} returns.valid - True if no warnings, false if warnings exist
 * @returns {string[]} returns.warnings - Array of warning messages
 * @example
 * validateProvider({ name: "John Doe", content: "Bio...", insurance: [] })
 * // returns { valid: false, warnings: ["Insurance information is empty or missing"] }
 */
function validateProvider(provider) {
  const warnings = [];
  
  // Handle null/undefined inputs gracefully
  if (!provider || typeof provider !== 'object') {
    console.warn('⚠️ validateProvider received invalid input:', provider);
    return {
      valid: false,
      warnings: [
        'Missing or invalid name field',
        'Missing or invalid content field',
        'Insurance information is empty or missing'
      ]
    };
  }
  
  // Check for required fields
  if (!provider.name || typeof provider.name !== 'string' || provider.name.trim() === '') {
    warnings.push('Missing or invalid name field');
  }
  
  if (!provider.content || typeof provider.content !== 'string' || provider.content.trim() === '') {
    warnings.push('Missing or invalid content field');
  }
  
  // Validate email format if present
  if (provider.email) {
    if (!isValidEmail(provider.email)) {
      warnings.push(`Invalid email format: ${provider.email}`);
    }
  }
  
  // Validate phone format if present
  if (provider.phone) {
    if (!isValidPhone(provider.phone)) {
      warnings.push(`Invalid phone format: ${provider.phone}`);
    }
  }
  
  // Check if insurance array is empty
  if (!provider.insurance || !Array.isArray(provider.insurance) || provider.insurance.length === 0) {
    warnings.push('Insurance information is empty or missing');
  }
  
  return {
    valid: warnings.length === 0,
    warnings: warnings
  };
}

/**
 * Write provider files to disk with duplicate detection and validation
 * Creates or updates provider markdown files in data/providers/ directory.
 * Uses normalized slugs for consistent file naming and duplicate prevention.
 * Validates each provider before writing and tracks all operations for reporting.
 * 
 * Process flow:
 * 1. Ensure directories exist (data/practice/ and data/providers/)
 * 2. Write practice overview to data/practice/practice-overview.md
 * 3. For each provider:
 *    - Normalize provider name to canonical slug
 *    - Validate provider data (non-blocking)
 *    - Check for existing file (duplicate detection)
 *    - Write or update provider file
 *    - Track operation (created/updated) and validation warnings
 * 4. Return operations object for report generation
 * 
 * @param {object} summaries - Summaries object with practiceOverview and providers array
 * @param {string} summaries.practiceOverview - Practice overview markdown content
 * @param {object[]} summaries.providers - Array of provider objects
 * @returns {Promise<object>} Operations tracking object
 * @returns {string[]} returns.created - Array of slugs for newly created files
 * @returns {string[]} returns.updated - Array of slugs for updated files
 * @returns {object[]} returns.validationWarnings - Array of validation warning objects
 * @throws {Error} Exits process if directory creation or file writing fails
 */
async function writeProviderFiles(summaries) {
  console.log(`📝 Writing provider files`);
  
  // Track operations for reporting
  const operations = {
    created: [],
    updated: [],
    validationWarnings: [],
    errors: []  // Track scraping errors per provider
  };
  
  try {
    // Ensure directories exist
    const practiceDir = path.join(__dirname, '..', 'data', 'practice');
    if (!fs.existsSync(practiceDir)) {
      fs.mkdirSync(practiceDir, { recursive: true });
      console.log(`📁 Created directory: ${practiceDir}`);
    }
    
    if (!fs.existsSync(PROVIDERS_DIR)) {
      fs.mkdirSync(PROVIDERS_DIR, { recursive: true });
      console.log(`📁 Created directory: ${PROVIDERS_DIR}`);
    }
    
    // Write practice overview to data/practice/
    const overviewPath = path.join(practiceDir, 'practice-overview.md');
    fs.writeFileSync(overviewPath, summaries.practiceOverview, 'utf-8');
    console.log(`✅ Wrote practice-overview.md to data/practice/`);
    
    // Write provider files to data/providers/
    const totalProviders = summaries.providers.length;
    let processedCount = 0;
    
    for (const provider of summaries.providers) {
      processedCount++;
      const providerStartTime = Date.now();
      
      // Log progress: "Processing provider X of Y"
      console.log(`\n📋 Processing provider ${processedCount} of ${totalProviders}: ${provider.name}`);
      
      // Use normalized slug for duplicate detection
      const normalizedSlug = normalizeProviderName(provider.name);
      
      // Skip if normalization failed
      if (!normalizedSlug) {
        console.warn(`⚠️ Skipping provider with invalid name: ${provider.name}`);
        const providerDuration = Date.now() - providerStartTime;
        console.log(`⏱️  Duration: ${providerDuration}ms`);
        continue;
      }
      
      // Validate provider data before writing
      const validationResult = validateProvider(provider);
      
      // Log warnings to console (non-blocking)
      if (!validationResult.valid && validationResult.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings for ${provider.name}:`);
        validationResult.warnings.forEach(warning => {
          console.warn(`   - ${warning}`);
        });
        
        // Collect warnings for report generation
        operations.validationWarnings.push({
          provider: provider.name,
          slug: normalizedSlug,
          warnings: validationResult.warnings
        });
      }
      
      // Check for duplicate
      const fileExists = providerFileExists(normalizedSlug);
      
      const filename = `${normalizedSlug}.md`;
      const filepath = path.join(PROVIDERS_DIR, filename);
      
      // Write the file (continue even with validation warnings)
      fs.writeFileSync(filepath, provider.content, 'utf-8');
      
      // Log and track operation
      if (fileExists) {
        console.log(`🔄 Updated existing file: ${filename}`);
        operations.updated.push(normalizedSlug);
      } else {
        console.log(`✅ Created new file: ${filename}`);
        operations.created.push(normalizedSlug);
      }
      
      // Log duration for this provider
      const providerDuration = Date.now() - providerStartTime;
      console.log(`⏱️  Duration: ${providerDuration}ms`);
    }
    
    console.log(`\n📊 Summary: ${operations.created.length} created, ${operations.updated.length} updated, ${operations.validationWarnings.length} with warnings`);
    console.log(`🎉 Successfully wrote ${summaries.providers.length + 1} files`);
    
    return operations;
    
  } catch (error) {
    console.error(`❌ Failed to write files: ${error.message}`);
    process.exit(1);
  }
}
/**
 * Generate comprehensive scraping report in markdown format
 * Creates a detailed report with summary statistics, provider details, validation issues,
 * and recommendations. The report includes operation types (new/updated), insurance status,
 * and all validation warnings organized by category.
 * 
 * Report sections:
 * - Summary: Total counts for providers, operations, and warnings
 * - Providers: Detailed list with slug, status, insurance, and warnings
 * - Validation Issues: Grouped by issue type (insurance, email, phone, other)
 * - Recommendations: Actionable suggestions based on validation results
 * 
 * @param {object} results - Scraping results with providers and operations
 * @param {object} results.summaries - The summaries object with practiceOverview and providers
 * @param {object[]} results.summaries.providers - Array of provider objects
 * @param {object} results.operations - Operations tracking with created, updated, validationWarnings
 * @param {string[]} results.operations.created - Array of slugs for created files
 * @param {string[]} results.operations.updated - Array of slugs for updated files
 * @param {object[]} results.operations.validationWarnings - Array of validation warning objects
 * @returns {string} Formatted markdown report content
 */
function generateScrapingReport(results) {
  const { summaries, operations } = results;
  const timestamp = new Date().toISOString();

  // Calculate summary statistics
  const totalProviders = summaries.providers.length;
  const newFiles = operations.created.length;
  const updatedFiles = operations.updated.length;
  const totalWarnings = operations.validationWarnings.length;
  const totalErrors = operations.errors ? operations.errors.length : 0;

  // Calculate insurance statistics
  const providersWithInsurance = summaries.providers.filter(p => 
    p.insurance && Array.isArray(p.insurance) && p.insurance.length > 0
  );
  const providersWithoutInsurance = summaries.providers.filter(p => 
    !p.insurance || !Array.isArray(p.insurance) || p.insurance.length === 0
  );
  const insuranceCount = providersWithInsurance.length;
  const missingInsuranceCount = providersWithoutInsurance.length;
  const insurancePercentage = totalProviders > 0 
    ? ((insuranceCount / totalProviders) * 100).toFixed(1) 
    : '0.0';

  // Load previous report for comparison if available
  let previousInsuranceCount = null;
  let previousMissingInsuranceCount = null;
  let insuranceCountChange = null;
  let missingInsuranceCountChange = null;
  
  try {
    const reportsDir = path.join(process.cwd(), 'reports');
    if (fs.existsSync(reportsDir)) {
      const reportFiles = fs.readdirSync(reportsDir)
        .filter(f => f.startsWith('scraping-report-') && f.endsWith('.md'))
        .sort()
        .reverse(); // Most recent first
      
      if (reportFiles.length > 0) {
        const previousReportPath = path.join(reportsDir, reportFiles[0]);
        const previousReportContent = fs.readFileSync(previousReportPath, 'utf-8');
        
        // Extract insurance statistics from previous report
        const withInsuranceMatch = previousReportContent.match(/- \*\*Providers with insurance:\*\* (\d+)/);
        const withoutInsuranceMatch = previousReportContent.match(/- \*\*Providers missing insurance:\*\* (\d+)/);
        
        if (withInsuranceMatch) {
          previousInsuranceCount = parseInt(withInsuranceMatch[1]);
          insuranceCountChange = insuranceCount - previousInsuranceCount;
        }
        if (withoutInsuranceMatch) {
          previousMissingInsuranceCount = parseInt(withoutInsuranceMatch[1]);
          missingInsuranceCountChange = missingInsuranceCount - previousMissingInsuranceCount;
        }
      }
    }
  } catch (error) {
    // Silently fail if we can't read previous report - comparison is optional
    console.log(`ℹ️  Could not load previous report for comparison: ${error.message}`);
  }

  // Build report sections
  let report = `# Provider Scraping Report\n\n`;
  report += `**Generated:** ${timestamp}\n\n`;
  report += `---\n\n`;

  // Summary section
  report += `## Summary\n\n`;
  report += `- **Total providers processed:** ${totalProviders}\n`;
  report += `- **New files created:** ${newFiles}\n`;
  report += `- **Existing files updated:** ${updatedFiles}\n`;
  report += `- **Validation warnings:** ${totalWarnings}\n`;
  report += `- **Scraping errors:** ${totalErrors}\n`;
  report += `- **Scraping mode:** ${SCRAPING_MODE}\n`;
  
  // Insurance statistics section
  report += `\n### Insurance Data Statistics\n\n`;
  report += `- **Providers with insurance:** ${insuranceCount} (${insurancePercentage}%)`;
  if (previousInsuranceCount !== null && insuranceCountChange !== null) {
    const changeSymbol = insuranceCountChange > 0 ? '📈' : insuranceCountChange < 0 ? '📉' : '➡️';
    const changeText = insuranceCountChange > 0 ? `+${insuranceCountChange}` : insuranceCountChange;
    report += ` ${changeSymbol} (${changeText} from previous run)`;
  }
  report += `\n`;
  
  report += `- **Providers missing insurance:** ${missingInsuranceCount}`;
  if (previousMissingInsuranceCount !== null && missingInsuranceCountChange !== null) {
    const changeSymbol = missingInsuranceCountChange > 0 ? '📈' : missingInsuranceCountChange < 0 ? '📉' : '➡️';
    const changeText = missingInsuranceCountChange > 0 ? `+${missingInsuranceCountChange}` : missingInsuranceCountChange;
    report += ` ${changeSymbol} (${changeText} from previous run)`;
  }
  report += `\n`;

  // Add timing information if available
  if (operations.timing) {
    report += `\n### Performance Metrics\n\n`;
    if (operations.timing.total) {
      report += `- **Total duration:** ${operations.timing.total}ms (${(operations.timing.total / 1000).toFixed(2)}s)\n`;
    }
    if (operations.timing.fetch) {
      report += `- **Website fetch:** ${operations.timing.fetch}ms\n`;
    }
    if (operations.timing.extract) {
      report += `- **Content extraction:** ${operations.timing.extract}ms\n`;
    }
    if (operations.timing.aiProcessing) {
      report += `- **AI processing:** ${operations.timing.aiProcessing}ms\n`;
    }
    if (operations.timing.fileWriting) {
      report += `- **File writing:** ${operations.timing.fileWriting}ms\n`;
    }
  }
  report += `\n`;

  // Providers section
  report += `## Providers\n\n`;

  for (const provider of summaries.providers) {
    const normalizedSlug = normalizeProviderName(provider.name);

    // Skip if normalization failed
    if (!normalizedSlug) {
      report += `### ${provider.name}\n`;
      report += `- **Status:** ⚠️ SKIPPED (invalid name)\n\n`;
      continue;
    }

    // Determine operation type
    const isNew = operations.created.includes(normalizedSlug);
    const isUpdated = operations.updated.includes(normalizedSlug);
    const operationType = isNew ? '🆕 NEW' : isUpdated ? '🔄 UPDATED' : '❓ UNKNOWN';

    // Find validation warnings for this provider
    const providerWarnings = operations.validationWarnings.find(
      item => item.slug === normalizedSlug
    );

    // Check insurance status
    const hasInsurance = provider.insurance && Array.isArray(provider.insurance) && provider.insurance.length > 0;
    const insuranceStatus = hasInsurance
      ? `✅ Found (${provider.insurance.length} provider${provider.insurance.length > 1 ? 's' : ''})`
      : '⚠️ Missing';

    report += `### ${provider.name}\n`;
    report += `- **Slug:** \`${normalizedSlug}.md\`\n`;
    report += `- **Status:** ${operationType}\n`;
    report += `- **Insurance:** ${insuranceStatus}\n`;

    // Add insurance details if present
    if (hasInsurance) {
      report += `  - ${provider.insurance.join(', ')}\n`;
    }

    // Add warnings if present
    if (providerWarnings && providerWarnings.warnings.length > 0) {
      report += `- **Warnings:**\n`;
      providerWarnings.warnings.forEach(warning => {
        report += `  - ⚠️ ${warning}\n`;
      });
    }

    report += `\n`;
  }

  // Validation Issues section (if any)
  if (totalWarnings > 0) {
    report += `## Validation Issues\n\n`;

    // Group by issue type
    const insuranceIssues = [];
    const emailIssues = [];
    const phoneIssues = [];
    const otherIssues = [];

    for (const item of operations.validationWarnings) {
      for (const warning of item.warnings) {
        const entry = `- **${item.provider}** (\`${item.slug}.md\`): ${warning}`;

        if (warning.includes('Insurance')) {
          insuranceIssues.push(entry);
        } else if (warning.includes('email')) {
          emailIssues.push(entry);
        } else if (warning.includes('phone')) {
          phoneIssues.push(entry);
        } else {
          otherIssues.push(entry);
        }
      }
    }

    if (insuranceIssues.length > 0) {
      report += `### Missing Insurance Information\n\n`;
      report += insuranceIssues.join('\n') + '\n\n';
    }

    if (emailIssues.length > 0) {
      report += `### Email Format Issues\n\n`;
      report += emailIssues.join('\n') + '\n\n';
    }

    if (phoneIssues.length > 0) {
      report += `### Phone Format Issues\n\n`;
      report += phoneIssues.join('\n') + '\n\n';
    }

    if (otherIssues.length > 0) {
      report += `### Other Issues\n\n`;
      report += otherIssues.join('\n') + '\n\n';
    }
  }

  // Scraping Errors section (if any)
  if (totalErrors > 0) {
    report += `## Scraping Errors\n\n`;
    report += `The following errors occurred during the scraping process:\n\n`;

    // Group errors by type
    const timeoutErrors = operations.errors.filter(e => e.type === 'timeout');
    const navigationErrors = operations.errors.filter(e => e.type === 'navigation');
    const parsingErrors = operations.errors.filter(e => e.type === 'parsing');
    const llmErrors = operations.errors.filter(e => e.type === 'llm');
    const otherErrors = operations.errors.filter(e => !['timeout', 'navigation', 'parsing', 'llm'].includes(e.type));

    if (timeoutErrors.length > 0) {
      report += `### Timeout Errors\n\n`;
      timeoutErrors.forEach(error => {
        report += `- **Provider:** ${error.provider || 'Unknown'}\n`;
        report += `  - **Error:** ${error.message}\n`;
        report += `  - **URL:** ${error.url || 'N/A'}\n`;
        report += `  - **Scraping mode:** ${SCRAPING_MODE}\n`;
        report += `  - **Retry attempts:** ${error.attempts || 'N/A'}\n`;
        if (error.duration) {
          report += `  - **Duration:** ${error.duration}ms\n`;
        }
        report += `\n`;
      });
    }

    if (navigationErrors.length > 0) {
      report += `### Navigation Errors\n\n`;
      navigationErrors.forEach(error => {
        report += `- **Provider:** ${error.provider || 'Unknown'}\n`;
        report += `  - **Error:** ${error.message}\n`;
        report += `  - **URL:** ${error.url || 'N/A'}\n`;
        report += `  - **Scraping mode:** ${SCRAPING_MODE}\n`;
        report += `  - **Retry attempts:** ${error.attempts || 'N/A'}\n`;
        if (error.duration) {
          report += `  - **Duration:** ${error.duration}ms\n`;
        }
        report += `\n`;
      });
    }

    if (parsingErrors.length > 0) {
      report += `### Parsing Errors\n\n`;
      parsingErrors.forEach(error => {
        report += `- **Provider:** ${error.provider || 'Unknown'}\n`;
        report += `  - **Error:** ${error.message}\n`;
        report += `  - **URL:** ${error.url || 'N/A'}\n`;
        report += `  - **Scraping mode:** ${SCRAPING_MODE}\n`;
        report += `  - **Retry attempts:** ${error.attempts || 'N/A'}\n`;
        if (error.duration) {
          report += `  - **Duration:** ${error.duration}ms\n`;
        }
        report += `\n`;
      });
    }

    if (llmErrors.length > 0) {
      report += `### LLM Errors\n\n`;
      llmErrors.forEach(error => {
        report += `- **Provider:** ${error.provider || 'Unknown'}\n`;
        report += `  - **Error:** ${error.message}\n`;
        report += `  - **URL:** ${error.url || 'N/A'}\n`;
        report += `  - **Model:** ${OPENROUTER_MODEL}\n`;
        if (error.duration) {
          report += `  - **Duration:** ${error.duration}ms\n`;
        }
        report += `\n`;
      });
    }

    if (otherErrors.length > 0) {
      report += `### Other Errors\n\n`;
      otherErrors.forEach(error => {
        report += `- **Provider:** ${error.provider || 'Unknown'}\n`;
        report += `  - **Error:** ${error.message}\n`;
        report += `  - **Type:** ${error.type || 'unknown'}\n`;
        report += `  - **URL:** ${error.url || 'N/A'}\n`;
        report += `  - **Scraping mode:** ${SCRAPING_MODE}\n`;
        report += `  - **Retry attempts:** ${error.attempts || 'N/A'}\n`;
        if (error.duration) {
          report += `  - **Duration:** ${error.duration}ms\n`;
        }
        report += `\n`;
      });
    }
  }

  // Recommendations section
  report += `## Recommendations\n\n`;

  if (missingInsuranceCount > 0) {
    report += `- **Insurance extraction:** ${missingInsuranceCount} provider(s) are missing insurance information. Consider:\n`;
    report += `  - Reviewing the website content to verify insurance information is present\n`;
    report += `  - Enhancing the AI extraction prompt with more specific insurance keywords\n`;
    report += `  - Manually adding insurance information to affected provider files\n`;
    
    // Add comparison context if available
    if (previousMissingInsuranceCount !== null && missingInsuranceCountChange !== null) {
      if (missingInsuranceCountChange > 0) {
        report += `  - ⚠️ Note: ${missingInsuranceCountChange} more provider(s) missing insurance compared to previous run\n`;
      } else if (missingInsuranceCountChange < 0) {
        report += `  - ✅ Improvement: ${Math.abs(missingInsuranceCountChange)} fewer provider(s) missing insurance compared to previous run\n`;
      }
    }
    report += `\n`;
  }

  if (operations.validationWarnings.some(item => item.warnings.some(w => w.includes('email')))) {
    report += `- **Email validation:** Some providers have invalid email formats. Review and correct these entries.\n\n`;
  }

  if (operations.validationWarnings.some(item => item.warnings.some(w => w.includes('phone')))) {
    report += `- **Phone validation:** Some providers have invalid phone formats. Review and correct these entries.\n\n`;
  }

  if (totalErrors > 0) {
    report += `- **Scraping errors:** ${totalErrors} error(s) occurred during scraping. Consider:\n`;
    if (operations.errors.some(e => e.type === 'timeout')) {
      report += `  - Increasing PAGE_LOAD_TIMEOUT if timeout errors are frequent\n`;
    }
    if (operations.errors.some(e => e.type === 'navigation')) {
      report += `  - Checking network connectivity and URL accessibility\n`;
    }
    if (operations.errors.some(e => e.type === 'llm')) {
      report += `  - Checking OPENROUTER_API_KEY is valid and has sufficient credits\n`;
      report += `  - Verifying the AI model (${OPENROUTER_MODEL}) is available and accessible\n`;
      report += `  - Reviewing provider page content quality (may be too short or malformed)\n`;
    }
    if (SCRAPING_MODE === 'puppeteer') {
      report += `  - Trying axios mode as fallback (set SCRAPING_MODE=axios)\n`;
    }
    report += `  - Reviewing error details above and retrying failed providers\n\n`;
  }

  if (totalWarnings === 0 && missingInsuranceCount === 0 && totalErrors === 0) {
    report += `✅ No issues detected. All provider data appears complete and valid.\n\n`;
  }

  report += `---\n\n`;
  report += `*Report generated by AI Phone Receptionist - Provider Scraper*\n`;

  return report;
}
/**
 * Write report to timestamped file in reports directory
 * Creates reports directory if it doesn't exist, generates a timestamped filename,
 * and writes the report content. Handles errors gracefully without crashing the scraper.
 * 
 * Error handling:
 * - Directory creation failures are logged but don't stop execution
 * - File write failures are logged but don't crash the process
 * - Returns null on failure to indicate report wasn't saved
 * 
 * @param {string} reportContent - The report content to write (markdown format)
 * @returns {string|null} Report file path if successful, null if failed
 * @example
 * writeReport(reportContent) // returns "reports/scraping-report-2024-01-15T10-30-45-123Z.md"
 */
function writeReport(reportContent) {
  const fs = require('fs');
  const path = require('path');

  try {
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
      console.log(`📁 Created reports directory: ${reportsDir}`);
    }

    // Generate timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `scraping-report-${timestamp}.md`;
    const filepath = path.join(reportsDir, filename);

    // Write report content to file
    fs.writeFileSync(filepath, reportContent, 'utf8');
    console.log(`📄 Report written to: ${filepath}`);

    return filepath;
  } catch (error) {
    // Handle write errors gracefully - log but don't crash
    console.error(`⚠️ Failed to write report: ${error.message}`);
    console.error(`   Report will not be saved, but scraping completed successfully.`);
    return null;
  }
}


/**
 * Multi-page provider scraping function
 * Orchestrates the multi-page scraping pipeline: discovers provider links from homepage,
 * visits each provider's individual page, processes them separately with dedicated LLM calls,
 * generates individual markdown files incrementally, and creates comprehensive reports.
 * 
 * Pipeline stages:
 * 1. Launch browser if Puppeteer mode
 * 2. Fetch homepage HTML
 * 3. Extract provider links from homepage
 * 4. Loop through providers calling processSingleProvider for each
 * 5. Aggregate results (created, updated, errors, warnings)
 * 6. Extract and write practice overview from homepage
 * 7. Calculate total duration
 * 8. Generate and write comprehensive scraping report
 * 9. Display summary to console
 * 10. Close browser in finally block
 * 
 * Error handling:
 * - Homepage fetch failure: Fatal error, exit immediately
 * - Individual provider failures: Non-fatal, log and continue
 * - Practice overview failure: Non-fatal, log warning and continue
 * - Browser cleanup: Always executed in finally block
 * 
 * @returns {Promise<void>}
 * @throws {Error} Exits process with code 1 on fatal errors (homepage fetch), code 0 on success
 */
async function mainMultiPage() {
  console.log(`🚀 Starting multi-page provider scraping process\n`);
  
  const startTime = Date.now();
  let browser = null;
  const results = {
    providers: [],
    operations: {
      created: [],
      updated: [],
      validationWarnings: [],
      errors: [],
      timing: {}
    }
  };
  
  try {
    // 1. Launch browser if Puppeteer mode
    if (SCRAPING_MODE === 'puppeteer') {
      console.log(`🤖 Launching browser for multi-page scraping...`);
      browser = await browserManager.launchBrowser({
        headless: BROWSER_HEADLESS
      });
    }
    
    // 2. Fetch homepage
    let homepageHtml;
    try {
      const fetchStart = Date.now();
      console.log(`📥 Fetching homepage to discover provider links...`);
      homepageHtml = await fetchWebsite(WEBSITE_URL, browser, 'Homepage');
      results.operations.timing.homepageFetch = Date.now() - fetchStart;
    } catch (error) {
      // Homepage fetch failure is FATAL - cannot discover providers
      const errorDuration = Date.now() - startTime;
      results.operations.errors.push({
        provider: 'Homepage',
        type: error.type || 'unknown',
        message: error.message,
        url: error.url || WEBSITE_URL,
        attempts: error.attempts || MAX_RETRIES,
        duration: errorDuration
      });
      
      console.error(`\n❌ Failed to fetch homepage. Cannot discover providers.`);
      
      // Generate error report
      const summaries = { practiceOverview: '', providers: [] };
      results.operations.timing.total = errorDuration;
      const reportContent = generateScrapingReport({ summaries: summaries, operations: results.operations });
      writeReport(reportContent);
      
      process.exit(1);
    }
    
    // 3. Extract provider links
    let providerLinks;
    try {
      const extractStart = Date.now();
      providerLinks = extractProviderLinks(homepageHtml);
      results.operations.timing.linkExtraction = Date.now() - extractStart;
      
      if (providerLinks.length === 0) {
        console.warn(`⚠️ No provider links found. Scraping will complete with no providers.`);
      }
    } catch (error) {
      // Link extraction failure is FATAL - cannot proceed
      console.error(`\n❌ Failed to extract provider links: ${error.message}`);
      
      const summaries = { practiceOverview: '', providers: [] };
      results.operations.timing.total = Date.now() - startTime;
      const reportContent = generateScrapingReport({ summaries: summaries, operations: results.operations });
      writeReport(reportContent);
      
      process.exit(1);
    }
    
    console.log(`\n🔍 Found ${providerLinks.length} provider link(s) to process`);
    
    // 4. Loop through providers calling processSingleProvider
    const providerProcessingStart = Date.now();
    for (let i = 0; i < providerLinks.length; i++) {
      const result = await processSingleProvider(
        providerLinks[i],
        browser,
        i + 1,
        providerLinks.length
      );
      
      results.providers.push(result);
      
      // 5. Aggregate results - track operations
      if (result.success) {
        if (result.operation === 'created') {
          results.operations.created.push(result.slug);
        } else if (result.operation === 'updated') {
          results.operations.updated.push(result.slug);
        }
        
        // Track validation warnings
        if (result.warnings.length > 0) {
          results.operations.validationWarnings.push({
            provider: result.providerName,
            slug: result.slug,
            warnings: result.warnings
          });
        }
      }
      
      // Track errors
      if (result.error) {
        results.operations.errors.push({
          provider: result.providerName,
          type: result.error.type,
          message: result.error.message,
          url: result.error.url,
          duration: result.duration
        });
      }
    }
    results.operations.timing.providerProcessing = Date.now() - providerProcessingStart;
    
    // 6. Extract and write practice overview
    console.log(`\n🏢 Extracting practice overview from homepage...`);
    const practiceOverviewStart = Date.now();
    try {
      const homepageText = extractText(homepageHtml);
      const practiceOverview = await extractPracticeOverview(homepageHtml, homepageText);
      
      if (practiceOverview) {
        writePracticeOverview(practiceOverview);
      } else {
        console.warn(`⚠️ Practice overview extraction returned null, skipping file write`);
      }
    } catch (error) {
      // Practice overview failure is NON-FATAL - log warning and continue
      console.warn(`⚠️ Failed to extract practice overview: ${error.message}`);
      console.warn(`   Continuing with provider processing...`);
    }
    results.operations.timing.practiceOverview = Date.now() - practiceOverviewStart;
    
    // 7. Calculate total duration
    results.operations.timing.total = Date.now() - startTime;
    
    // 8. Generate and write report
    console.log(`\n📊 Generating scraping report...`);
    
    // Build summaries object for report generation (reuse existing report format)
    const summaries = {
      practiceOverview: '', // Not needed for report, already written to file
      providers: results.providers
        .filter(r => r.success)
        .map(r => ({
          name: r.providerName,
          slug: r.slug,
          insurance: [] // Insurance data is in the file, not tracked in result object
        }))
    };
    
    const reportContent = generateScrapingReport({ summaries: summaries, operations: results.operations });
    const reportPath = writeReport(reportContent);
    
    // 9. Display summary
    console.log(`\n✨ Multi-page scraping complete!`);
    console.log(`📈 Processed: ${providerLinks.length} provider(s)`);
    console.log(`✅ Successful: ${results.providers.filter(r => r.success).length}`);
    console.log(`❌ Failed: ${results.providers.filter(r => !r.success).length}`);
    console.log(`📝 Operations: ${results.operations.created.length} created, ${results.operations.updated.length} updated`);
    console.log(`⚠️  Warnings: ${results.operations.validationWarnings.length} provider(s) with validation warnings`);
    console.log(`⏱️  Total duration: ${(results.operations.timing.total / 1000).toFixed(2)}s`);
    
    if (reportPath) {
      console.log(`📄 Detailed report saved to: ${reportPath}`);
    }
    
    // Display key findings
    if (results.operations.errors.length > 0) {
      console.log(`\n⚠️  ${results.operations.errors.length} error(s) occurred during scraping`);
      console.log(`   See report for details`);
    }
    
    if (results.operations.validationWarnings.length === 0 && results.operations.errors.length === 0) {
      console.log(`\n✅ All provider data validated successfully with no errors`);
    }
    
    process.exit(0);
    
  } finally {
    // 10. Close browser in finally block (always executed)
    if (browser) {
      console.log(`\n🔒 Closing browser...`);
      await browserManager.closeBrowser(browser);
    }
  }
}

/**
 * Main execution function for provider profile scraping
 * Orchestrates the complete scraping pipeline from fetching website content
 * to generating provider files and comprehensive reports.
 * 
 * Pipeline stages:
 * 1. Fetch website HTML from configured URL
 * 2. Extract text content (remove scripts, styles, nav, footer)
 * 3. Generate summaries via OpenRouter API (AI extraction)
 * 4. Write markdown files with duplicate detection and validation
 * 5. Generate and write comprehensive scraping report
 * 6. Display summary to console
 * 
 * @returns {Promise<void>}
 * @throws {Error} Exits process with code 1 on fatal errors, code 0 on success
 */
async function main() {
  console.log(`🚀 Starting provider profile scraping process\n`);
  
  const startTime = Date.now();
  let browser = null;
  let operations = {
    created: [],
    updated: [],
    validationWarnings: [],
    errors: [],
    timing: {}
  };
  
  try {
    // Launch browser once if using Puppeteer mode
    if (SCRAPING_MODE === 'puppeteer') {
      browser = await browserManager.launchBrowser({
        headless: BROWSER_HEADLESS
      });
    }
    
    // 1. Fetch website HTML using configured mode
    let html;
    try {
      const fetchStart = Date.now();
      html = await fetchWebsite(WEBSITE_URL, browser, 'Main Website');
      operations.timing.fetch = Date.now() - fetchStart;
    } catch (error) {
      // Track the error with timing
      const errorDuration = Date.now() - startTime;
      operations.errors.push({
        provider: 'Main Website',
        type: error.type || 'unknown',
        message: error.message,
        url: error.url || WEBSITE_URL,
        attempts: error.attempts || MAX_RETRIES,
        duration: errorDuration
      });
      
      console.error(`\n❌ Failed to fetch website. Cannot continue with scraping.`);
      
      // Generate error report
      const summaries = { practiceOverview: '', providers: [] };
      operations.timing.total = errorDuration;
      const reportContent = generateScrapingReport({ summaries, operations });
      writeReport(reportContent);
      
      process.exit(1);
    }
    
    // 2. Extract text content
    const extractStart = Date.now();
    const text = extractText(html);
    operations.timing.extract = Date.now() - extractStart;
    
    // 2.5. Save scrape cache for debugging
    console.log(`💾 Saving scrape cache for debugging...`);
    const cacheFile = saveScrapeCache(html, text, WEBSITE_URL);
    if (cacheFile) {
      console.log(`✅ Cache saved - you can inspect raw HTML and extracted text`);
    }
    
    // 3. Generate summaries via AI
    const aiStart = Date.now();
    const summaries = await generateSummaries(text);
    operations.timing.aiProcessing = Date.now() - aiStart;
    
    // 4. Write markdown files and track operations
    const writeStart = Date.now();
    const writeOperations = await writeProviderFiles(summaries);
    operations.timing.fileWriting = Date.now() - writeStart;
    
    // Merge write operations into main operations object
    operations.created = writeOperations.created;
    operations.updated = writeOperations.updated;
    operations.validationWarnings = writeOperations.validationWarnings;
    if (writeOperations.errors) {
      operations.errors = operations.errors.concat(writeOperations.errors);
    }
    
    // Calculate total duration
    operations.timing.total = Date.now() - startTime;
    
    // 5. Generate and write comprehensive report
    console.log(`\n📊 Generating scraping report...`);
    const reportContent = generateScrapingReport({ summaries, operations });
    const reportPath = writeReport(reportContent);
    
    // 6. Display summary to console
    console.log(`\n✨ Provider profile scraping complete!`);
    console.log(`📈 Operations: ${operations.created.length} new, ${operations.updated.length} updated, ${operations.validationWarnings.length} with warnings`);
    console.log(`⏱️  Total duration: ${(operations.timing.total / 1000).toFixed(2)}s`);
    
    if (operations.errors && operations.errors.length > 0) {
      console.log(`❌ Errors: ${operations.errors.length} error(s) occurred during scraping`);
    }
    
    if (reportPath) {
      console.log(`📄 Detailed report saved to: ${reportPath}`);
    }
    
    // Display key findings from report
    const providersWithoutInsurance = operations.validationWarnings
      .filter(item => item.warnings.some(w => w.includes('Insurance')))
      .length;
    
    if (providersWithoutInsurance > 0) {
      console.log(`⚠️ ${providersWithoutInsurance} provider(s) missing insurance information`);
    }
    
    if (operations.validationWarnings.length === 0 && (!operations.errors || operations.errors.length === 0)) {
      console.log(`✅ All provider data validated successfully`);
    }
    
    process.exit(0);
  } finally {
    // Always close browser if it was launched
    if (browser) {
      await browserManager.closeBrowser(browser);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  // Check MULTI_PAGE_SCRAPING flag and dispatch to appropriate function
  if (MULTI_PAGE_SCRAPING) {
    console.log(`🔧 Multi-page scraping mode enabled (MULTI_PAGE_SCRAPING=true)`);
    mainMultiPage().catch(error => {
      console.error(`\n💥 Unexpected error: ${error.message}`);
      process.exit(1);
    });
  } else {
    console.log(`🔧 Single-page scraping mode (MULTI_PAGE_SCRAPING=false or not set)`);
    main().catch(error => {
      console.error(`\n💥 Unexpected error: ${error.message}`);
      process.exit(1);
    });
  }
}

// Export functions for testing
module.exports = {
  fetchWebsite,
  fetchWithAxios,
  fetchWithPuppeteer,
  extractText,
  extractProviderLinks,
  generateSummaries,
  generateProviderPrompt,
  nameToSlug,
  normalizeProviderName,
  providerFileExists,
  findExistingProviderFile,
  writeProviderFiles,
  validateProvider,
  isValidEmail,
  isValidPhone,
  generateScrapingReport,
  writeReport,
  saveScrapeCache,
  processSingleProvider,
  mainMultiPage
};
