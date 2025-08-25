const express = require('express');
const { getRedisClient } = require('../services/redis');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Halo Indexer',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeId: process.env.NODE_ID || 'unknown',
      checks: {
        redis: 'unknown',
        database: 'unknown',
        sequentialCodeGenerator: 'unknown'
      }
    };

    // Check Redis connection
    try {
      const redis = getRedisClient();
      await redis.ping();
      health.checks.redis = 'healthy';
    } catch (error) {
      health.checks.redis = 'unhealthy';
      health.status = 'degraded';
      logger.error('Redis health check failed', error);
    }

    // Check database connection (placeholder)
    try {
      // TODO: Add actual database health check
      health.checks.database = 'healthy';
    } catch (error) {
      health.checks.database = 'unhealthy';
      health.status = 'degraded';
      logger.error('Database health check failed', error);
    }

    // Check sequential code generator
    try {
      // TODO: Add actual sequential code generator health check
      health.checks.sequentialCodeGenerator = 'healthy';
    } catch (error) {
      health.checks.sequentialCodeGenerator = 'unhealthy';
      health.status = 'degraded';
      logger.error('Sequential code generator health check failed', error);
    }

    // Determine overall status
    const unhealthyChecks = Object.values(health.checks).filter(check => check === 'unhealthy');
    if (unhealthyChecks.length > 0) {
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'Halo Indexer',
      error: 'Health check failed'
    });
  }
});

/**
 * GET /api/health/ready
 * Readiness check for Kubernetes/container orchestration
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if all critical services are ready
    const redis = getRedisClient();
    await redis.ping();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Service not ready'
    });
  }
});

/**
 * GET /api/health/live
 * Liveness check for Kubernetes/container orchestration
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 