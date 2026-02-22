# Testing Best Practices

## Integration Tests Are Critical

**Lesson learned:** Unit tests with mocks are valuable, but they can miss real-world issues. Always include integration tests that exercise the main functionality end-to-end.

### The Problem
- Unit tests may mock external dependencies (databases, APIs, browsers, etc.)
- Mocked tests verify logic structure but don't catch:
  - Deprecated API calls
  - Version incompatibilities
  - Real-world timing issues
  - Actual integration failures

### The Solution
For every major feature, include at least one integration test that:
1. **Uses real dependencies** (or as close to real as possible)
2. **Exercises the complete flow** from entry point to output
3. **Tests the primary use case** that users will actually encounter

### Example
When implementing browser automation with Puppeteer:
- ❌ **Unit test only:** Mock the browser, verify function calls
- ✅ **Integration test:** Actually launch Puppeteer, fetch a real page, verify HTML is returned

```javascript
// Integration test example
it('should fetch a real page with Puppeteer', async () => {
  const browser = await launchBrowser();
  const html = await fetchWithBrowser(browser, 'https://example.com');
  expect(html).toContain('<html');
  await closeBrowser(browser);
});
```

### Guidelines
- **Unit tests:** Fast, isolated, test individual functions and edge cases
- **Integration tests:** Slower, test real interactions, catch real-world issues
- **Balance:** Aim for 80% unit tests, 20% integration tests
- **Critical paths:** Always have integration tests for user-facing features

### When to Write Integration Tests
- New external API integrations
- Database operations
- File system operations
- Browser automation
- Network requests
- Third-party library usage
- Any code that interacts with the real world

**Remember:** If it can fail in production due to external factors, it needs an integration test.
