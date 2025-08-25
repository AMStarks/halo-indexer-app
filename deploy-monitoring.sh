#!/bin/bash

# Halo Indexer Monitoring Stack Deployment
# Includes: Halo Indexer, Prometheus, Grafana, Node Exporter, Redis, Cassandra, PostgreSQL

set -e

echo "🚀 Starting Halo Indexer Monitoring Stack Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create monitoring directories
print_status "Creating monitoring directories..."
mkdir -p monitoring/prometheus_data
mkdir -p monitoring/grafana_data
mkdir -p monitoring/grafana/provisioning/datasources
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/dashboards

# Set proper permissions
chmod 755 monitoring/prometheus_data
chmod 755 monitoring/grafana_data

print_success "Monitoring directories created"

# Build and start the monitoring stack
print_status "Building and starting monitoring stack..."
docker-compose -f docker-compose-monitoring.yml up -d --build

# Wait for services to start
print_status "Waiting for services to start..."
sleep 30

# Check service status
print_status "Checking service status..."

# Check Halo Indexer
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    print_success "Halo Indexer is running"
else
    print_warning "Halo Indexer health check failed, but continuing..."
fi

# Check Prometheus
if curl -f http://localhost:9090/-/healthy > /dev/null 2>&1; then
    print_success "Prometheus is running"
else
    print_warning "Prometheus health check failed, but continuing..."
fi

# Check Grafana
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    print_success "Grafana is running"
else
    print_warning "Grafana health check failed, but continuing..."
fi

# Check Node Exporter
if curl -f http://localhost:9100/metrics > /dev/null 2>&1; then
    print_success "Node Exporter is running"
else
    print_warning "Node Exporter health check failed, but continuing..."
fi

# Check Redis
if docker exec redis redis-cli ping > /dev/null 2>&1; then
    print_success "Redis is running"
else
    print_warning "Redis health check failed, but continuing..."
fi

# Check Cassandra
if docker exec cassandra cqlsh -e "SHOW VERSION" > /dev/null 2>&1; then
    print_success "Cassandra is running"
else
    print_warning "Cassandra health check failed, but continuing..."
fi

# Check PostgreSQL
if docker exec postgres pg_isready -U postgres > /dev/null 2>&1; then
    print_success "PostgreSQL is running"
else
    print_warning "PostgreSQL health check failed, but continuing..."
fi

# Display service URLs
echo ""
print_success "🎉 Monitoring Stack Deployment Complete!"
echo ""
echo "📊 Service URLs:"
echo "  • Halo Indexer:     http://localhost:3000"
echo "  • Prometheus:       http://localhost:9090"
echo "  • Grafana:          http://localhost:3001"
echo "  • Node Exporter:    http://localhost:9100"
echo ""
echo "🔐 Grafana Login:"
echo "  • Username: admin"
echo "  • Password: admin123"
echo ""
echo "📈 Monitoring Features:"
echo "  • Real-time system metrics"
echo "  • API performance monitoring"
echo "  • Business metrics tracking"
echo "  • Trinity system monitoring"
echo "  • Database performance monitoring"
echo "  • Custom alerts and notifications"
echo ""
echo "🛠️ Useful Commands:"
echo "  • View logs: docker-compose -f docker-compose-monitoring.yml logs -f"
echo "  • Stop services: docker-compose -f docker-compose-monitoring.yml down"
echo "  • Restart services: docker-compose -f docker-compose-monitoring.yml restart"
echo "  • Update services: docker-compose -f docker-compose-monitoring.yml up -d --build"
echo ""

# Test metrics endpoint
print_status "Testing metrics endpoint..."
if curl -f http://localhost:3000/api/metrics > /dev/null 2>&1; then
    print_success "Metrics endpoint is working"
    echo "  Metrics URL: http://localhost:3000/api/metrics"
else
    print_warning "Metrics endpoint test failed"
fi

# Test Prometheus targets
print_status "Testing Prometheus targets..."
sleep 10
if curl -f "http://localhost:9090/api/v1/targets" > /dev/null 2>&1; then
    print_success "Prometheus targets are configured"
    echo "  Targets URL: http://localhost:9090/targets"
else
    print_warning "Prometheus targets test failed"
fi

echo ""
print_success "🚀 Halo Indexer Monitoring Stack is ready!"
echo ""
echo "Next steps:"
echo "1. Open Grafana at http://localhost:3001"
echo "2. Login with admin/admin123"
echo "3. Add Prometheus as a data source (http://prometheus:9090)"
echo "4. Import the Halo Indexer dashboard"
echo "5. Configure alerts and notifications"
echo "" 