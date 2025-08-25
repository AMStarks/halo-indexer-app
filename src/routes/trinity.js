const express = require('express');
const { getTrinityManager } = require('../services/trinityManager');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/trinity/status
 * Get Trinity cluster status
 */
router.get('/status', async (req, res) => {
  try {
    const trinityManager = getTrinityManager();
    const status = await trinityManager.getClusterStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get Trinity status', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get Trinity status'
    });
  }
});

/**
 * GET /api/trinity/nodes
 * Get all active nodes in the cluster
 */
router.get('/nodes', async (req, res) => {
  try {
    const { getRedisClient } = require('../services/redis');
    const client = await getRedisClient();
    
    const activeNodes = await client.sMembers('trinity:active_nodes');
    const nodes = [];
    
    for (const nodeId of activeNodes) {
      const nodeKey = `trinity:node:${nodeId}`;
      const nodeData = await client.hGetAll(nodeKey);
      
      if (nodeData.nodeId) {
        nodes.push({
          nodeId: nodeData.nodeId,
          status: nodeData.status,
          isLeader: nodeData.isLeader === 'true',
          lastHeartbeat: parseInt(nodeData.lastHeartbeat),
          createdAt: nodeData.createdAt
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        nodes,
        totalNodes: nodes.length
      }
    });
  } catch (error) {
    logger.error('Failed to get Trinity nodes', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get Trinity nodes'
    });
  }
});

/**
 * POST /api/trinity/force-election
 * Force a new leader election (admin only)
 */
router.post('/force-election', async (req, res) => {
  try {
    const trinityManager = getTrinityManager();
    
    // Clear current leader
    const { getRedisClient } = require('../services/redis');
    const client = await getRedisClient();
    await client.del('trinity:leader');
    
    // Start new election
    await trinityManager.startLeaderElection();
    
    res.json({
      success: true,
      message: 'Leader election forced'
    });
  } catch (error) {
    logger.error('Failed to force leader election', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to force leader election'
    });
  }
});

module.exports = router; 