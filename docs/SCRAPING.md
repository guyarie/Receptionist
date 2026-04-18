# Website Scraping Reference

The scraper (`npm run scrape-providers`) fetches provider data from your website and writes markdown profiles to `data/providers/`. It has two independent knobs: **browser mode** and **page strategy**.

## Browser Mode

| | Puppeteer (default) | Axios |
|---|---|---|
| Content | JS-rendered pages | Static HTML only |
| Insurance data | Yes | Often missing |
| Requires | Chrome/Chromium | Nothing |
| Speed | ~3–4s per page | ~0.5–1s per page |

Set via `SCRAPING_MODE` in `.env`. Default is `puppeteer`. Use `axios` during development when you don't need complete data and want faster iteration.

If Chrome isn't installed:
```bash
# Ubuntu
sudo apt-get install chromium-browser
```

## Page Strategy

| | Multi-page (default) | Single-page |
|---|---|---|
| Visits | Homepage + each provider's page | Homepage only |
| Data quality | Complete | Incomplete |
| LLM calls | N+1 | 1 |
| Time (10 providers) | 40–90s | 30–60s |

Set via `MULTI_PAGE_SCRAPING=true/false`. Default is `true`.

## Configuration Reference

```env
# Browser mode
SCRAPING_MODE=puppeteer         # puppeteer | axios

# Multi-page strategy
MULTI_PAGE_SCRAPING=true        # true | false

# Browser tuning (Puppeteer only)
PAGE_LOAD_TIMEOUT=10000         # ms per page
BROWSER_HEADLESS=true
BROWSER_DISABLE_IMAGES=true     # faster loads
BROWSER_DISABLE_CSS=false

# Retry behavior
MAX_RETRIES=3
RETRY_DELAY=1000                # ms, doubles on each retry
```

## Troubleshooting

**"Failed to launch browser"** — Chrome not found. Install `chromium-browser` or switch to `SCRAPING_MODE=axios`.

**Timeouts** — Increase `PAGE_LOAD_TIMEOUT=20000`. If persistent, the site may be blocking headless browsers.

**Provider links not found** — Your site structure may have changed. Check `WEBSITE_URL` in `.env` and re-run.

**Insurance data missing** — Expected when using `SCRAPING_MODE=axios`. Switch to `puppeteer`.

**High error rate (>20% of providers)** — Check network connectivity and increase `PAGE_LOAD_TIMEOUT`. Review logs for specific error patterns.
