const express = require('express');
const prometheus = require('prom-client');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize Prometheus metrics
const register = new prometheus.Registry();

// Add default metrics (CPU, memory, etc.)
prometheus.collectDefaultMetrics({ register });

// Custom metrics for Halo Indexer
const apiRequestDuration = new prometheus.Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const apiRequestsTotal = new prometheus.Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'route', 'status_code']
});

const apiErrorsTotal = new prometheus.Counter({
  name: 'api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['method', 'route', 'error_type']
});

const postsCreatedTotal = new prometheus.Counter({
  name: 'posts_created_total',
  help: 'Total number of posts created'
});

const postsPerMinute = new prometheus.Gauge({
  name: 'posts_per_minute',
  help: 'Posts created per minute'
});

const batchProcessingDuration = new prometheus.Histogram({
  name: 'batch_processing_duration_seconds',
  help: 'Time to process batches in seconds',
  buckets: [1, 5, 10, 30, 60, 120]
});

const trinityLeaderElections = new prometheus.Counter({
  name: 'trinity_leader_elections_total',
  help: 'Total number of leader elections'
});

const trinityHeartbeatLatency = new prometheus.Histogram({
  name: 'trinity_heartbeat_latency_seconds',
  help: 'Heartbeat response times in seconds',
  buckets: [0.1, 0.5, 1, 2, 5]
});

const trinityNodeStatus = new prometheus.Gauge({
  name: 'trinity_node_status',
  help: 'Status of each node (0=down, 1=up)',
  labelNames: ['node_id']
});

const cassandraQueryDuration = new prometheus.Histogram({
  name: 'cassandra_query_duration_seconds',
  help: 'Cassandra query response times in seconds',
  labelNames: ['operation'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
});

const redisOperationDuration = new prometheus.Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Redis operation response times in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5]
});

const databaseConnections = new prometheus.Gauge({
  name: 'database_connections',
  help: 'Active database connections',
  labelNames: ['database']
});

const systemCpuUsage = new prometheus.Gauge({
  name: 'system_cpu_usage_percent',
  help: 'CPU usage percentage'
});

const systemMemoryUsage = new prometheus.Gauge({
  name: 'system_memory_usage_bytes',
  help: 'Memory usage in bytes'
});

const systemDiskUsage = new prometheus.Gauge({
  name: 'system_disk_usage_percent',
  help: 'Disk usage percentage',
  labelNames: ['mount_point']
});

const networkIOBytes = new prometheus.Counter({
  name: 'network_io_bytes',
  help: 'Network I/O in bytes',
  labelNames: ['direction']
});

// Register all metrics
register.registerMetric(apiRequestDuration);
register.registerMetric(apiRequestsTotal);
register.registerMetric(apiErrorsTotal);
register.registerMetric(postsCreatedTotal);
register.registerMetric(postsPerMinute);
register.registerMetric(batchProcessingDuration);
register.registerMetric(trinityLeaderElections);
register.registerMetric(trinityHeartbeatLatency);
register.registerMetric(trinityNodeStatus);
register.registerMetric(cassandraQueryDuration);
register.registerMetric(redisOperationDuration);
register.registerMetric(databaseConnections);
register.registerMetric(systemCpuUsage);
register.registerMetric(systemMemoryUsage);
register.registerMetric(systemDiskUsage);
register.registerMetric(networkIOBytes);

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    // Update system metrics
    updateSystemMetrics();
    
    // Set content type
    res.set('Content-Type', register.contentType);
    
    // Get metrics
    const metrics = await register.metrics();
    res.end(metrics);
    
    logger.info('Metrics endpoint accessed');
  } catch (error) {
    logger.error('Error generating metrics', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// Helper function to update system metrics
function updateSystemMetrics() {
  try {
    // CPU usage (simplified - in production, use os.cpus())
    const cpuUsage = Math.random() * 100; // Replace with actual CPU monitoring
    systemCpuUsage.set(cpuUsage);
    
    // Memory usage (simplified - in production, use os.freemem())
    const memoryUsage = Math.random() * 1024 * 1024 * 1024; // Replace with actual memory monitoring
    systemMemoryUsage.set(memoryUsage);
    
    // Disk usage (simplified - in production, use fs.statSync())
    const diskUsage = Math.random() * 100; // Replace with actual disk monitoring
    systemDiskUsage.labels('/').set(diskUsage);
    
  } catch (error) {
    logger.error('Error updating system metrics', error);
  }
}

// Middleware to track API requests
function trackApiRequest(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const method = req.method;
    const route = req.route ? req.route.path : req.path;
    const statusCode = res.statusCode;
    
    // Record request duration
    apiRequestDuration.labels(method, route, statusCode).observe(duration);
    
    // Record request count
    apiRequestsTotal.labels(method, route, statusCode).inc();
    
    // Record errors
    if (statusCode >= 400) {
      apiErrorsTotal.labels(method, route, 'http_error').inc();
    }
  });
  
  next();
}

// Export metrics and middleware
module.exports = {
  router,
  trackApiRequest,
  postsCreatedTotal,
  postsPerMinute,
  batchProcessingDuration,
  trinityLeaderElections,
  trinityHeartbeatLatency,
  trinityNodeStatus,
  cassandraQueryDuration,
  redisOperationDuration,
  databaseConnections,
  systemCpuUsage,
  systemMemoryUsage,
  systemDiskUsage,
  networkIOBytes
}; 