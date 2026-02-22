# Multi-Page Scraping Migration Guide 🔄

## Overview

The provider scraper now supports two architectures for extracting provider information:

- **Multi-Page Mode** (recommended): Visits each provider's individual page for complete data extraction
- **Single-Page Mode** (legacy): Extracts all providers from homepage in one pass

This guide helps you migrate from single-page to multi-page scraping safely and validate the improved data quality.

## Quick Reference

| Mode | Best For | Insurance Data | Resilience | Processing Time |
|------|----------|----------------|------------|-----------------|
| **Multi-Page** | Complete data, individual provider pages | Comprehensive | Per-provider error handling | 40-90 seconds (10 providers) |
| **Single-Page** | Quick extraction, homepage-only data | Limited | Single point of failure | 30-60 seconds |

## Why Migrate to Multi-Page?

### Benefits of Multi-Page Scraping

1. **Complete Insurance Information:**
   - Extracts insurance details from individual provider pages
   - Captures data not available on homepage
   - Critical for caller inquiries about insurance acceptance

2. **Better Data Quality:**
   - Full context from dedicated provider pages
   - More accurate extraction with focused LLM prompts
   - Detailed provider bios and specialties

3. **Improved Resilience:**
   - Individual provider failures don't stop entire scrape
   - Partial results preserved even if some providers fail
   - Per-provider error tracking and reporting

4. **Better Debugging:**
   - Separate cache files for each provider
   - Easier to identify and fix extraction issues
   - Incremental progress tracking

### Trade-offs

- **Slower:** More HTTP requests and LLM calls (40-90 seconds vs 30-60 seconds)
- **More API Calls:** N+1 LLM calls instead of 1 (where N = number of providers)
- **Higher Costs:** More OpenRouter API usage (typically $0.10-0.30 per scrape)

## Migration Process

### Step 1: Verify Current Setup

Check your current configuration:

```bash
# View current mode
grep MULTI_PAGE_SCRAPING .env

# If not set or false, you're using single-page mode
```

### Step 2: Backup Current Data

Before migrating, backup your existing provider data:

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup provider files
cp -r data/providers backups/$(date +%Y%m%d)/providers-single-page

# Backup practice overview
cp -r data/practice backups/$(date +%Y%m%d)/practice-single-page

# Backup latest report
cp reports/scraping-report-*.md backups/$(date +%Y%m%d)/ 2>/dev/null || true
```

### Step 3: Enable Multi-Page Scraping

1. **Update environment variable:**

```bash
# In .env file
MULTI_PAGE_SCRAPING=true

