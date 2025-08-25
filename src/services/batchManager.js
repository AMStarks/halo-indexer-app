const { getRedisClient } = require('./redis');
const logger = require('../utils/logger');

class BatchManager {
  constructor() {
    this.currentBatchNumber = 0;
    this.batchTimeout = 30000; // 30 seconds
    this.maxBatchSize = 100; // Maximum posts per batch
    this.activeBatch = null;
    this.batchTimer = null;
  }

  async initialize() {
    const client = await getRedisClient();
    const lastBatch = await client.get('halo:last_batch_number');
    this.currentBatchNumber = lastBatch ? parseInt(lastBatch) : 0;
    logger.info('BatchManager initialized', { currentBatchNumber: this.currentBatchNumber });
  }

  /**
   * Add post to current batch or create new batch
   * @param {object} postData - Post data to add to batch
   * @returns {object} Batch information
   */
  async addPostToBatch(postData) {
    try {
      const client = await getRedisClient();
      
      // If no active batch, create one
      if (!this.activeBatch) {
        this.currentBatchNumber++;
        this.activeBatch = {
          batchNumber: this.currentBatchNumber,
          batchCode: this.formatBatchCode(this.currentBatchNumber),
          posts: [],
          createdAt: Date.now(),
          status: 'active'
        };
        
        // Save batch number
        await client.set('halo:last_batch_number', this.currentBatchNumber);
        
        // Set timer to process batch
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.batchTimeout);
        
        logger.info('Created new batch', { 
          batchCode: this.activeBatch.batchCode,
          batchNumber: this.currentBatchNumber 
        });
      }
      
      // Add post to current batch
      this.activeBatch.posts.push({
        sequentialCode: postData.sequentialCode,
        content: postData.content,
        userAddress: postData.userAddress,
        timestamp: postData.timestamp,
        postType: postData.postType,
        liveFlag: postData.liveFlag || 'live'
      });
      
      // Store batch in Redis
      await this.storeBatch(this.activeBatch);
      
      logger.info('Added post to batch', {
        batchCode: this.activeBatch.batchCode,
        sequentialCode: postData.sequentialCode,
        batchSize: this.activeBatch.posts.length
      });
      
      // Check if batch is full
      if (this.activeBatch.posts.length >= this.maxBatchSize) {
        await this.processBatch();
      }
      
      return {
        batchCode: this.activeBatch.batchCode,
        batchNumber: this.activeBatch.batchNumber,
        postCount: this.activeBatch.posts.length,
        status: 'added'
      };
      
    } catch (error) {
      logger.error('Failed to add post to batch', error);
      throw error;
    }
  }

  /**
   * Process current batch (write to TLS blockchain)
   */
  async processBatch() {
    if (!this.activeBatch || this.activeBatch.status !== 'active') {
      return;
    }
    
    try {
      const client = await getRedisClient();
      
      // Mark batch as processing
      this.activeBatch.status = 'processing';
      this.activeBatch.processedAt = Date.now();
      
      // Store batch in Redis
      await this.storeBatch(this.activeBatch);
      
      logger.info('Processing batch', {
        batchCode: this.activeBatch.batchCode,
        postCount: this.activeBatch.posts.length
      });
      
      // TODO: Write batch to TLS blockchain
      // This will be implemented when we integrate with TLS API
      await this.writeBatchToTLS(this.activeBatch);
      
      // Mark batch as completed
      this.activeBatch.status = 'completed';
      await this.storeBatch(this.activeBatch);
      
      // Clear active batch
      this.activeBatch = null;
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
      
      logger.info('Batch processed successfully', {
        batchCode: this.activeBatch.batchCode,
        postCount: this.activeBatch.posts.length
      });
      
    } catch (error) {
      logger.error('Failed to process batch', error);
      // Mark batch as failed
      if (this.activeBatch) {
        this.activeBatch.status = 'failed';
        this.activeBatch.error = error.message;
        await this.storeBatch(this.activeBatch);
      }
    }
  }

  /**
   * Write batch to TLS blockchain
   * @param {object} batch - Batch to write
   */
  async writeBatchToTLS(batch) {
    try {
      const { getTLSClient } = require('./tlsClient');
      const tlsClient = getTLSClient();
      
      logger.info('Writing batch to TLS blockchain', {
        batchCode: batch.batchCode,
        postCount: batch.posts.length
      });
      
      // Write batch to TLS blockchain
      const result = await tlsClient.writeBatchToBlockchain(batch);
      
      // Update batch with blockchain information
      batch.blockHeight = result.blockHeight;
      batch.transactionId = result.transactionId;
      batch.blockchainTimestamp = result.timestamp;
      
      logger.info('Batch written to TLS blockchain', {
        batchCode: batch.batchCode,
        blockHeight: result.blockHeight,
        transactionId: result.transactionId,
        postCount: batch.posts.length
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to write batch to TLS blockchain', error);
      throw error;
    }
  }

  /**
   * Store batch in Redis
   * @param {object} batch - Batch to store
   */
  async storeBatch(batch) {
    try {
      const client = await getRedisClient();
      const batchKey = `halo:batch:${batch.batchCode}`;
      
      // Store batch data
      await client.hSet(batchKey, {
        batchCode: batch.batchCode,
        batchNumber: batch.batchNumber.toString(),
        status: batch.status,
        createdAt: batch.createdAt.toString(),
        processedAt: batch.processedAt?.toString() || '',
        postCount: batch.posts.length.toString(),
        error: batch.error || ''
      });
      
      // Store posts in batch
      for (let i = 0; i < batch.posts.length; i++) {
        const post = batch.posts[i];
        const postKey = `halo:batch:${batch.batchCode}:post:${i}`;
        await client.hSet(postKey, {
          sequentialCode: post.sequentialCode,
          content: post.content,
          userAddress: post.userAddress,
          timestamp: post.timestamp.toString(),
          postType: post.postType,
          liveFlag: post.liveFlag
        });
      }
      
      // Add to chronological batch index
      await client.zAdd('halo:batches:chronological', {
        score: batch.createdAt,
        value: batch.batchCode
      });
      
    } catch (error) {
      logger.error('Failed to store batch in Redis', error);
      throw error;
    }
  }

  /**
   * Get batch information
   * @param {string} batchCode - Batch code to retrieve
   * @returns {object|null} Batch information
   */
  async getBatch(batchCode) {
    try {
      const client = await getRedisClient();
      const batchKey = `halo:batch:${batchCode}`;
      
      const batchData = await client.hGetAll(batchKey);
      if (Object.keys(batchData).length === 0) {
        return null;
      }
      
      // Get posts in batch
      const posts = [];
      let i = 0;
      while (true) {
        const postKey = `halo:batch:${batchCode}:post:${i}`;
        const postData = await client.hGetAll(postKey);
        if (Object.keys(postData).length === 0) {
          break;
        }
        posts.push(postData);
        i++;
      }
      
      return {
        ...batchData,
        posts
      };
      
    } catch (error) {
      logger.error('Failed to get batch', error);
      return null;
    }
  }

  /**
   * Format batch code
   * @param {number} batchNumber - Batch number
   * @returns {string} Formatted batch code
   */
  formatBatchCode(batchNumber) {
    return `LGB#${batchNumber.toString().padStart(8, '0')}`;
  }

  /**
   * Get current batch status
   * @returns {object} Current batch information
   */
  getCurrentBatchStatus() {
    if (!this.activeBatch) {
      return { status: 'no_active_batch' };
    }
    
    return {
      batchCode: this.activeBatch.batchCode,
      batchNumber: this.activeBatch.batchNumber,
      postCount: this.activeBatch.posts.length,
      status: this.activeBatch.status,
      createdAt: this.activeBatch.createdAt
    };
  }

  /**
   * Force process current batch
   */
  async forceProcessBatch() {
    if (this.activeBatch && this.activeBatch.status === 'active') {
      await this.processBatch();
    }
  }
}

// Singleton instance
let batchManager = null;

async function initializeBatchManager() {
  if (!batchManager) {
    batchManager = new BatchManager();
    await batchManager.initialize();
  }
  return batchManager;
}

function getBatchManager() {
  if (!batchManager) {
    throw new Error('BatchManager not initialized. Call initializeBatchManager() first.');
  }
  return batchManager;
}

module.exports = {
  initializeBatchManager,
  getBatchManager
}; 