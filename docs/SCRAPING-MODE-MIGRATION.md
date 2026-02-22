# Scraping Mode Migration Guide 🔄

## Overview

The provider scraper now supports two modes for fetching website content:

- **Puppeteer Mode** (default): Uses headless Chrome to capture JavaScript-rendered content
- **Axios Mode** (legacy): Uses HTTP client for static HTML fetching

This guide helps you switch between modes safely and compare their outputs.

## Quick Reference

| Mode | Best For | Speed | Content Capture | Setup |
|------|----------|-------|-----------------|-------|
| **Puppeteer** | Dynamic content, insurance data | Slower | Complete (JS-rendered) | Requires Chrome |
| **Axios** | Static content, quick tests | Faster | Static HTML only | No dependencies |

## When to Use Each Mode

### Use Puppeteer Mode When:
- You need insurance information (dynamically loaded)
- Provider pages use JavaScript to render content
- You want complete, accurate data extraction
- Running in production environment

### Use Axios Mode When:
- Testing scraper changes quickly
- Chrome/Chromium is unavailable
- Website content is mostly static
- You need faster scraping for development

## Migration Process

### Step 1: Verify Current Setup

Check your current configuration:

```bash
# View current mode
grep SCRAPING_MODE .env

# If not set, default is Puppeteer
```

### Step 2: Test Puppeteer Mode (Recommended)

1. **Set environment variable:**

```bash
# In .env file
SCRAPING_MODE=puppeteer
PAGE_LOAD_TIMEOUT=10000
BROWSER_HEADLESS=true
BROWSER_DISABLE_IMAGES=true
```

2. **Run scraper:**

```bash
node src/scrape-providers.js
```

3. **Check output:**
- Look for "Using Puppeteer (headless browser)" in logs
- Verify insurance data in provider files
- Review scraping report for statistics

### Step 3: Compare Outputs

Run both modes and compare results:

```bash
# Run Puppeteer mode
SCRAPING_MODE=puppeteer node src/scrape-providers.js

# Save report location (shown in output)
# Example: reports/scraping-report-2024-01-15T10-30-45-123Z.md

# Run Axios mode
SCRAPING_MODE=axios node src/scrape-providers.js

# Compare the two reports
```

**Key Metrics to Compare:**

1. **Insurance Data Coverage:**
   - Puppeteer should show higher "Providers with insurance" count
   - Check specific providers like Jeffrey Gillman for insurance info

2. **Validation Warnings:**
   - Compare "Missing insurance information" warnings
   - Puppeteer should have fewer warnings

3. **Performance:**
   - Axios is typically 3-5x faster
   - Puppeteer provides more complete data

4. **File Differences:**
   - Compare provider markdown files side-by-side
   - Look for missing content in axios version

### Step 4: Production Rollout

**Recommended Approach:**

1. **Start with Axios (No Change):**
```bash
# In production .env
SCRAPING_MODE=axios
```

2. **Test Puppeteer in Staging:**
```bash
# In staging environment
SCRAPING_MODE=puppeteer
BROWSER_HEADLESS=true
```

3. **Monitor for Issues:**
- Check browser launch success
- Verify Chrome/Chromium is installed
- Monitor memory usage
- Review error logs

4. **Switch to Puppeteer:**
```bash
# In production .env
SCRAPING_MODE=puppeteer
PAGE_LOAD_TIMEOUT=10000
BROWSER_HEADLESS=true
BROWSER_DISABLE_IMAGES=true
```

5. **Keep Axios as Fallback:**
- If issues occur, quickly switch back
- Document any environment-specific problems

## Comparing Outputs

### Manual Comparison

Compare specific provider files:

```bash
# Example: Compare Jeffrey Gillman's profile
cat data/providers/jeffrey-gillman.md

# Look for insurance section:
# - Puppeteer should show: Premera, Regence, BCBS
# - Axios might show: empty or missing
```

### Report Comparison

Compare scraping reports:

```bash
# View latest reports
ls -lt reports/scraping-report-*.md | head -2

# Compare insurance statistics
grep "Providers with insurance" reports/scraping-report-*.md
```

### Automated Comparison Script

Create a simple comparison script:

```bash
#!/bin/bash
# compare-modes.sh

echo "Running Puppeteer mode..."
SCRAPING_MODE=puppeteer node src/scrape-providers.js > /tmp/puppeteer.log 2>&1
PUPPETEER_REPORT=$(ls -t reports/scraping-report-*.md | head -1)

echo "Running Axios mode..."
SCRAPING_MODE=axios node src/scrape-providers.js > /tmp/axios.log 2>&1
AXIOS_REPORT=$(ls -t reports/scraping-report-*.md | head -1)

echo ""
echo "=== Comparison Results ==="
echo ""
echo "Puppeteer Report:"
grep "Providers with insurance" "$PUPPETEER_REPORT"
echo ""
echo "Axios Report:"
grep "Providers with insurance" "$AXIOS_REPORT"
```

## Fallback Instructions

### If Puppeteer Fails

**Common Issues and Solutions:**

