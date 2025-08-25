#!/bin/bash

# FluxDrive Deployment Script for Halo Indexer
# This script deploys the complete Halo Indexer system to FluxDrive

set -e

echo "🚀 Starting FluxDrive Deployment for Halo Indexer..."

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="halo-indexer"
IMAGE_NAME="halo-indexer"
IMAGE_TAG="latest"
FLUX_NAMESPACE="flux-system"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Check prerequisites
print_status "Checking prerequisites..."

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Flux CLI is installed
if ! command -v flux &> /dev/null; then
    print_warning "Flux CLI not found. Installing Flux CLI..."
    curl -s https://fluxcd.io/install.sh | sudo bash
fi

print_success "Prerequisites check completed"

# Step 2: Build Docker image
print_status "Building Docker image..."

# Build the image
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

if [ $? -eq 0 ]; then
    print_success "Docker image built successfully"
else
    print_error "Failed to build Docker image"
    exit 1
fi

# Step 3: Push image to registry (if needed)
print_status "Pushing Docker image to registry..."

# Note: You'll need to configure your registry here
# For now, we'll assume the image is available locally
print_warning "Image push skipped - using local image"

# Step 4: Create namespace
print_status "Creating namespace..."

kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

print_success "Namespace created"

# Step 5: Apply Kubernetes manifests
print_status "Applying Kubernetes manifests..."

# Apply the complete deployment
kubectl apply -f flux-deployment-complete.yml

print_success "Kubernetes manifests applied"

# Step 6: Wait for deployments to be ready
print_status "Waiting for deployments to be ready..."

# Wait for Redis
kubectl wait --for=condition=available --timeout=300s deployment/redis -n ${NAMESPACE}

# Wait for Cassandra
kubectl wait --for=condition=available --timeout=600s deployment/cassandra -n ${NAMESPACE}

# Wait for PostgreSQL
kubectl wait --for=condition=available --timeout=300s deployment/postgres -n ${NAMESPACE}

# Wait for Halo Indexer deployments
kubectl wait --for=condition=available --timeout=300s deployment/halo-indexer-lead -n ${NAMESPACE}
kubectl wait --for=condition=available --timeout=300s deployment/halo-indexer-slave-1 -n ${NAMESPACE}
kubectl wait --for=condition=available --timeout=300s deployment/halo-indexer-slave-2 -n ${NAMESPACE}

print_success "All deployments are ready"

# Step 7: Verify services
print_status "Verifying services..."

# Check if services are running
kubectl get services -n ${NAMESPACE}

# Check if pods are running
kubectl get pods -n ${NAMESPACE}

print_success "Services verification completed"

# Step 8: Test the deployment
print_status "Testing the deployment..."

# Get the service URL
SERVICE_URL=$(kubectl get service halo-indexer-lb -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

if [ -z "$SERVICE_URL" ]; then
    print_warning "LoadBalancer IP not available yet. You may need to wait a few minutes."
    print_status "You can check the status with: kubectl get service halo-indexer-lb -n ${NAMESPACE}"
else
    print_success "Service available at: http://${SERVICE_URL}"
    
    # Test health endpoint
    print_status "Testing health endpoint..."
    curl -f http://${SERVICE_URL}/api/health || print_warning "Health check failed - service may still be starting"
fi

# Step 9: Setup monitoring (optional)
print_status "Setting up monitoring..."

# Create monitoring namespace if it doesn't exist
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Apply Prometheus and Grafana manifests (if available)
if [ -f "monitoring/prometheus.yml" ]; then
    kubectl apply -f monitoring/prometheus.yml
    print_success "Prometheus deployed"
fi

if [ -f "monitoring/grafana.yml" ]; then
    kubectl apply -f monitoring/grafana.yml
    print_success "Grafana deployed"
fi

# Step 10: Setup logging (optional)
print_status "Setting up logging..."

# Apply logging manifests (if available)
if [ -f "logging/elasticsearch.yml" ]; then
    kubectl apply -f logging/elasticsearch.yml
    print_success "Elasticsearch deployed"
fi

if [ -f "logging/kibana.yml" ]; then
    kubectl apply -f logging/kibana.yml
    print_success "Kibana deployed"
fi

# Step 11: Display deployment information
print_success "FluxDrive deployment completed!"

echo ""
echo "📋 Deployment Summary:"
echo "======================"
echo "Namespace: ${NAMESPACE}"
echo "Lead Node: indexer-lead"
echo "Slave Nodes: indexer-slave-1, indexer-slave-2"
echo "Database: Cassandra + PostgreSQL"
echo "Cache: Redis"
echo "Load Balancer: Enabled"
echo "Auto-scaling: Enabled"
echo ""

echo "🔧 Useful Commands:"
echo "==================="
echo "Check status: kubectl get pods -n ${NAMESPACE}"
echo "View logs: kubectl logs -f deployment/halo-indexer-lead -n ${NAMESPACE}"
echo "Check Trinity status: curl http://<service-url>/api/trinity/status"
echo "Check health: curl http://<service-url>/api/health"
echo ""

echo "📊 Monitoring:"
echo "=============="
echo "Trinity Status: http://<service-url>/api/trinity/status"
echo "Cluster Nodes: http://<service-url>/api/trinity/nodes"
echo "Health Check: http://<service-url>/api/health"
echo ""

echo "🚨 Troubleshooting:"
echo "==================="
echo "If services are not ready, check:"
echo "  kubectl describe pods -n ${NAMESPACE}"
echo "  kubectl logs <pod-name> -n ${NAMESPACE}"
echo "  kubectl get events -n ${NAMESPACE}"
echo ""

print_success "FluxDrive deployment script completed successfully!" 