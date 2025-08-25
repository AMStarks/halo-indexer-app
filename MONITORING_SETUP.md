# PROMETHEUS/GRAFANA MONITORING SETUP - HALO INDEXER

## 📊 **Monitoring Overview**

### **What We Monitor**
- **Application Metrics**: API response times, throughput, error rates
- **System Metrics**: CPU, memory, disk usage
- **Database Metrics**: Cassandra and Redis performance
- **Network Metrics**: Request latency, bandwidth usage
- **Business Metrics**: Posts per minute, active users, batch processing

### **Monitoring Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Halo Indexer  │    │   Prometheus    │    │     Grafana     │
│   (Metrics)     │───▶│   (Collector)   │───▶│   (Dashboard)   │
│                 │    │                 │    │                 │
│ • API Metrics   │    │ • Time Series   │    │ • Visual Charts │
│ • System Stats  │    │ • Data Storage  │    │ • Alerts        │
│ • Custom Metrics│    │ • Query Engine  │    │ • Notifications │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Node Exporter │    │   Alert Manager │    │   Email/Slack   │
│   (System)      │    │   (Alerts)      │    │   (Notifications)│
│                 │    │                 │    │                 │
│ • CPU Usage     │    │ • Thresholds    │    │ • Real-time     │
│ • Memory Usage  │    │ • Notifications │    │ • Escalation    │
│ • Disk I/O      │    │ • Escalation    │    │ • Reports       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🎯 **Key Metrics We Monitor**

### **1. Application Metrics**
```javascript
// Halo Indexer Custom Metrics
const metrics = {
  // API Performance
  api_request_duration_seconds: 'Histogram of API response times',
  api_requests_total: 'Total number of API requests',
  api_errors_total: 'Total number of API errors',
  
  // Post Processing
  posts_created_total: 'Total posts created',
  posts_per_minute: 'Posts created per minute',
  batch_processing_duration: 'Time to process batches',
  
  // Trinity System
  trinity_leader_elections: 'Number of leader elections',
  trinity_heartbeat_latency: 'Heartbeat response times',
  trinity_node_status: 'Status of each node (0=down, 1=up)',
  
  // Database Performance
  cassandra_query_duration: 'Cassandra query response times',
  redis_operation_duration: 'Redis operation response times',
  database_connections: 'Active database connections',
  
  // System Resources
  cpu_usage_percent: 'CPU usage percentage',
  memory_usage_bytes: 'Memory usage in bytes',
  disk_usage_percent: 'Disk usage percentage',
  network_io_bytes: 'Network I/O in bytes'
};
```

### **2. Business Metrics**
```javascript
// Business KPIs
const businessMetrics = {
  // User Activity
  active_users_total: 'Number of active users',
  posts_per_user: 'Average posts per user',
  user_retention_rate: 'User retention percentage',
  
  // Content Metrics
  content_engagement_rate: 'Engagement rate per post',
  media_posts_percentage: 'Percentage of posts with media',
  live_posts_percentage: 'Percentage of live posts',
  
  // System Health
  system_uptime_percentage: 'System availability',
  error_rate_percentage: 'Error rate percentage',
  response_time_p95: '95th percentile response time'
};
```

## 🔧 **Implementation**

### **1. Prometheus Configuration**
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "halo_alerts.yml"

