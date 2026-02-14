/**
 * Error Buffer - Ring buffer for storing recent errors
 * 
 * Stores the most recent errors in memory for display on the admin dashboard.
 * When the buffer is full, the oldest error is dropped to make room for new ones.
 */

class ErrorBuffer {
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.errors = [];
  }

  /**
   * Add an error to the buffer
   * @param {Object|Error|string} error - Error object, Error instance, or error message
   * @param {string} context - Optional context string (where the error occurred)
   */
  add(error, context = '') {
    let errorEntry;

    if (typeof error === 'string') {
      // Simple string message
      errorEntry = {
        message: error,
        timestamp: new Date().toISOString(),
        context: context
      };
    } else if (error instanceof Error) {
      // Error instance
      errorEntry = {
        message: error.message,
        timestamp: new Date().toISOString(),
        context: context || error.name,
        stack: error.stack
      };
    } else if (typeof error === 'object' && error !== null) {
      // Already formatted error object
      errorEntry = {
        message: error.message || 'Unknown error',
        timestamp: error.timestamp || new Date().toISOString(),
        context: error.context || context,
        stack: error.stack
      };
    } else {
      // Fallback for unexpected types
      errorEntry = {
        message: String(error),
        timestamp: new Date().toISOString(),
        context: context
      };
    }

    // Add to the beginning of the array (newest first)
    this.errors.unshift(errorEntry);

    // Drop oldest if we exceed maxSize
    if (this.errors.length > this.maxSize) {
      this.errors.pop();
    }
  }

  /**
   * Get all errors, newest first
   * @returns {Array} Array of error objects
   */
  getAll() {
    return [...this.errors]; // Return a copy to prevent external modification
  }

  /**
   * Clear all stored errors
   */
  clear() {
    this.errors = [];
  }

  /**
   * Get the number of stored errors
   * @returns {number} Count of errors in buffer
   */
  count() {
    return this.errors.length;
  }
}

// Export singleton instance
const errorBuffer = new ErrorBuffer();

module.exports = errorBuffer;
