/**
 * Unit tests for extractProviderLinks function
 * Tests provider link extraction from HTML with various structures
 */

import { describe, it, expect } from 'vitest';
import { extractProviderLinks } from '../../src/scrape-providers.js';

describe('extractProviderLinks', () => {
  it('should extract provider links from "Meet the Team" section', () => {
    const html = `
      <html>
        <body>
          <section id="team">
            <h2>Meet the Team</h2>
            <a href="/jeffrey-gillman">Jeffrey Gillman, PhD</a>
            <a href="/miri-arie">Miri Arie, LMFT</a>
            <a href="/john-doe">John Doe, LCSW</a>
          </section>
        </body>
      </html>
    `;

    const links = extractProviderLinks(html);

    expect(links).toHaveLength(3);
    expect(links[0]).toEqual({
      name: 'Jeffrey Gillman, PhD',
      url: expect.stringContaining('/jeffrey-gillman')
    });
    expect(links[1]).toEqual({
      name: 'Miri Arie, LMFT',
      url: expect.stringContaining('/miri-arie')
    });
    expect(links[2]).toEqual({
      name: 'John Doe, LCSW',
      url: expect.stringContaining('/john-doe')
    });
  });

  it('should filter out non-provider links (about, contact, services)', () => {
    const html = `
      <html>
        <body>
          <section id="team">
            <h2>Our Team</h2>
            <a href="/jeffrey-gillman">Jeffrey Gillman</a>
            <a href="/about">About Us</a>
            <a href="/contact">Contact</a>
            <a href="/services">Services</a>
            <a href="/miri-arie">Miri Arie</a>
          </section>
        </body>
      </html>
    `;

    const links = extractProviderLinks(html);

    expect(links).toHaveLength(2);
    expect(links[0].name).toBe('Jeffrey Gillman');
    expect(links[1].name).toBe('Miri Arie');
    
    // Verify excluded links are not present
    expect(links.find(l => l.url.includes('about'))).toBeUndefined();
    expect(links.find(l => l.url.includes('contact'))).toBeUndefined();
    expect(links.find(l => l.url.includes('services'))).toBeUndefined();
  });

  it('should handle relative URLs and convert to absolute', () => {
    const html = `
      <html>
        <body>
          <div class="team-section">
            <h2>Our Providers</h2>
            <a href="/jeffrey-gillman">Jeffrey Gillman</a>
            <a href="miri-arie">Miri Arie</a>
          </div>
        </body>
      </html>
    `;

    const links = extractProviderLinks(html);

    expect(links).toHaveLength(2);
    // Both should be absolute URLs
    expect(links[0].url).toMatch(/^https?:\/\//);
    expect(links[1].url).toMatch(/^https?:\/\//);
  });

  it('should return empty array when no provider links found', () => {
    const html = `
      <html>
        <body>
          <section>
            <h2>Welcome</h2>
            <p>This is our homepage</p>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </section>
        </body>
      </html>
    `;

    const links = extractProviderLinks(html);

    expect(links).toHaveLength(0);
  });

  it('should handle various team section keywords', () => {
    const testCases = [
      { keyword: 'Meet the Team', html: '<section><h2>Meet the Team</h2><a href="/jeff-smith">Jeff Smith</a></section>' },
      { keyword: 'Our Team', html: '<div class="team"><h2>Our Team</h2><a href="/jeff-smith">Jeff Smith</a></div>' },
      { keyword: 'Our Providers', html: '<section><h2>Our Providers</h2><a href="/jeff-smith">Jeff Smith</a></section>' },
      { keyword: 'Our Therapists', html: '<div><h2>Our Therapists</h2><a href="/jeff-smith">Jeff Smith</a></div>' }
    ];

    testCases.forEach(({ keyword, html }) => {
      const fullHtml = `<html><body>${html}</body></html>`;
      const links = extractProviderLinks(fullHtml);
      
      expect(links.length).toBeGreaterThan(0);
      expect(links[0].name).toBe('Jeff Smith');
    });
  });

  it('should skip links with generic text like "Learn More" or "Read More"', () => {
    const html = `
      <html>
        <body>
          <section id="team">
            <h2>Meet the Team</h2>
            <a href="/jeffrey-gillman">Jeffrey Gillman</a>
            <a href="/more-info">Learn More</a>
            <a href="/details">Read More</a>
            <a href="/all">View All</a>
            <a href="/miri-arie">Miri Arie</a>
          </section>
        </body>
      </html>
    `;

    const links = extractProviderLinks(html);

    expect(links).toHaveLength(2);
    expect(links[0].name).toBe('Jeffrey Gillman');
    expect(links[1].name).toBe('Miri Arie');
  });

  it('should avoid duplicate URLs', () => {
    const html = `
      <html>
        <body>
          <section id="team">
            <h2>Meet the Team</h2>
            <a href="/jeffrey-gillman">Jeffrey Gillman, PhD</a>
            <a href="/jeffrey-gillman">Dr. Jeffrey Gillman</a>
            <a href="/miri-arie">Miri Arie</a>
          </section>
        </body>
      </html>
    `;

    const links = extractProviderLinks(html);

    // Should only have 2 unique URLs (jeffrey-gillman appears once, miri-arie once)
    expect(links).toHaveLength(2);
    expect(links[0].url).toContain('/jeffrey-gillman');
    expect(links[1].url).toContain('/miri-arie');
  });

  it('should handle malformed HTML gracefully', () => {
    const html = `
      <html>
        <body>
          <section id="team">
            <h2>Meet the Team
            <a href="/jeffrey-gillman">Jeffrey Gillman</a>
            <a href="/miri-arie">Miri Arie
          </section>
      </html>
    `;

    // Should not throw error
    expect(() => extractProviderLinks(html)).not.toThrow();
    
    const links = extractProviderLinks(html);
    // Cheerio is forgiving with malformed HTML
    expect(links.length).toBeGreaterThanOrEqual(0);
  });

  it('should match provider URL patterns when team section not found', () => {
    const html = `
      <html>
        <body>
          <nav>
            <a href="/jeffrey-gillman">Jeffrey Gillman</a>
            <a href="/miri-arie">Miri Arie</a>
            <a href="/about">About</a>
          </nav>
        </body>
      </html>
    `;

    const links = extractProviderLinks(html);

    // Should find links matching /firstname-lastname pattern
    expect(links.length).toBeGreaterThan(0);
    expect(links.some(l => l.url.includes('jeffrey-gillman'))).toBe(true);
    expect(links.some(l => l.url.includes('miri-arie'))).toBe(true);
  });

  it('should skip links with text that is too short or too long', () => {
    const html = `
      <html>
        <body>
          <section id="team">
            <h2>Meet the Team</h2>
            <a href="/jeff">JG</a>
            <a href="/jeffrey-gillman">Jeffrey Gillman</a>
            <a href="/long-name">${'A'.repeat(150)}</a>
          </section>
        </body>
      </html>
    `;

    const links = extractProviderLinks(html);

    // Should only include the middle one with reasonable length
    expect(links).toHaveLength(1);
    expect(links[0].name).toBe('Jeffrey Gillman');
  });

  it('should filter out service pages like "Individual Therapy" and "Collaborative Care"', () => {
    const html = `
      <html>
        <body>
          <section id="team">
            <h2>Meet the Team</h2>
            <a href="/home">Home</a>
            <a href="/individual-therapy">Individual Therapy</a>
            <a href="/collaborative-care">Collaborative Care</a>
            <a href="/couples-therapy">Couples Therapy</a>
            <a href="/jeffrey-gillman">Jeffrey Gillman, PhD</a>
            <a href="/miri-arie">Miri Arie, LMFT</a>
            <a href="/group-counseling">Group Counseling</a>
          </section>
        </body>
      </html>
    `;

    const links = extractProviderLinks(html);

    // Should only include actual provider names (2 capitalized names)
    expect(links).toHaveLength(2);
    expect(links[0].name).toBe('Jeffrey Gillman, PhD');
    expect(links[1].name).toBe('Miri Arie, LMFT');
    
    // Verify service pages are filtered out
    expect(links.find(l => l.name.includes('Therapy'))).toBeUndefined();
    expect(links.find(l => l.name.includes('Care'))).toBeUndefined();
    expect(links.find(l => l.name.includes('Counseling'))).toBeUndefined();
    expect(links.find(l => l.name.includes('Home'))).toBeUndefined();
  });

  it('should require at least 2 capitalized words for provider names', () => {
    const html = `
      <html>
        <body>
          <section id="team">
            <h2>Meet the Team</h2>
            <a href="/therapy">Therapy</a>
            <a href="/services">Services</a>
            <a href="/jeffrey-gillman">Jeffrey Gillman</a>
            <a href="/miri-arie">Miri Arie</a>
            <a href="/about-us">About Us</a>
          </section>
        </body>
      </html>
    `;

    const links = extractProviderLinks(html);

    // Should only include names with 2+ capitalized words
    expect(links).toHaveLength(2);
    expect(links[0].name).toBe('Jeffrey Gillman');
    expect(links[1].name).toBe('Miri Arie');
  });
});