1. **Chrome/Chromium Not Found:**
```bash
# Error: "Failed to launch browser"
# Solution: Install Chrome/Chromium

# Ubuntu/Debian
sudo apt-get install chromium-browser

# Or use axios mode
SCRAPING_MODE=axios node src/scrape-providers.js
```

2. **Timeout Errors:**
```bash
# Error: "Navigation timeout"
# Solution: Increase timeout

# In .env
PAGE_LOAD_TIMEOUT=20000  # Increase to 20 seconds
```

3. **Memory Issues:**
```bash
# Error: "Out of memory"
# Solution: Reduce concurrent operations or use axios

SCRAPING_MODE=axios node src/scrape-providers.js
```

4. **Headless Mode Issues:**
```bash
# Error: "Failed to launch browser in headless mode"
# Solution: Try headed mode (requires display)

# In .env
BROWSER_HEADLESS=false
```

### Emergency Fallback

If Puppeteer completely fails in production:

```bash
# Quick fallback to axios
echo "SCRAPING_MODE=axios" >> .env

# Restart scraper
node src/scrape-providers.js

# Note: Insurance data may be incomplete
```

## Configuration Reference

### Puppeteer Mode Settings

```bash
# .env configuration for Puppeteer

# Mode selection
SCRAPING_MODE=puppeteer

# Timeout settings
PAGE_LOAD_TIMEOUT=10000      # 10 seconds (default)

# Browser settings
BROWSER_HEADLESS=true        # Run without GUI (default: true)
BROWSER_DISABLE_IMAGES=true  # Faster loading (default: true)
BROWSER_DISABLE_CSS=false    # Keep CSS for layout (default: false)

# Retry settings
MAX_RETRIES=3                # Retry failed pages (default: 3)
RETRY_DELAY=1000             # Initial delay in ms (default: 1000)
```

### Axios Mode Settings

```bash
# .env configuration for Axios

# Mode selection
SCRAPING_MODE=axios

# No additional settings needed
# Axios uses default timeout of 15 seconds
```

## Performance Expectations

### Typical Scraping Times

| Mode | Single Provider | 15 Providers | Notes |
|------|----------------|--------------|-------|
| **Puppeteer** | 2-4 seconds | 30-60 seconds | Includes browser launch |
| **Axios** | 0.5-1 second | 8-15 seconds | Simple HTTP requests |

### Resource Usage

| Mode | Memory | CPU | Disk |
|------|--------|-----|------|
| **Puppeteer** | ~200-300 MB | Medium-High | ~170 MB (Chrome binary) |
| **Axios** | ~50-100 MB | Low | Minimal |

## Troubleshooting

### Puppeteer Issues

**Problem:** Browser won't launch
```bash
# Check Chrome installation
which chromium-browser
which google-chrome

# Install if missing (Ubuntu)
sudo apt-get install chromium-browser

# Or use axios fallback
SCRAPING_MODE=axios
```

**Problem:** Slow performance
```bash
# Optimize settings
BROWSER_DISABLE_IMAGES=true
BROWSER_DISABLE_CSS=true
PAGE_LOAD_TIMEOUT=8000  # Reduce timeout
```

**Problem:** Timeout on specific pages
```bash
# Increase timeout
PAGE_LOAD_TIMEOUT=20000

# Or skip problematic providers manually
```

### Axios Issues

**Problem:** Missing insurance data
```bash
# Expected behavior - axios can't capture dynamic content
# Solution: Use Puppeteer mode for complete data
SCRAPING_MODE=puppeteer
```

**Problem:** Network errors
```bash
# Check connectivity
curl https://www.relationaltherapycollective.com

# Verify URL in .env
WEBSITE_URL=https://www.relationaltherapycollective.com
```

## Validation Checklist

After switching modes, verify:

- [ ] Scraper runs without errors
- [ ] All provider files are generated
- [ ] Insurance data is present (Puppeteer) or acknowledged as missing (Axios)
- [ ] Scraping report shows expected statistics
- [ ] No validation warnings for critical fields
- [ ] Performance is acceptable for your use case
- [ ] Browser processes close properly (Puppeteer)
- [ ] Memory usage is within limits

## Best Practices

1. **Default to Puppeteer in Production:**
   - Provides most complete data
   - Worth the performance trade-off

2. **Use Axios for Development:**
   - Faster iteration during testing
   - Good for prompt/extraction logic changes

3. **Monitor Reports:**
   - Check insurance data coverage regularly
   - Compare with previous runs
   - Track validation warnings

4. **Keep Both Modes Working:**
   - Don't remove axios code
   - Useful fallback option
   - Good for debugging

5. **Document Environment-Specific Issues:**
   - Note any Chrome installation quirks
   - Record timeout adjustments needed
   - Share findings with team

## Getting Help

If you encounter issues:

1. **Check Logs:**
   - Look for error messages in console output
   - Review scraping report for details

2. **Review Reports:**
   - Compare with previous successful runs
   - Check error sections for specifics

3. **Try Fallback:**
   - Switch to axios mode temporarily
   - Isolate whether issue is mode-specific

4. **Environment Check:**
   - Verify Chrome/Chromium installation
   - Check available memory
   - Test network connectivity

---

**Need more help?** Check the main README.md or review the scraping report for specific error details and recommendations.
