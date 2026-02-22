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

/**
 * Fetch HTML content from the specified website URL
 * Uses axios with a browser-like User-Agent to avoid blocking
 * @param {string} url - The website URL to fetch
 * @returns {Promise<string>} HTML content of the website
 * @throws {Error} Exits process if fetch fails (network error, timeout, etc.)
 */
async function fetchWebsite(url) {
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
    validationWarnings: []
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
    for (const provider of summaries.providers) {
      // Use normalized slug for duplicate detection
      const normalizedSlug = normalizeProviderName(provider.name);
      
      // Skip if normalization failed
      if (!normalizedSlug) {
        console.warn(`⚠️ Skipping provider with invalid name: ${provider.name}`);
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

  // Identify providers with missing insurance
  const providersWithoutInsurance = operations.validationWarnings
    .filter(item => item.warnings.some(w => w.includes('Insurance')))
    .map(item => item.provider);

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
  report += `- **Providers without insurance:** ${providersWithoutInsurance.length}\n\n`;

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

  // Recommendations section
  report += `## Recommendations\n\n`;

  if (providersWithoutInsurance.length > 0) {
    report += `- **Insurance extraction:** ${providersWithoutInsurance.length} provider(s) are missing insurance information. Consider:\n`;
    report += `  - Reviewing the website content to verify insurance information is present\n`;
    report += `  - Enhancing the AI extraction prompt with more specific insurance keywords\n`;
    report += `  - Manually adding insurance information to affected provider files\n\n`;
  }

  if (operations.validationWarnings.some(item => item.warnings.some(w => w.includes('email')))) {
    report += `- **Email validation:** Some providers have invalid email formats. Review and correct these entries.\n\n`;
  }

  if (operations.validationWarnings.some(item => item.warnings.some(w => w.includes('phone')))) {
    report += `- **Phone validation:** Some providers have invalid phone formats. Review and correct these entries.\n\n`;
  }

  if (totalWarnings === 0 && providersWithoutInsurance.length === 0) {
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
    const reportsDir = path.join(__dirname, '..', 'reports');
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
  
  // 1. Fetch website HTML
  const html = await fetchWebsite(WEBSITE_URL);
  
  // 2. Extract text content
  const text = extractText(html);
  
  // 3. Generate summaries via AI
  const summaries = await generateSummaries(text);
  
  // 4. Write markdown files and track operations
  const operations = await writeProviderFiles(summaries);
  
  // 5. Generate and write comprehensive report
  console.log(`\n📊 Generating scraping report...`);
  const reportContent = generateScrapingReport({ summaries, operations });
  const reportPath = writeReport(reportContent);
  
  // 6. Display summary to console
  console.log(`\n✨ Provider profile scraping complete!`);
  console.log(`📈 Operations: ${operations.created.length} new, ${operations.updated.length} updated, ${operations.validationWarnings.length} with warnings`);
  
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
  
  if (operations.validationWarnings.length === 0) {
    console.log(`✅ All provider data validated successfully`);
  }
  
  process.exit(0);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(`\n💥 Unexpected error: ${error.message}`);
    process.exit(1);
  });
}

// Export functions for testing
module.exports = {
  fetchWebsite,
  extractText,
  generateSummaries,
  nameToSlug,
  normalizeProviderName,
  providerFileExists,
  findExistingProviderFile,
  writeProviderFiles,
  validateProvider,
  isValidEmail,
  isValidPhone,
  generateScrapingReport,
  writeReport
};
