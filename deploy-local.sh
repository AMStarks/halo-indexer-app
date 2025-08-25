#!/bin/bash

# Halo Indexer Local Deployment Script
# Replicates FluxDrive deployment patterns

set -e

echo "🚀 Starting Halo Indexer Local Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="halo-indexer"
DOCKER_IMAGE="halo-indexer:latest"
CONTAINER_NAME="halo-indexer-local"
NETWORK_NAME="halo-network"
REDIS_CONTAINER="halo-redis"
POSTGRES_CONTAINER="halo-postgres"

# Environment variables
export NODE_ENV=production
export PORT=3000
export NODE_ID=indexer-1
export REDIS_URL=redis://halo-redis:6379
export POSTGRES_URL=postgresql://postgres:password@halo-postgres:5432/halo_indexer
export TLS_API_ENDPOINT=https://api.telestai.io
export LEADER_ELECTION_ENABLED=true

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Project: $PROJECT_NAME"
echo "  Image: $DOCKER_IMAGE"
echo "  Container: $CONTAINER_NAME"
echo "  Network: $NETWORK_NAME"
echo "  Port: $PORT"

# Step 1: Create Docker network
echo -e "${YELLOW}🔧 Step 1: Creating Docker network...${NC}"
docker network create $NETWORK_NAME 2>/dev/null || echo "Network already exists"

# Step 2: Start Redis container
echo -e "${YELLOW}🔧 Step 2: Starting Redis container...${NC}"
docker run -d \
  --name $REDIS_CONTAINER \
  --network $NETWORK_NAME \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes

# Step 3: Start PostgreSQL container
echo -e "${YELLOW}🔧 Step 3: Starting PostgreSQL container...${NC}"
docker run -d \
  --name $POSTGRES_CONTAINER \
  --network $NETWORK_NAME \
  -p 5432:5439 \
  -e POSTGRES_DB=halo_indexer \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  postgres:15-alpine

# Step 4: Build Docker image
echo -e "${YELLOW}🔧 Step 4: Building Halo Indexer Docker image...${NC}"
docker build -t $DOCKER_IMAGE .

# Step 5: Stop existing container if running
echo -e "${YELLOW}🔧 Step 5: Stopping existing container...${NC}"
docker stop $CONTAINER_NAME 2>/dev/null || echo "Container not running"
docker rm $CONTAINER_NAME 2>/dev/null || echo "Container not found"

# Step 6: Start Halo Indexer container
echo -e "${YELLOW}🔧 Step 6: Starting Halo Indexer container...${NC}"
docker run -d \
  --name $CONTAINER_NAME \
  --network $NETWORK_NAME \
  -p $PORT:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e NODE_ID=indexer-1 \
  -e REDIS_URL=redis://halo-redis:6379 \
  -e POSTGRES_URL=postgresql://postgres:password@halo-postgres:5432/halo_indexer \
  -e TLS_API_ENDPOINT=https://api.telestai.io \
  -e LEADER_ELECTION_ENABLED=true \
  -e BUNDLE_ID=com.telestai.LASKO \
  -e ENFORCE_POST_SIGNATURE=true \
  -e POST_MAX_SKEW_SECONDS=120 \
  -e ALLOW_GLOBAL_FEED=true \
  --restart unless-stopped \
  $DOCKER_IMAGE

# Step 7: Wait for services to be ready
echo -e "${YELLOW}🔧 Step 7: Waiting for services to be ready...${NC}"
sleep 10

# Step 8: Health check
echo -e "${YELLOW}🔧 Step 8: Running health checks...${NC}"

# Check if container is running
if docker ps | grep -q $CONTAINER_NAME; then
    echo -e "${GREEN}✅ Container is running${NC}"
else
    echo -e "${RED}❌ Container failed to start${NC}"
    docker logs $CONTAINER_NAME
    exit 1
fi

# Check API health
echo -e "${BLUE}🔍 Testing API health...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:$PORT/api/health || echo "FAILED")
if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    echo -e "${GREEN}✅ API health check passed${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
    echo "Response: $HEALTH_RESPONSE"
fi

# Step 9: Test post creation
echo -e "${BLUE}🔍 Testing post creation...${NC}"
TEST_POST=$(curl -s -X POST http://localhost:$PORT/api/posts \
  -H "Content-Type: application/json" \
  -d '{"content":"Test post from local deployment","userAddress":"0x1234567890abcdef","signature":"test_signature_123","timestamp":1754392887,"postType":"free"}' || echo "FAILED")

if [[ $TEST_POST == *"success"* ]]; then
    echo -e "${GREEN}✅ Post creation test passed${NC}"
    # Extract sequential code
    SEQUENTIAL_CODE=$(echo $TEST_POST | grep -o 'LAS#[0-9]*' | head -1)
    echo "  Sequential Code: $SEQUENTIAL_CODE"
else
    echo -e "${RED}❌ Post creation test failed${NC}"
    echo "Response: $TEST_POST"
fi

# Step 10: Display deployment info
echo -e "${GREEN}🎉 Halo Indexer Local Deployment Complete!${NC}"
echo ""
echo -e "${BLUE}📊 Deployment Information:${NC}"
echo "  Container: $CONTAINER_NAME"
echo "  API Endpoint: http://localhost:$PORT"
echo "  Health Check: http://localhost:$PORT/api/health"
echo "  Network: $NETWORK_NAME"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "  View logs: docker logs $CONTAINER_NAME"
echo "  Stop service: docker stop $CONTAINER_NAME"
echo "  Restart service: docker restart $CONTAINER_NAME"
echo "  Remove deployment: docker rm -f $CONTAINER_NAME $REDIS_CONTAINER $POSTGRES_CONTAINER"
echo ""
echo -e "${BLUE}🧪 Test Commands:${NC}"
echo "  Health check: curl http://localhost:$PORT/api/health"
echo "  Create post: curl -X POST http://localhost:$PORT/api/posts -H 'Content-Type: application/json' -d '{\"content\":\"Test post\",\"userAddress\":\"0x123\",\"signature\":\"test\",\"timestamp\":1754392887,\"postType\":\"free\"}'"
echo "  Get feed: curl http://localhost:$PORT/api/posts"
echo ""
echo -e "${GREEN}🚀 Ready for FluxDrive deployment!${NC}" 