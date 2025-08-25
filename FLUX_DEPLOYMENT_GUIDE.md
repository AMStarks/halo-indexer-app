# FLUX DRIVE DEPLOYMENT GUIDE FOR HALO INDEXER

## 📋 **Overview**
This guide provides complete instructions for deploying the Halo Indexer to FluxDrive, including all prerequisites, configuration steps, and verification procedures.

---

## 🚀 **Prerequisites**

### **1. Flux Account Setup**
- **Flux Account**: Create account at [runonflux.io](https://runonflux.io)
- **Flux Wallet**: Install Flux wallet and get your address
- **Flux Credits**: Ensure you have sufficient credits for deployment

### **2. Local Development Environment**
```bash
# Required tools
- Docker (v20.10+)
- kubectl (v1.24+)
- Flux CLI (latest)
- Git (for repository access)
```

### **3. Domain Configuration**
- **Domain**: `halo.runonflux.io` (or your preferred subdomain)
- **DNS**: Point to FluxDrive IP (will be provided)
- **SSL**: Automatic SSL certificate provisioning

---

## 🔧 **Step 1: Install Flux CLI**

### **Install Flux CLI**
```bash
# macOS/Linux
curl -s https://fluxcd.io/install.sh | sudo bash

# Windows (using PowerShell)
winget install fluxcd.flux

# Verify installation
flux version
```

### **Login to Flux**
```bash
# Login to your Flux account
flux login

# Verify connection
flux check
```

---

## 🏗️ **Step 2: Prepare Deployment Files**

### **1. Build Docker Image**
```bash
# Navigate to halo-indexer directory
cd lasko-indexer-frontend/halo-indexer

# Build the image
docker build -t halo-indexer:latest .

# Tag for registry (if using external registry)
docker tag halo-indexer:latest your-registry/halo-indexer:latest
```

### **2. Push to Registry (Optional)**
```bash
# If using external registry
docker push your-registry/halo-indexer:latest

# For FluxDrive, you can use local images
```

---

## 📦 **Step 3: Deploy to FluxDrive**

### **Method 1: Using Deployment Script**
```bash
# Make script executable
chmod +x deploy-fluxdrive.sh

# Run deployment
./deploy-fluxdrive.sh
```

### **Method 2: Manual Deployment**
```bash
# 1. Create namespace
kubectl create namespace halo-indexer

# 2. Apply complete deployment
kubectl apply -f flux-deployment-complete.yml

# 3. Wait for deployments
kubectl wait --for=condition=available --timeout=600s deployment/halo-indexer-lead -n halo-indexer
kubectl wait --for=condition=available --timeout=600s deployment/halo-indexer-slave-1 -n halo-indexer
kubectl wait --for=condition=available --timeout=600s deployment/halo-indexer-slave-2 -n halo-indexer
```

---

## 📊 **Step 4: Verify Deployment**

### **1. Check Pod Status**
```bash
# Check all pods
kubectl get pods -n halo-indexer

# Expected output:
# NAME                                READY   STATUS    RESTARTS   AGE
# halo-indexer-lead-xxx              1/1     Running   0          2m
# halo-indexer-slave-1-xxx           1/1     Running   0          2m
# halo-indexer-slave-2-xxx           1/1     Running   0          2m
# redis-xxx                          1/1     Running   0          1m
# cassandra-xxx                      1/1     Running   0          3m
# postgres-xxx                       1/1     Running   0          1m
```

### **2. Check Services**
```bash
# Check services
kubectl get services -n halo-indexer

# Expected output:
# NAME                TYPE           CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
# halo-indexer-lb     LoadBalancer  10.100.200.100   xxx.xxx.xxx.xxx   80:30000/TCP     2m
# redis-service       ClusterIP      10.100.200.101   <none>        6379/TCP         1m
# cassandra-service   ClusterIP      10.100.200.102   <none>        9042/TCP         3m
# postgres-service    ClusterIP      10.100.200.103   <none>        5432/TCP         1m
```

### **3. Test Health Endpoints**
```bash
# Get service URL
SERVICE_URL=$(kubectl get service halo-indexer-lb -n halo-indexer -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test health endpoint
curl -f http://${SERVICE_URL}/api/health

# Test Trinity status
curl -f http://${SERVICE_URL}/api/trinity/status

# Test metrics endpoint
curl -f http://${SERVICE_URL}/api/metrics
```

---

## 🔍 **Step 5: Monitor Deployment**

### **1. View Logs**
```bash
# Lead node logs
kubectl logs -f deployment/halo-indexer-lead -n halo-indexer

# Slave node logs
kubectl logs -f deployment/halo-indexer-slave-1 -n halo-indexer
kubectl logs -f deployment/halo-indexer-slave-2 -n halo-indexer

# Database logs
kubectl logs -f deployment/redis -n halo-indexer
kubectl logs -f deployment/cassandra -n halo-indexer
```

### **2. Check Events**
```bash
# View recent events
kubectl get events -n halo-indexer --sort-by='.lastTimestamp'

# Check for errors
kubectl get events -n halo-indexer --field-selector type=Warning
```

### **3. Resource Usage**
```bash
# Check resource usage
kubectl top pods -n halo-indexer

# Check node resources
kubectl top nodes
```

---

## 🌐 **Step 6: Configure Domain and SSL**

### **1. Domain Configuration**
```bash
# Get the LoadBalancer IP
EXTERNAL_IP=$(kubectl get service halo-indexer-lb -n halo-indexer -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Your service is available at: http://${EXTERNAL_IP}"
echo "Configure your domain to point to: ${EXTERNAL_IP}"
```

### **2. SSL Certificate (Automatic)**
```bash
# FluxDrive provides automatic SSL certificates
# Your service will be available at: https://halo.runonflux.io

# Test SSL endpoint
curl -f https://halo.runonflux.io/api/health
```

---

## 📈 **Step 7: Monitoring Setup**

### **1. Access Grafana Dashboard**
```bash
# Grafana is available at: https://halo.runonflux.io:3001
# Login: admin/admin123

# Or port-forward for local access
kubectl port-forward service/grafana 3001:3000 -n monitoring
```

### **2. Access Prometheus**
```bash
# Prometheus is available at: https://halo.runonflux.io:9090

# Or port-forward for local access
kubectl port-forward service/prometheus 9090:9090 -n monitoring
```

### **3. View Metrics**
```bash
# Check if metrics are being collected
curl https://halo.runonflux.io/api/metrics | grep -E "(api_requests_total|posts_created_total)"
```

---

## 🔧 **Step 8: Configuration Management**

### **1. Update Environment Variables**
```bash
# Edit ConfigMap
kubectl edit configmap halo-indexer-config -n halo-indexer

# Or apply new config
kubectl apply -f flux-deployment-complete.yml
```

### **2. Scale Deployments**
```bash
# Scale lead node
kubectl scale deployment halo-indexer-lead --replicas=2 -n halo-indexer

# Scale slave nodes
kubectl scale deployment halo-indexer-slave-1 --replicas=3 -n halo-indexer
kubectl scale deployment halo-indexer-slave-2 --replicas=3 -n halo-indexer
```

### **3. Update Application**
```bash
# Update image
kubectl set image deployment/halo-indexer-lead halo-indexer=halo-indexer:new-version -n halo-indexer

# Rollout status
kubectl rollout status deployment/halo-indexer-lead -n halo-indexer
```

---

## 🚨 **Step 9: Troubleshooting**

### **Common Issues**

#### **1. Pods Not Starting**
```bash
# Check pod status
kubectl describe pod <pod-name> -n halo-indexer

# Check logs
kubectl logs <pod-name> -n halo-indexer

# Check events
kubectl get events -n halo-indexer --sort-by='.lastTimestamp'
```

#### **2. Services Not Accessible**
```bash
# Check service status
kubectl get services -n halo-indexer

# Check endpoints
kubectl get endpoints -n halo-indexer

# Test connectivity
kubectl run test-pod --image=busybox --rm -it --restart=Never -- nslookup redis-service
```

#### **3. Database Connection Issues**
```bash
# Check database pods
kubectl get pods -l app=redis -n halo-indexer
kubectl get pods -l app=cassandra -n halo-indexer

# Test database connectivity
kubectl run test-pod --image=busybox --rm -it --restart=Never -- wget -O- http://redis-service:6379
```

#### **4. Trinity System Issues**
```bash
# Check Trinity status
curl -f https://halo.runonflux.io/api/trinity/status

# Check leader election
curl -f https://halo.runonflux.io/api/trinity/nodes

# Force leader election
curl -X POST https://halo.runonflux.io/api/trinity/force-election
```

---

## 📋 **Step 10: Maintenance**

### **1. Backup Strategy**
```bash
# Backup Cassandra data
kubectl exec -it cassandra-pod -n halo-indexer -- cqlsh -e "DESCRIBE KEYSPACE halo_indexer"

# Backup Redis data
kubectl exec -it redis-pod -n halo-indexer -- redis-cli BGSAVE

# Backup PostgreSQL data
kubectl exec -it postgres-pod -n halo-indexer -- pg_dump -U postgres halo_indexer > backup.sql
```

### **2. Log Management**
```bash
# View application logs
kubectl logs -f deployment/halo-indexer-lead -n halo-indexer

# Archive old logs
kubectl logs deployment/halo-indexer-lead -n halo-indexer --since=24h > logs-$(date +%Y%m%d).log
```

### **3. Performance Monitoring**
```bash
# Check resource usage
kubectl top pods -n halo-indexer

# Monitor API performance
curl https://halo.runonflux.io/api/metrics | grep api_request_duration_seconds

# Check Trinity performance
curl https://halo.runonflux.io/api/metrics | grep trinity_heartbeat_latency_seconds
```

---

## 🎯 **Expected Results**

### **✅ Successful Deployment**
- **3 Halo Indexer nodes** (1 lead, 2 slaves)
- **1 Redis instance** for caching
- **1 Cassandra cluster** for data storage
- **1 PostgreSQL instance** for additional data
- **Load balancer** for traffic distribution
- **Automatic SSL** certificate
- **Monitoring stack** (Prometheus + Grafana)

### **📊 Performance Metrics**
- **API Response Time**: < 100ms
- **Uptime**: 99.9%+
- **Throughput**: 1000+ requests/second
- **Data Retention**: 200 hours (Prometheus)

### **🔧 Management Commands**
```bash
# Check status
kubectl get all -n halo-indexer

# View logs
kubectl logs -f deployment/halo-indexer-lead -n halo-indexer

# Scale up
kubectl scale deployment halo-indexer-lead --replicas=3 -n halo-indexer

# Update image
kubectl set image deployment/halo-indexer-lead halo-indexer=halo-indexer:v2.0.0 -n halo-indexer

# Access monitoring
kubectl port-forward service/grafana 3001:3000 -n monitoring
```

---

## 🚀 **Next Steps**

### **1. Production Considerations**
- **Monitoring**: Set up alerting for critical metrics
- **Backup**: Configure automated backups
- **Security**: Review and update security policies
- **Scaling**: Plan for horizontal scaling

### **2. Integration**
- **Frontend**: Connect LASKO frontend to FluxDrive deployment
- **Mobile App**: Integrate with iOS Core Wallet
- **Blockchain**: Connect to Telestai mainnet

### **3. Optimization**
- **Performance**: Monitor and optimize based on usage
- **Cost**: Optimize resource usage for cost efficiency
- **Reliability**: Implement additional redundancy

---

## 📞 **Support**

### **FluxDrive Support**
- **Documentation**: [runonflux.io/docs](https://runonflux.io/docs)
- **Community**: [Discord](https://discord.gg/flux)
- **Issues**: [GitHub Issues](https://github.com/runonflux)

### **Halo Indexer Support**
- **Documentation**: Check project documentation
- **Issues**: Report issues in project repository
- **Community**: Join LASKO community channels

---

## ✅ **Deployment Checklist**

- [ ] Flux account created and funded
- [ ] Flux CLI installed and configured
- [ ] Docker image built and tested
- [ ] Kubernetes manifests applied
- [ ] All pods running successfully
- [ ] Services accessible
- [ ] Health endpoints responding
- [ ] Trinity system operational
- [ ] Monitoring stack deployed
- [ ] SSL certificate active
- [ ] Domain configured
- [ ] Performance metrics acceptable
- [ ] Backup strategy implemented
- [ ] Documentation updated

**🎉 Congratulations! Your Halo Indexer is now deployed on FluxDrive!** 