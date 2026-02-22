/**
 * Unit tests for mainMultiPage function
 * Tests the multi-page scraping orchestration logic
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('mainMultiPage', () => {
  let mainMultiPage;
  let mockFetchWebsite;
  let mockExtractProviderLinks;
  let mockProcessSingleProvider;
  let mockExtractText;
  let mockExtractPracticeOverview;
  let mockWritePracticeOverview;
  let mockGenerateScrapingReport;
  let mockWriteReport;
  let mockBrowserManager;
  let originalExit;
  
  beforeEach(async () => {
    // Reset modules to get fresh imports
    vi.resetModules();
    
    // Mock process.exit to prevent test termination
    originalExit = process.exit;
    process.exit = vi.fn();
    
    // Import the actual module
    const module = await import('../../src/scrape-providers.js');
    mainMultiPage = module.mainMultiPage;
    
    // Create spies for the dependencies
    mockFetchWebsite = vi.spyOn(module, 'fetchWebsite');
    mockExtractProviderLinks = vi.spyOn(module, 'extractProviderLinks');
    mockProcessSingleProvider = vi.spyOn(module, 'processSingleProvider');
    mockExtractText = vi.spyOn(module, 'extractText');
    mockExtractPracticeOverview = vi.fn();
    mockWritePracticeOverview = vi.fn();
    mockGenerateScrapingReport = vi.spyOn(module, 'generateScrapingReport');
    mockWriteReport = vi.spyOn(module, 'writeReport');
    
    // Mock browser manager
    const browserManagerModule = await import('../../src/browser-manager.js');
    mockBrowserManager = {
      launchBrowser: vi.spyOn(browserManagerModule, 'launchBrowser').mockResolvedValue({ id: 'mock-browser' }),
      closeBrowser: vi.spyOn(browserManagerModule, 'closeBrowser').mockResolvedValue(undefined)
    };
  });
  
  afterEach(() => {
    // Restore process.exit
    process.exit = originalExit;
    vi.restoreAllMocks();
  });
  
  it('should successfully process multiple providers', async () => {
    // Mock homepage fetch
    mockFetchWebsite.mockResolvedValueOnce('<html><body>Homepage</body></html>');
    
    // Mock provider links extraction
    const providerLinks = [
      { name: 'Provider 1', url: 'https://example.com/provider1' },
      { name: 'Provider 2', url: 'https://example.com/provider2' }
    ];
    mockExtractProviderLinks.mockReturnValue(providerLinks);
    
    // Mock processSingleProvider results
    mockProcessSingleProvider
      .mockResolvedValueOnce({
        success: true,
        providerName: 'Provider 1',
        slug: 'provider-1',
        operation: 'created',
        warnings: [],
        error: null,
        duration: 100
      })
      .mockResolvedValueOnce({
        success: true,
        providerName: 'Provider 2',
        slug: 'provider-2',
        operation: 'updated',
        warnings: ['Missing insurance'],
        error: null,
        duration: 150
      });
    
    // Mock practice overview extraction
    mockExtractText.mockReturnValue('Homepage text');
    mockExtractPracticeOverview.mockResolvedValue('Practice overview content');
    
    // Mock report generation
    mockGenerateScrapingReport.mockReturnValue('Report content');
    mockWriteReport.mockReturnValue('/path/to/report.md');
    
    // Execute mainMultiPage
    await mainMultiPage();
    
    // Verify process.exit was called with success code
    expect(process.exit).toHaveBeenCalledWith(0);
    
    // Verify fetchWebsite was called for homepage
    expect(mockFetchWebsite).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      'Homepage'
    );
    
    // Verify extractProviderLinks was called
    expect(mockExtractProviderLinks).toHaveBeenCalledWith('<html><body>Homepage</body></html>');
    
    // Verify processSingleProvider was called for each provider
    expect(mockProcessSingleProvider).toHaveBeenCalledTimes(2);
    expect(mockProcessSingleProvider).toHaveBeenNthCalledWith(
      1,
      providerLinks[0],
      expect.anything(),
      1,
      2
    );
    expect(mockProcessSingleProvider).toHaveBeenNthCalledWith(
      2,
      providerLinks[1],
      expect.anything(),
      2,
      2
    );
    
    // Verify report was generated
    expect(mockGenerateScrapingReport).toHaveBeenCalled();
    expect(mockWriteReport).toHaveBeenCalled();
  });
  
  it('should handle homepage fetch failure (fatal error)', async () => {
    // Mock homepage fetch failure
    const fetchError = new Error('Network timeout');
    fetchError.type = 'timeout';
    fetchError.url = 'https://example.com';
    fetchError.attempts = 3;
    mockFetchWebsite.mockRejectedValueOnce(fetchError);
    
    // Mock report generation
    mockGenerateScrapingReport.mockReturnValue('Error report');
    mockWriteReport.mockReturnValue('/path/to/error-report.md');
    
    // Execute mainMultiPage
    await mainMultiPage();
    
    // Verify process.exit was called with error code
    expect(process.exit).toHaveBeenCalledWith(1);
    
    // Verify error report was generated
    expect(mockGenerateScrapingReport).toHaveBeenCalled();
    expect(mockWriteReport).toHaveBeenCalled();
    
    // Verify processSingleProvider was NOT called
    expect(mockProcessSingleProvider).not.toHaveBeenCalled();
  });
  
  it('should handle no provider links found', async () => {
    // Mock homepage fetch
    mockFetchWebsite.mockResolvedValueOnce('<html><body>Homepage</body></html>');
    
    // Mock empty provider links
    mockExtractProviderLinks.mockReturnValue([]);
    
    // Mock practice overview extraction
    mockExtractText.mockReturnValue('Homepage text');
    mockExtractPracticeOverview.mockResolvedValue('Practice overview');
    
    // Mock report generation
    mockGenerateScrapingReport.mockReturnValue('Report content');
    mockWriteReport.mockReturnValue('/path/to/report.md');
    
    // Execute mainMultiPage
    await mainMultiPage();
    
    // Verify process.exit was called with success code (no providers is not an error)
    expect(process.exit).toHaveBeenCalledWith(0);
    
    // Verify processSingleProvider was NOT called
    expect(mockProcessSingleProvider).not.toHaveBeenCalled();
    
    // Verify report was still generated
    expect(mockGenerateScrapingReport).toHaveBeenCalled();
  });
  
  it('should aggregate results correctly', async () => {
    // Mock homepage fetch
    mockFetchWebsite.mockResolvedValueOnce('<html><body>Homepage</body></html>');
    
    // Mock provider links
    const providerLinks = [
      { name: 'Provider 1', url: 'https://example.com/provider1' },
      { name: 'Provider 2', url: 'https://example.com/provider2' },
      { name: 'Provider 3', url: 'https://example.com/provider3' }
    ];
    mockExtractProviderLinks.mockReturnValue(providerLinks);
    
    // Mock processSingleProvider results with different outcomes
    mockProcessSingleProvider
      .mockResolvedValueOnce({
        success: true,
        providerName: 'Provider 1',
        slug: 'provider-1',
        operation: 'created',
        warnings: [],
        error: null,
        duration: 100
      })
      .mockResolvedValueOnce({
        success: false,
        providerName: 'Provider 2',
        slug: '',
        operation: 'skipped',
        warnings: [],
        error: { type: 'timeout', message: 'Timeout', url: 'https://example.com/provider2' },
        duration: 5000
      })
      .mockResolvedValueOnce({
        success: true,
        providerName: 'Provider 3',
        slug: 'provider-3',
        operation: 'updated',
        warnings: ['Missing email', 'Missing phone'],
        error: null,
        duration: 200
      });
    
    // Mock practice overview
    mockExtractText.mockReturnValue('Homepage text');
    mockExtractPracticeOverview.mockResolvedValue('Practice overview');
    
    // Mock report generation
    let capturedReportData;
    mockGenerateScrapingReport.mockImplementation((data) => {
      capturedReportData = data;
      return 'Report content';
    });
    mockWriteReport.mockReturnValue('/path/to/report.md');
    
    // Execute mainMultiPage
    await mainMultiPage();
    
    // Verify aggregation
    expect(capturedReportData).toBeDefined();
    expect(capturedReportData.operations.created).toEqual(['provider-1']);
    expect(capturedReportData.operations.updated).toEqual(['provider-3']);
    expect(capturedReportData.operations.errors).toHaveLength(1);
    expect(capturedReportData.operations.errors[0].provider).toBe('Provider 2');
    expect(capturedReportData.operations.validationWarnings).toHaveLength(1);
    expect(capturedReportData.operations.validationWarnings[0].provider).toBe('Provider 3');
    expect(capturedReportData.operations.validationWarnings[0].warnings).toEqual(['Missing email', 'Missing phone']);
  });
  
  it('should close browser in finally block even on error', async () => {
    // Mock homepage fetch failure
    mockFetchWebsite.mockRejectedValueOnce(new Error('Network error'));
    
    // Mock report generation
    mockGenerateScrapingReport.mockReturnValue('Error report');
    mockWriteReport.mockReturnValue('/path/to/report.md');
    
    // Execute mainMultiPage
    await mainMultiPage();
    
    // Verify browser was closed
    expect(mockBrowserManager.closeBrowser).toHaveBeenCalled();
  });
  
  it('should handle practice overview extraction failure gracefully', async () => {
    // Mock homepage fetch
    mockFetchWebsite.mockResolvedValueOnce('<html><body>Homepage</body></html>');
    
    // Mock provider links
    mockExtractProviderLinks.mockReturnValue([
      { name: 'Provider 1', url: 'https://example.com/provider1' }
    ]);
    
    // Mock successful provider processing
    mockProcessSingleProvider.mockResolvedValueOnce({
      success: true,
      providerName: 'Provider 1',
      slug: 'provider-1',
      operation: 'created',
      warnings: [],
      error: null,
      duration: 100
    });
    
    // Mock practice overview extraction failure
    mockExtractText.mockReturnValue('Homepage text');
    mockExtractPracticeOverview.mockRejectedValue(new Error('LLM error'));
    
    // Mock report generation
    mockGenerateScrapingReport.mockReturnValue('Report content');
    mockWriteReport.mockReturnValue('/path/to/report.md');
    
    // Execute mainMultiPage - should not throw
    await mainMultiPage();
    
    // Verify process.exit was called with success code (practice overview failure is non-fatal)
    expect(process.exit).toHaveBeenCalledWith(0);
    
    // Verify provider was still processed
    expect(mockProcessSingleProvider).toHaveBeenCalled();
  });
});
