const { getRedisClient } = require('./redis');
const logger = require('../utils/logger');

class TrinityManager {
  constructor() {
    this.nodeId = process.env.NODE_ID || 'indexer-1';
    this.isLeader = false;
    this.leaderId = null;
    this.heartbeatInterval = 30000; // 30 seconds
    this.heartbeatTimer = null;
    this.leaderElectionTimeout = 60000; // 60 seconds
    this.lastHeartbeat = 0;
    this.nodes = new Set();
  }

  async initialize() {
    try {
      const client = await getRedisClient();
      
      // Register this node
      await this.registerNode();
      
      // Start leader election
      await this.startLeaderElection();
      
      // Start heartbeat
      this.startHeartbeat();
      
      logger.info('Trinity manager initialized', {
        nodeId: this.nodeId,
        isLeader: this.isLeader,
        leaderId: this.leaderId
      });
    } catch (error) {
      logger.error('Failed to initialize Trinity manager', error);
      throw error;
    }
  }

  /**
   * Register this node in the Trinity cluster
   */
  async registerNode() {
    try {
      const client = await getRedisClient();
      const nodeKey = `trinity:node:${this.nodeId}`;
      
      await client.hSet(nodeKey, {
        nodeId: this.nodeId,
        status: 'active',
        lastHeartbeat: Date.now().toString(),
        isLeader: 'false',
        createdAt: new Date().toISOString()
      });
      
      // Add to active nodes set
      await client.sAdd('trinity:active_nodes', this.nodeId);
      
      logger.info('Node registered in Trinity cluster', { nodeId: this.nodeId });
    } catch (error) {
      logger.error('Failed to register node', error);
      throw error;
    }
  }

  /**
   * Start leader election process
   */
  async startLeaderElection() {
    try {
      const client = await getRedisClient();
      
      // Check if there's already a leader
      const leaderKey = 'trinity:leader';
      const currentLeader = await client.get(leaderKey);
      
      if (!currentLeader) {
        // No leader exists, try to become leader
        await this.becomeLeader();
      } else {
        // Leader exists, check if it's still active
        const leaderNodeKey = `trinity:node:${currentLeader}`;
        const leaderData = await client.hGetAll(leaderNodeKey);
        
        if (!leaderData.nodeId || this.isLeaderStale(leaderData.lastHeartbeat)) {
          // Leader is stale, try to become new leader
          await this.becomeLeader();
        } else {
          // Valid leader exists
          this.leaderId = currentLeader;
          this.isLeader = false;
          logger.info('Following existing leader', { leaderId: this.leaderId });
        }
      }
    } catch (error) {
      logger.error('Failed to start leader election', error);
    }
  }

  /**
   * Try to become the leader
   */
  async becomeLeader() {
    try {
      const client = await getRedisClient();
      const leaderKey = 'trinity:leader';
      
      // Try to set this node as leader (atomic operation)
      const result = await client.set(leaderKey, this.nodeId, {
        NX: true, // Only set if key doesn't exist
        EX: 60 // Expire in 60 seconds
      });
      
      if (result === 'OK') {
        // Successfully became leader
        this.isLeader = true;
        this.leaderId = this.nodeId;
        
        // Update node status
        const nodeKey = `trinity:node:${this.nodeId}`;
        await client.hSet(nodeKey, 'isLeader', 'true');
        
        logger.info('Became Trinity leader', { nodeId: this.nodeId });
        
        // Start leader-specific tasks
        await this.startLeaderTasks();
      } else {
        // Another node became leader
        this.isLeader = false;
        this.leaderId = await client.get(leaderKey);
        logger.info('Another node became leader', { leaderId: this.leaderId });
      }
    } catch (error) {
      logger.error('Failed to become leader', error);
    }
  }

