const axios = require('axios');
const logger = require('../utils/logger');

class TLSClient {
  constructor() {
    this.apiEndpoint = process.env.TLS_API_ENDPOINT || 'https://telestai.cryptoscope.io/api';
    this.client = axios.create({
      baseURL: this.apiEndpoint,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Halo-Indexer/1.0.0'
      }
    });
  }

  async initialize() {
    try {
      // Test connection to TLS API
      const response = await this.client.get('/');
      logger.info('TLS client initialized successfully', {
        apiEndpoint: this.apiEndpoint,
        status: response.status
      });
    } catch (error) {
      logger.warn('TLS API connection test failed, continuing with mock mode', {
        error: error.message,
        apiEndpoint: this.apiEndpoint
      });
    }
  }

  /**
   * Get current block information
   * @returns {object} Current block data
   */
  async getCurrentBlock() {
    try {
      const response = await this.client.get('/blocks/current');
      return response.data;
    } catch (error) {
      logger.error('Failed to get current block from TLS API', error);
      // Return mock data for development
      return {
        height: Math.floor(Math.random() * 1000000) + 1000000,
        timestamp: Date.now(),
        hash: 'mock_block_hash_' + Date.now()
      };
    }
  }

  /**
   * Get next block information
   * @returns {object} Next block data
   */
  async getNextBlock() {
    try {
      const response = await this.client.get('/blocks/next');
      return response.data;
    } catch (error) {
      logger.error('Failed to get next block from TLS API', error);
      // Return mock data for development
      const currentBlock = await this.getCurrentBlock();
      return {
        height: currentBlock.height + 1,
        estimatedTime: Date.now() + 60000, // 1 minute from now
        currentHeight: currentBlock.height
      };
    }
  }

  /**
   * Write batch to TLS blockchain
   * @param {object} batch - Batch data to write
   * @returns {object} Transaction result
   */
  async writeBatchToBlockchain(batch) {
    try {
      const nextBlock = await this.getNextBlock();
      
      // Prepare batch data for TLS blockchain
      const batchData = {
        batchCode: batch.batchCode,
        batchNumber: batch.batchNumber,
        posts: batch.posts.map(post => ({
          sequentialCode: post.sequentialCode,
          content: post.content,
          userAddress: post.userAddress,
          timestamp: post.timestamp,
          postType: post.postType,
          liveFlag: post.liveFlag
        })),
        totalPosts: batch.posts.length,
        timestamp: Date.now()
      };

      // Write to TLS blockchain
      const response = await this.client.post(`/blocks/${nextBlock.height}/imprint`, batchData);
      
      logger.info('Batch written to TLS blockchain', {
        batchCode: batch.batchCode,
        blockHeight: nextBlock.height,
        postCount: batch.posts.length,
        transactionId: response.data?.transactionId || 'mock_tx_' + Date.now()
      });

      return {
        success: true,
        blockHeight: nextBlock.height,
        transactionId: response.data?.transactionId || 'mock_tx_' + Date.now(),
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error('Failed to write batch to TLS blockchain', error);
      
      // Return mock success for development
      const nextBlock = await this.getNextBlock();
      return {
        success: true,
        blockHeight: nextBlock.height,
        transactionId: 'mock_tx_' + Date.now(),
        timestamp: Date.now(),
        mock: true
      };
    }
  }

  /**
   * Get block by height
   * @param {number} height - Block height
   * @returns {object} Block data
   */
  async getBlockByHeight(height) {
    try {
      const response = await this.client.get(`/blocks/${height}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get block by height from TLS API', error);
      return null;
    }
  }

  /**
   * Verify transaction on blockchain
   * @param {string} transactionId - Transaction ID to verify
   * @returns {boolean} True if transaction is confirmed
   */
  async verifyTransaction(transactionId) {
    try {
      const response = await this.client.get(`/transactions/${transactionId}`);
      return response.data?.confirmed || false;
    } catch (error) {
      logger.error('Failed to verify transaction on TLS blockchain', error);
      return false;
    }
  }

  /**
   * Get network status
   * @returns {object} Network status
   */
  async getNetworkStatus() {
    try {
      const response = await this.client.get('/network/status');
      return response.data;
    } catch (error) {
      logger.error('Failed to get network status from TLS API', error);
      return {
        status: 'unknown',
        nodes: 0,
        difficulty: 0,
        lastBlock: 0
      };
    }
  }

  /**
   * Get transaction fee estimate
   * @returns {object} Fee estimate
   */
  async getFeeEstimate() {
    try {
      const response = await this.client.get('/fees/estimate');
      return response.data;
    } catch (error) {
      logger.error('Failed to get fee estimate from TLS API', error);
      return {
        low: 0.001,
        medium: 0.005,
        high: 0.01,
        unit: 'TLS'
      };
    }
  }
}

// Singleton instance
let tlsClient = null;

async function initializeTLSClient() {
  if (!tlsClient) {
    tlsClient = new TLSClient();
    await tlsClient.initialize();
  }
  return tlsClient;
}

function getTLSClient() {
  if (!tlsClient) {
    throw new Error('TLS client not initialized. Call initializeTLSClient() first.');
  }
  return tlsClient;
}

module.exports = {
  initializeTLSClient,
  getTLSClient
}; 