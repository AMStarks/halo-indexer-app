const crypto = require('crypto');
const { getRedisClient } = require('./redis');
const logger = require('../utils/logger');

class SequentialCodeGenerator {
  constructor() {
    this.currentSequence = 0;
    this.redis = null;
  }

  async initialize() {
    this.redis = await getRedisClient();
    
    // Get the last sequence number from Redis
    const lastSequence = await this.redis.get('halo:last_sequence');
    this.currentSequence = lastSequence ? parseInt(lastSequence) : 0;
    
    logger.info('SequentialCodeGenerator initialized', { currentSequence: this.currentSequence });
  }

  /**
   * Generate a unique sequential code
   * @param {string} userAddress - User's wallet address
   * @param {number} timestamp - Post timestamp
   * @returns {string} Sequential code in LAS# format
   */
  async generateSequentialCode(userAddress, timestamp) {
    try {
      // Increment sequence number
      this.currentSequence++;
      
      // Store in Redis for persistence
      await this.redis.set('halo:last_sequence', this.currentSequence);
      
      // Generate the sequential code
      const sequentialCode = this.formatSequentialCode(this.currentSequence);
      
      // Create uniqueness hash
      const nonce = crypto.randomBytes(16).toString('hex');
      const uniquenessHash = crypto
        .createHash('sha256')
        .update(`${timestamp}${userAddress}${nonce}`)
        .digest('hex');
      
      // Store code metadata
      const codeMetadata = {
        sequentialCode,
        userAddress,
        timestamp,
        nonce,
        uniquenessHash,
        createdAt: new Date().toISOString()
      };
      
      // Store each field individually
      for (const [key, value] of Object.entries(codeMetadata)) {
        await this.redis.hSet(`halo:code:${sequentialCode}`, key, value);
      }
      
      logger.info('Generated sequential code', {
        sequentialCode,
        userAddress: userAddress.slice(0, 10) + '...',
        timestamp
      });
      
      return sequentialCode;
    } catch (error) {
      logger.error('Failed to generate sequential code', error);
      throw error;
    }
  }

  /**
   * Format sequence number into LAS# format
   * @param {number} sequence - Sequence number
   * @returns {string} Formatted sequential code
   */
  formatSequentialCode(sequence) {
    // Convert to string and pad with zeros to 32 digits
    const paddedSequence = sequence.toString().padStart(32, '0');
    return `LAS#${paddedSequence}`;
  }

  /**
   * Validate if a sequential code is in correct format
   * @param {string} code - Sequential code to validate
   * @returns {boolean} True if valid format
   */
  validateSequentialCode(code) {
    const pattern = /^LAS#\d{32}$/;
    return pattern.test(code);
  }

  /**
   * Get the next sequence number without generating a code
   * @returns {number} Next sequence number
   */
  getNextSequence() {
    return this.currentSequence + 1;
  }

  /**
   * Get current sequence number
   * @returns {number} Current sequence number
   */
  getCurrentSequence() {
    return this.currentSequence;
  }

  /**
   * Check if we're approaching the limit and need to extend digits
   * @returns {boolean} True if extension needed
   */
  needsExtension() {
    // If we're approaching 999... (32 digits), we'll need to extend
    const maxCurrent = '9'.repeat(32);
    return this.currentSequence >= parseInt(maxCurrent);
  }

  /**
   * Extend the sequential code format by adding more digits
   * This would be called when approaching the limit
   */
  async extendFormat() {
    // This would be implemented when we approach the 32-digit limit
    // For now, we have plenty of room (32 digits = 10^32 possible codes)
    logger.warn('Sequential code format extension not yet implemented');
  }

  /**
   * Get code metadata from Redis
   * @param {string} sequentialCode - The sequential code
   * @returns {object|null} Code metadata or null if not found
   */
  async getCodeMetadata(sequentialCode) {
    try {
      const metadata = await this.redis.hGetAll(`halo:code:${sequentialCode}`);
      return Object.keys(metadata).length > 0 ? metadata : null;
    } catch (error) {
      logger.error('Failed to get code metadata', error);
      return null;
    }
  }

  /**
   * Check if a code already exists
   * @param {string} sequentialCode - The sequential code to check
   * @returns {boolean} True if code exists
   */
  async codeExists(sequentialCode) {
    try {
      const exists = await this.redis.exists(`halo:code:${sequentialCode}`);
      return exists === 1;
    } catch (error) {
      logger.error('Failed to check if code exists', error);
      return false;
    }
  }
}

// Singleton instance
let instance = null;

async function initializeSequentialCodeGenerator() {
  if (!instance) {
    instance = new SequentialCodeGenerator();
    await instance.initialize();
  }
  return instance;
}

function getSequentialCodeGenerator() {
  if (!instance) {
    throw new Error('SequentialCodeGenerator not initialized');
  }
  return instance;
}

module.exports = {
  initializeSequentialCodeGenerator,
  getSequentialCodeGenerator,
  SequentialCodeGenerator
}; 