  /**
   * Check if leader heartbeat is stale
   */
  isLeaderStale(lastHeartbeat) {
    const now = Date.now();
    const heartbeatTime = parseInt(lastHeartbeat);
    return (now - heartbeatTime) > this.leaderElectionTimeout;
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Send heartbeat to cluster
   */
  async sendHeartbeat() {
    try {
      const client = await getRedisClient();
      const nodeKey = `trinity:node:${this.nodeId}`;
      
      await client.hSet(nodeKey, {
        lastHeartbeat: Date.now().toString(),
        isLeader: this.isLeader.toString()
      });
      
      this.lastHeartbeat = Date.now();
      
      // If we're the leader, check other nodes
      if (this.isLeader) {
        await this.checkOtherNodes();
      }
      
    } catch (error) {
      logger.error('Failed to send heartbeat', error);
    }
  }

  /**
   * Check other nodes in the cluster
   */
  async checkOtherNodes() {
    try {
      const client = await getRedisClient();
      const activeNodes = await client.sMembers('trinity:active_nodes');
      
      for (const nodeId of activeNodes) {
        if (nodeId === this.nodeId) continue;
        
        const nodeKey = `trinity:node:${nodeId}`;
        const nodeData = await client.hGetAll(nodeKey);
        
        if (nodeData.nodeId) {
          const lastHeartbeat = parseInt(nodeData.lastHeartbeat);
          const now = Date.now();
          
          if ((now - lastHeartbeat) > this.leaderElectionTimeout) {
            // Node is stale, remove it
            await client.sRem('trinity:active_nodes', nodeId);
            await client.del(nodeKey);
            logger.warn('Removed stale node from cluster', { nodeId });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check other nodes', error);
    }
  }

  /**
   * Start leader-specific tasks
   */
  async startLeaderTasks() {
    try {
      logger.info('Starting leader tasks', { nodeId: this.nodeId });
      
      // Start batch processing
      await this.startBatchProcessing();
      
      // Start cluster synchronization
      await this.startClusterSync();
      
    } catch (error) {
      logger.error('Failed to start leader tasks', error);
    }
  }

  /**
   * Start batch processing (leader only)
   */
  async startBatchProcessing() {
    try {
      const { getBatchManager } = require('./batchManager');
      const batchManager = getBatchManager();
      
      // Process any pending batches
      await batchManager.forceProcessBatch();
      
      logger.info('Batch processing started by leader');
    } catch (error) {
      logger.error('Failed to start batch processing', error);
    }
  }

  /**
   * Start cluster synchronization (leader only)
   */
  async startClusterSync() {
    try {
      const client = await getRedisClient();
      
      // Broadcast cluster status to all nodes
      const clusterStatus = {
        leaderId: this.nodeId,
        timestamp: Date.now(),
        activeNodes: await client.sMembers('trinity:active_nodes'),
        status: 'healthy'
      };
      
      await client.set('trinity:cluster_status', JSON.stringify(clusterStatus));
      
      logger.info('Cluster synchronization started by leader', {
        activeNodes: clusterStatus.activeNodes.length
      });
    } catch (error) {
      logger.error('Failed to start cluster synchronization', error);
    }
  }

  /**
   * Handle leader failover
   */
  async handleLeaderFailover() {
    try {
      logger.warn('Leader failover detected, starting new election', { nodeId: this.nodeId });
      
      // Clear current leader status
      this.isLeader = false;
      this.leaderId = null;
      
      // Start new leader election
      await this.startLeaderElection();
      
    } catch (error) {
      logger.error('Failed to handle leader failover', error);
    }
  }

  /**
   * Get cluster status
   */
  async getClusterStatus() {
    try {
      const client = await getRedisClient();
      const activeNodes = await client.sMembers('trinity:active_nodes');
      const leaderId = await client.get('trinity:leader');
      
      return {
        nodeId: this.nodeId,
        isLeader: this.isLeader,
        leaderId: leaderId,
        activeNodes: activeNodes,
        totalNodes: activeNodes.length,
        lastHeartbeat: this.lastHeartbeat
      };
    } catch (error) {
      logger.error('Failed to get cluster status', error);
      return null;
    }
  }

  /**
   * Shutdown Trinity manager
   */
  async shutdown() {
    try {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }
      
      const client = await getRedisClient();
      
      // Remove this node from active nodes
      await client.sRem('trinity:active_nodes', this.nodeId);
      
      // If we're the leader, clear leadership
      if (this.isLeader) {
        await client.del('trinity:leader');
      }
      
      // Remove node data
      await client.del(`trinity:node:${this.nodeId}`);
      
      logger.info('Trinity manager shutdown', { nodeId: this.nodeId });
    } catch (error) {
      logger.error('Failed to shutdown Trinity manager', error);
    }
  }
}

// Singleton instance
let trinityManager = null;

async function initializeTrinityManager() {
  if (!trinityManager) {
    trinityManager = new TrinityManager();
    await trinityManager.initialize();
  }
  return trinityManager;
}

function getTrinityManager() {
  if (!trinityManager) {
    throw new Error('Trinity manager not initialized. Call initializeTrinityManager() first.');
  }
  return trinityManager;
}

module.exports = {
  initializeTrinityManager,
  getTrinityManager
}; 