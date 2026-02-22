// Unit tests for browser-manager.js closeBrowser() function
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('closeBrowser() - Browser cleanup functionality', () => {
  let mockBrowser;
  let mockPage;
  let mockProcess;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock page
    mockPage = {
      close: vi.fn().mockResolvedValue(undefined)
    };

    // Create mock browser process
    mockProcess = {
      kill: vi.fn()
    };

    // Create mock browser
    mockBrowser = {
      isConnected: vi.fn().mockReturnValue(true),
      pages: vi.fn().mockResolvedValue([mockPage]),
      close: vi.fn().mockResolvedValue(undefined),
      process: vi.fn().mockReturnValue(mockProcess)
    };
  });

  it('should handle null browser gracefully', async () => {
    // Import the function
    const { closeBrowser } = await import('../../src/browser-manager.js');
    
    // Should not throw when browser is null
    await expect(closeBrowser(null)).resolves.toBeUndefined();
  });

  it('should handle undefined browser gracefully', async () => {
    const { closeBrowser } = await import('../../src/browser-manager.js');
    
    // Should not throw when browser is undefined
    await expect(closeBrowser(undefined)).resolves.toBeUndefined();
  });

  it('should close all pages before closing browser', async () => {
    const { closeBrowser } = await import('../../src/browser-manager.js');
    
    await closeBrowser(mockBrowser);
    
    // Verify pages were retrieved
    expect(mockBrowser.pages).toHaveBeenCalled();
    
    // Verify page was closed
    expect(mockPage.close).toHaveBeenCalled();
    
    // Verify browser was closed after pages
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('should check if browser is connected before closing', async () => {
    const { closeBrowser } = await import('../../src/browser-manager.js');
    
    await closeBrowser(mockBrowser);
    
    // Verify isConnected was checked
    expect(mockBrowser.isConnected).toHaveBeenCalled();
  });

  it('should skip closing if browser is already disconnected', async () => {
    const { closeBrowser } = await import('../../src/browser-manager.js');
    
    // Mock browser as disconnected
    mockBrowser.isConnected.mockReturnValue(false);
    
    await closeBrowser(mockBrowser);
    
    // Verify browser.close was NOT called
    expect(mockBrowser.close).not.toHaveBeenCalled();
  });

  it('should handle page close errors gracefully', async () => {
    const { closeBrowser } = await import('../../src/browser-manager.js');
    
    // Mock page close to fail
    mockPage.close.mockRejectedValue(new Error('Page close failed'));
    
    // Should not throw even if page close fails
    await expect(closeBrowser(mockBrowser)).resolves.toBeUndefined();
    
    // Browser should still be closed
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('should attempt to kill browser process if close fails', async () => {
    const { closeBrowser } = await import('../../src/browser-manager.js');
    
    // Mock browser close to fail
    mockBrowser.close.mockRejectedValue(new Error('Browser close failed'));
    
    await closeBrowser(mockBrowser);
    
    // Verify process kill was attempted
    expect(mockBrowser.process).toHaveBeenCalled();
    expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('should not throw if both close and kill fail', async () => {
    const { closeBrowser } = await import('../../src/browser-manager.js');
    
    // Mock both close and kill to fail
    mockBrowser.close.mockRejectedValue(new Error('Browser close failed'));
    mockProcess.kill.mockImplementation(() => {
      throw new Error('Kill failed');
    });
    
    // Should not throw even if everything fails
    await expect(closeBrowser(mockBrowser)).resolves.toBeUndefined();
  });

  it('should handle browser with no process gracefully', async () => {
    const { closeBrowser } = await import('../../src/browser-manager.js');
    
    // Mock browser close to fail and no process available
    mockBrowser.close.mockRejectedValue(new Error('Browser close failed'));
    mockBrowser.process.mockReturnValue(null);
    
    // Should not throw
    await expect(closeBrowser(mockBrowser)).resolves.toBeUndefined();
  });

  it('should close multiple pages if present', async () => {
    const { closeBrowser } = await import('../../src/browser-manager.js');
    
    // Create multiple mock pages
    const mockPage1 = { close: vi.fn().mockResolvedValue(undefined) };
    const mockPage2 = { close: vi.fn().mockResolvedValue(undefined) };
    const mockPage3 = { close: vi.fn().mockResolvedValue(undefined) };
    
    mockBrowser.pages.mockResolvedValue([mockPage1, mockPage2, mockPage3]);
    
    await closeBrowser(mockBrowser);
    
    // Verify all pages were closed
    expect(mockPage1.close).toHaveBeenCalled();
    expect(mockPage2.close).toHaveBeenCalled();
    expect(mockPage3.close).toHaveBeenCalled();
    
    // Verify browser was closed
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
