// Standalone script to scrape RTC website and generate provider markdown files
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

// Configuration
const WEBSITE_URL = 'https://www.relationaltherapycollective.com';
const PROVIDERS_DIR = path.join(__dirname, '..', 'data', 'providers');
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4';

/**
 * Fetch HTML from website
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
  
  const prompt = `You are analyzing the website content for Relational Therapy Collective (RTC), a therapy practice.

Your task is to extract and structure information about the practice and its providers into clean markdown summaries.

Please analyze the following website content and return a JSON object with this structure:

{
  "practiceOverview": "markdown content for practice overview",
  "providers": [
    {
      "name": "Provider Full Name",
      "slug": "provider-slug",
      "content": "markdown content for this provider"
    }
  ]
}

Guidelines:
- For practiceOverview: Create a markdown document with sections like "# Practice Name", "## About", "## Location", "## Services", "## Insurance"
- For each provider: Create a markdown document with sections like "# Provider Name, Credentials", "## About", "## Specialties", "## Approach", "## Contact"
- Use the provider's full name with credentials for the heading (e.g., "# Miri Arie, LMFT")
- Generate a kebab-case slug from the provider name (e.g., "miri-arie")
- Extract all relevant information including specialties, therapeutic approaches, contact details
- Format contact info as bullet points
- Keep the tone professional and warm
- If information is unclear or missing, omit that section rather than guessing

Website content:
${text}`;

  try {
    const response = await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,  // Lower temperature for more consistent extraction
      max_tokens: 4000
    });
    
    const content = response.choices[0].message.content;
    console.log(`✅ Received response from OpenRouter`);
    
    // Parse JSON from response
    // The AI might wrap JSON in markdown code blocks, so handle that
    let jsonText = content;
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    
    const summaries = JSON.parse(jsonText);
    
    // Validate structure
    if (!summaries.practiceOverview || !Array.isArray(summaries.providers)) {
      throw new Error('Invalid response structure: missing practiceOverview or providers array');
    }
    
    console.log(`✅ Parsed summaries: 1 practice overview + ${summaries.providers.length} providers`);
    return summaries;
    
  } catch (error) {
    console.error(`❌ Failed to generate summaries: ${error.message}`);
    if (error.response) {
      console.error(`   API response: ${JSON.stringify(error.response.data)}`);
    }
    process.exit(1);
  }
}

/**
 * Convert provider name to kebab-case slug
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
 * Write provider files to disk
 */
async function writeProviderFiles(summaries) {
  console.log(`📝 Writing provider files to ${PROVIDERS_DIR}`);
  
  try {
    // Ensure directory exists
    if (!fs.existsSync(PROVIDERS_DIR)) {
      fs.mkdirSync(PROVIDERS_DIR, { recursive: true });
      console.log(`📁 Created directory: ${PROVIDERS_DIR}`);
    }
    
    // Write practice overview
    const overviewPath = path.join(PROVIDERS_DIR, 'practice-overview.md');
    fs.writeFileSync(overviewPath, summaries.practiceOverview, 'utf-8');
    console.log(`✅ Wrote practice-overview.md`);
    
    // Write provider files
    for (const provider of summaries.providers) {
      const slug = provider.slug || nameToSlug(provider.name);
      const filename = `${slug}.md`;
      const filepath = path.join(PROVIDERS_DIR, filename);
      
      fs.writeFileSync(filepath, provider.content, 'utf-8');
      console.log(`✅ Wrote ${filename}`);
    }
    
    console.log(`🎉 Successfully wrote ${summaries.providers.length + 1} files`);
    
  } catch (error) {
    console.error(`❌ Failed to write files: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log(`🚀 Starting provider profile scraping process\n`);
  
  // 1. Fetch website HTML
  const html = await fetchWebsite(WEBSITE_URL);
  
  // 2. Extract text content
  const text = extractText(html);
  
  // 3. Generate summaries via AI
  const summaries = await generateSummaries(text);
  
  // 4. Write markdown files
  await writeProviderFiles(summaries);
  
  console.log(`\n✨ Provider profile scraping complete!`);
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
  writeProviderFiles
};