scrape_configs:
  # Halo Indexer Metrics
  - job_name: 'halo-indexer'
    static_configs:
      - targets: ['halo-indexer:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 10s

  # System Metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  # Cassandra Metrics
  - job_name: 'cassandra'
    static_configs:
      - targets: ['cassandra:9042']
    metrics_path: '/metrics'

  # Redis Metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    metrics_path: '/metrics'
```

### **2. Halo Indexer Metrics Endpoint**
```javascript
// src/routes/metrics.js
const express = require('express');
const prometheus = require('prom-client');

const router = express.Router();

// Create metrics
const apiRequestDuration = new prometheus.Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const postsCreatedTotal = new prometheus.Counter({
  name: 'posts_created_total',
  help: 'Total number of posts created'
});

const trinityLeaderElections = new prometheus.Counter({
  name: 'trinity_leader_elections_total',
  help: 'Total number of leader elections'
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

module.exports = router;
```

### **3. Grafana Dashboard Configuration**
```json
{
  "dashboard": {
    "title": "Halo Indexer Dashboard",
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(api_request_duration_seconds_sum[5m]) / rate(api_request_duration_seconds_count[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Posts Created per Minute",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(posts_created_total[1m]) * 60",
            "legendFormat": "Posts/min"
          }
        ]
      },
      {
        "title": "Trinity System Status",
        "type": "stat",
        "targets": [
          {
            "expr": "trinity_node_status",
            "legendFormat": "Node {{node}}"
          }
        ]
      },
      {
        "title": "System Resources",
        "type": "graph",
        "targets": [
          {
            "expr": "cpu_usage_percent",
            "legendFormat": "CPU %"
          },
          {
            "expr": "memory_usage_bytes / 1024 / 1024",
            "legendFormat": "Memory MB"
          }
        ]
      }
    ]
  }
}
```

## 🚨 **Alerting Rules**

### **1. Critical Alerts**
```yaml
# halo_alerts.yml
groups:
  - name: halo_critical
    rules:
      - alert: HaloIndexerDown
        expr: up{job="halo-indexer"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Halo Indexer is down"
          description: "Halo Indexer has been down for more than 1 minute"

      - alert: HighErrorRate
        expr: rate(api_errors_total[5m]) / rate(api_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% for 2 minutes"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is above 1 second"
```

### **2. Business Alerts**
```yaml
  - name: halo_business
    rules:
      - alert: LowPostActivity
        expr: rate(posts_created_total[10m]) < 1
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Low post activity"
          description: "Less than 1 post per minute for 15 minutes"

      - alert: TrinityLeaderElection
        expr: increase(trinity_leader_elections_total[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Trinity leader election occurred"
          description: "A new leader election happened in the Trinity system"
```

## 📊 **Dashboard Examples**

### **1. System Overview Dashboard**
- **CPU Usage**: Real-time CPU utilization
- **Memory Usage**: Memory consumption trends
- **Disk I/O**: Storage performance metrics
- **Network Traffic**: Network utilization

### **2. Application Performance Dashboard**
- **API Response Times**: 50th, 95th, 99th percentiles
- **Request Rate**: Requests per second
- **Error Rate**: Error percentage over time
- **Active Connections**: Database and Redis connections

### **3. Business Metrics Dashboard**
- **Posts Created**: Posts per minute/hour/day
- **User Activity**: Active users over time
- **Content Engagement**: Engagement rates
- **System Health**: Uptime and availability

### **4. Trinity System Dashboard**
- **Leader Status**: Current leader node
- **Heartbeat Latency**: Node communication times
- **Failover Events**: Leader election frequency
- **Cluster Health**: Overall cluster status

## 🔧 **Deployment Configuration**

### **1. Kubernetes Monitoring Stack**
```yaml
# monitoring-stack.yml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
      volumes:
      - name: config
        configMap:
          name: prometheus-config

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          value: "admin123"
```

### **2. Service Configuration**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: prometheus-service
  namespace: monitoring
spec:
  selector:
    app: prometheus
  ports:
  - port: 9090
    targetPort: 9090
  type: ClusterIP

---
apiVersion: v1
kind: Service
metadata:
  name: grafana-service
  namespace: monitoring
spec:
  selector:
    app: grafana
  ports:
  - port: 3000
    targetPort: 3000
  type: LoadBalancer
```

## 🎯 **Benefits of This Monitoring Setup**

### **1. Proactive Problem Detection**
- **Early Warning**: Detect issues before users are affected
- **Performance Tracking**: Monitor system performance trends
- **Capacity Planning**: Plan for growth based on usage patterns

### **2. Business Intelligence**
- **User Behavior**: Understand how users interact with the system
- **Content Analytics**: Track engagement and content performance
- **System Optimization**: Identify bottlenecks and optimization opportunities

### **3. Operational Excellence**
- **Automated Alerts**: Get notified of issues immediately
- **Historical Data**: Analyze trends and patterns over time
- **Root Cause Analysis**: Quickly identify the source of problems

### **4. SLA Monitoring**
- **Uptime Tracking**: Monitor 99.9% availability target
- **Response Time**: Ensure < 100ms API response times
- **Error Rate**: Keep errors below 1% threshold

This monitoring setup provides **complete visibility** into the Halo Indexer's performance, health, and business metrics! 📊 