# Ensure other scraping settings are configured
SCRAPING_MODE=puppeteer
PAGE_LOAD_TIMEOUT=10000
BROWSER_HEADLESS=true
```

2. **Run the scraper:**

```bash
node src/scrape-providers.js
```

3. **Monitor the output:**
- Look for "Using multi-page scraping architecture"
- Watch progress: "Processing provider X of Y: [name]"
- Check for per-provider success/failure messages

### Step 4: Validate the Results

After running multi-page scraping, validate the improvements:

#### 1. Check Insurance Data Coverage

```bash
# Count providers with insurance information
grep -l "## Insurance" data/providers/*.md | wc -l

# View specific provider's insurance section
grep -A 10 "## Insurance" data/providers/jeffrey-gillman.md
```

**Expected Improvement:**
- Single-page: 0-3 providers with insurance
- Multi-page: 8-12 providers with insurance (80%+ coverage)

#### 2. Review Scraping Report

```bash
# View latest report
cat reports/scraping-report-*.md | tail -1
```

**Key Metrics to Check:**

- **Providers with insurance:** Should be significantly higher
- **Validation warnings:** Should have fewer "Missing insurance" warnings
- **Scraping errors:** Check if any providers failed (should be 0-2 max)
- **Processing time:** Should be 40-90 seconds for 10 providers

#### 3. Compare Provider Files

Compare a few provider files side-by-side:

```bash
# Example: Compare Jeffrey Gillman's profile
# (Assuming you backed up single-page version)

# Single-page version
cat backups/$(date +%Y%m%d)/providers-single-page/jeffrey-gillman.md

# Multi-page version
cat data/providers/jeffrey-gillman.md

# Look for differences in:
# - Insurance section (should be present in multi-page)
# - Bio detail (should be more comprehensive)
# - Contact information (should be more accurate)
```

#### 4. Check Cache Files

Verify per-provider cache files were created:

```bash
# List cache files
ls -lh data/scrape-cache/

# Should see files like:
# - scrape-cache-homepage-2024-01-15T10-30-45-123Z.json
# - scrape-cache-jeffrey-gillman-2024-01-15T10-30-50-456Z.json
# - scrape-cache-[provider-slug]-[timestamp].json
```

### Step 5: Validation Checklist

Before committing to multi-page mode, verify:

- [ ] All provider files were generated successfully
- [ ] Insurance data coverage improved (compare counts)
- [ ] No critical errors in scraping report
- [ ] Processing time is acceptable (<2 minutes for 10 providers)
- [ ] Per-provider cache files exist for debugging
- [ ] Practice overview file still generated correctly
- [ ] Report includes per-provider error details (if any)
- [ ] Validation warnings decreased (especially insurance-related)

## Comparing Outputs

### Side-by-Side Comparison Script

Create a comparison script to analyze differences:

```bash
#!/bin/bash
# compare-scraping-modes.sh

echo "=== Multi-Page vs Single-Page Comparison ==="
echo ""

# Run single-page mode
echo "Running single-page mode..."
MULTI_PAGE_SCRAPING=false node src/scrape-providers.js > /tmp/single-page.log 2>&1
SINGLE_REPORT=$(ls -t reports/scraping-report-*.md | head -1)
cp -r data/providers /tmp/providers-single-page

# Run multi-page mode
echo "Running multi-page mode..."
MULTI_PAGE_SCRAPING=true node src/scrape-providers.js > /tmp/multi-page.log 2>&1
MULTI_REPORT=$(ls -t reports/scraping-report-*.md | head -1)

# Compare insurance coverage
echo ""
echo "=== Insurance Coverage ==="
echo "Single-Page:"
grep "Providers with insurance" "$SINGLE_REPORT"
echo ""
echo "Multi-Page:"
grep "Providers with insurance" "$MULTI_REPORT"

# Compare processing time
echo ""
echo "=== Processing Time ==="
echo "Single-Page:"
grep "Total scraping time" "$SINGLE_REPORT"
echo ""
echo "Multi-Page:"
grep "Total scraping time" "$MULTI_REPORT"

# Compare validation warnings
echo ""
echo "=== Validation Warnings ==="
echo "Single-Page:"
grep -c "Missing insurance" "$SINGLE_REPORT" || echo "0"
echo ""
echo "Multi-Page:"
grep -c "Missing insurance" "$MULTI_REPORT" || echo "0"

# File size comparison
echo ""
echo "=== Average File Size ==="
echo "Single-Page:"
du -sh /tmp/providers-single-page | awk '{print $1}'
echo ""
echo "Multi-Page:"
du -sh data/providers | awk '{print $1}'
```

### Manual Validation Steps

1. **Check Specific Providers:**

```bash
# Providers known to have insurance info on their pages:
# - Jeffrey Gillman
# - [Add other provider names from your site]

# Compare their files
diff backups/$(date +%Y%m%d)/providers-single-page/jeffrey-gillman.md \
     data/providers/jeffrey-gillman.md
```

2. **Verify Link Discovery:**

```bash
# Check scraping report for discovered links
grep "Found.*provider links" reports/scraping-report-*.md | tail -1

# Should show: "Found 10-15 provider links"
```

3. **Review Error Handling:**

```bash
# Check if any providers failed
grep "Failed providers" reports/scraping-report-*.md | tail -1

# Review error details in report
grep -A 20 "## Scraping Errors" reports/scraping-report-*.md | tail -1
```

## Rollback Instructions

If you need to revert to single-page mode:

### Quick Rollback

```bash
# 1. Disable multi-page scraping
echo "MULTI_PAGE_SCRAPING=false" >> .env

# 2. Restore backup (optional)
cp -r backups/$(date +%Y%m%d)/providers-single-page/* data/providers/
cp -r backups/$(date +%Y%m%d)/practice-single-page/* data/practice/

# 3. Run scraper
node src/scrape-providers.js

# 4. Verify output
cat reports/scraping-report-*.md | tail -1
```

### When to Rollback

Consider rolling back if:

- **Performance Issues:** Multi-page takes >2 minutes consistently
- **High Error Rate:** >20% of providers fail to process
- **API Cost Concerns:** OpenRouter costs exceed budget
- **Timeout Problems:** Frequent timeout errors on provider pages
- **Data Quality Issues:** Multi-page produces worse results (rare)

### Troubleshooting Before Rollback

Try these fixes before rolling back:

1. **Increase Timeouts:**
```bash
# In .env
PAGE_LOAD_TIMEOUT=20000  # Increase to 20 seconds
```

2. **Check Network Connectivity:**
```bash
# Test provider page access
curl -I https://www.relationaltherapycollective.com/jeff
```

3. **Review Error Logs:**
```bash
# Check for specific error patterns
grep "Error" reports/scraping-report-*.md | tail -20
```

4. **Verify Browser Setup (Puppeteer):**
```bash
# Ensure Chrome/Chromium is installed
which chromium-browser
which google-chrome
```

## Configuration Reference

### Multi-Page Mode Settings

```bash
# .env configuration for multi-page scraping

# Enable multi-page mode
MULTI_PAGE_SCRAPING=true

# Scraping mode (recommended: puppeteer for complete data)
SCRAPING_MODE=puppeteer

# Timeout settings (increase if providers have slow pages)
PAGE_LOAD_TIMEOUT=10000      # 10 seconds per page

# Browser settings (Puppeteer mode)
BROWSER_HEADLESS=true        # Run without GUI
BROWSER_DISABLE_IMAGES=true  # Faster loading
BROWSER_DISABLE_CSS=false    # Keep CSS for layout

# Retry settings
MAX_RETRIES=3                # Retry failed pages
RETRY_DELAY=1000             # Initial delay in ms

# API settings
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-4
```

### Single-Page Mode Settings

```bash
# .env configuration for single-page scraping

# Disable multi-page mode (or omit this line)
MULTI_PAGE_SCRAPING=false

# Other settings remain the same
SCRAPING_MODE=puppeteer
PAGE_LOAD_TIMEOUT=10000
```

## Performance Expectations

### Processing Time

| Providers | Single-Page | Multi-Page | Difference |
|-----------|-------------|------------|------------|
| 5 | 20-30 sec | 25-45 sec | +5-15 sec |
| 10 | 30-60 sec | 40-90 sec | +10-30 sec |
| 15 | 40-90 sec | 60-135 sec | +20-45 sec |

**Note:** Times vary based on:
- Network speed
- Page complexity
- LLM response time
- Browser mode (Puppeteer vs Axios)

### API Usage

| Mode | LLM Calls | Estimated Cost* |
|------|-----------|-----------------|
| **Single-Page** | 1 | $0.02-0.05 |
| **Multi-Page** | N+1 (11 for 10 providers) | $0.10-0.30 |

*Estimated costs using GPT-4 via OpenRouter. Actual costs vary by model and usage.

### Resource Usage

| Mode | Memory | Network Requests | Cache Files |
|------|--------|------------------|-------------|
| **Single-Page** | ~200-300 MB | 1 | 1 |
| **Multi-Page** | ~200-300 MB | N+1 | N+1 |

## Common Issues and Solutions

### Issue: Provider Links Not Found

**Symptom:** "Found 0 provider links" in output

**Solutions:**
1. Check website structure hasn't changed
2. Verify WEBSITE_URL is correct
3. Review link extraction logic in code
4. Check scraping report for HTML parsing errors

```bash
# Debug: View cached homepage HTML
cat data/scrape-cache/scrape-cache-homepage-*.json | jq -r '.rawHtml' | grep -i "team"
```

### Issue: High Provider Failure Rate

**Symptom:** >20% of providers show errors in report

**Solutions:**
1. Increase PAGE_LOAD_TIMEOUT
2. Check network connectivity
3. Review specific error types in report
4. Verify provider URLs are accessible

```bash
# Test specific provider URL
curl -I https://www.relationaltherapycollective.com/jeff

# Increase timeout
echo "PAGE_LOAD_TIMEOUT=20000" >> .env
```

### Issue: Missing Insurance Data

**Symptom:** Multi-page mode still shows low insurance coverage

**Solutions:**
1. Verify Puppeteer mode is enabled (not Axios)
2. Check if insurance info exists on provider pages
3. Review LLM prompt for insurance extraction
4. Check cache files for raw HTML content

```bash
# Verify scraping mode
grep SCRAPING_MODE .env

# Should be: SCRAPING_MODE=puppeteer

# Check cache for insurance keywords
cat data/scrape-cache/scrape-cache-jeffrey-gillman-*.json | \
  jq -r '.extractedText' | grep -i insurance
```

### Issue: Slow Performance

**Symptom:** Scraping takes >2 minutes for 10 providers

**Solutions:**
1. Enable image/CSS disabling
2. Reduce PAGE_LOAD_TIMEOUT
3. Check network speed
4. Consider using Axios mode (if insurance data not critical)

```bash
# Optimize browser settings
echo "BROWSER_DISABLE_IMAGES=true" >> .env
echo "BROWSER_DISABLE_CSS=true" >> .env
echo "PAGE_LOAD_TIMEOUT=8000" >> .env
```

### Issue: LLM Extraction Errors

**Symptom:** "LLM call failed" errors in report

**Solutions:**
1. Verify OPENROUTER_API_KEY is valid
2. Check API rate limits
3. Review error messages in report
4. Try different model if current one fails

```bash
# Test API key
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models

# Try different model
echo "OPENROUTER_MODEL=anthropic/claude-3-sonnet" >> .env
```

## Best Practices

### 1. Start with Testing

Test multi-page mode in a development environment first:

```bash
# Create test environment
cp .env .env.backup
echo "MULTI_PAGE_SCRAPING=true" >> .env

# Run test scrape
node src/scrape-providers.js

# Compare results
# If satisfied, keep the change
# If not, restore backup
mv .env.backup .env
```

### 2. Monitor First Few Runs

After enabling multi-page mode:

- Review first 3-5 scraping reports
- Check for consistent error patterns
- Verify insurance data improves
- Monitor processing time trends

### 3. Schedule Regular Scraping

Multi-page scraping is more expensive, so adjust frequency:

```bash
# Instead of hourly, consider daily or weekly
# Example cron job (daily at 2 AM)
0 2 * * * cd /path/to/receptionist && node src/scrape-providers.js
```

### 4. Keep Backups

Maintain backups before each scrape:

```bash
# Add to scraping script
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
mkdir -p backups/$DATE
cp -r data/providers backups/$DATE/
node src/scrape-providers.js
```

### 5. Review Reports Regularly

Check scraping reports for:

- Increasing error rates
- Decreasing insurance coverage
- New validation warnings
- Performance degradation

### 6. Document Custom Configurations

If you adjust timeouts or settings:

```bash
# Document in .env.local or README
# Example:
# PAGE_LOAD_TIMEOUT=15000  # Increased due to slow provider pages
# MAX_RETRIES=5            # Increased for flaky network
```

## Validation Criteria

Before considering migration complete, ensure:

### Data Quality Improvements

- [ ] Insurance coverage increased by >50%
- [ ] Provider bios are more detailed
- [ ] Contact information is more accurate
- [ ] Validation warnings decreased

### System Stability

- [ ] Error rate <10% (fewer than 1 in 10 providers fail)
- [ ] Processing time <2 minutes for 10 providers
- [ ] No memory leaks or resource issues
- [ ] Browser processes close properly

### Operational Readiness

- [ ] Team trained on new mode
- [ ] Rollback procedure tested
- [ ] Monitoring in place
- [ ] Documentation updated

## Getting Help

If you encounter issues during migration:

1. **Check Scraping Report:**
   - Review error sections
   - Look for patterns in failures
   - Check recommendations section

2. **Review Cache Files:**
   - Inspect raw HTML for specific providers
   - Verify content is being captured
   - Check for JavaScript rendering issues

3. **Test Individual Components:**
   ```bash
   # Test link extraction
   node -e "const scraper = require('./src/scrape-providers'); scraper.testLinkExtraction()"
   
   # Test single provider processing
   node -e "const scraper = require('./src/scrape-providers'); scraper.testSingleProvider('jeff')"
   ```

4. **Compare with Single-Page:**
   - Run both modes side-by-side
   - Identify specific differences
   - Determine if multi-page is actually better

5. **Rollback if Needed:**
   - Don't hesitate to revert if issues persist
   - Document problems for future investigation
   - Consider gradual rollout approach

## Migration Checklist

Use this checklist to track your migration progress:

### Pre-Migration
- [ ] Backup current provider data
- [ ] Backup current practice overview
- [ ] Save latest scraping report
- [ ] Document current insurance coverage metrics
- [ ] Test environment prepared

### Migration
- [ ] Set MULTI_PAGE_SCRAPING=true in .env
- [ ] Run scraper and monitor output
- [ ] Review scraping report
- [ ] Compare insurance coverage
- [ ] Validate provider files
- [ ] Check cache files created

### Post-Migration
- [ ] Insurance coverage improved
- [ ] Error rate acceptable (<10%)
- [ ] Processing time acceptable (<2 min)
- [ ] Team notified of change
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Rollback procedure tested

### Validation
- [ ] Run 3-5 test scrapes
- [ ] Compare with single-page backups
- [ ] Verify all validation criteria met
- [ ] Confirm operational readiness
- [ ] Sign off on migration complete

---

**Migration Complete?** Keep monitoring for the first week and be ready to rollback if issues arise. Document any custom configurations or lessons learned for future reference.

**Need more help?** Check the main README.md, review scraping reports, or examine cache files for debugging information.
