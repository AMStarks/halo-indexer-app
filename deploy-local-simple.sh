#!/bin/bash

# Halo Indexer Simple Local Deployment
# No Docker required - uses local Node.js and services

set -e

echo "🚀 Starting Halo Indexer Simple Local Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="halo-indexer"
PORT=3000
NODE_ID="indexer-1"

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Project: $PROJECT_NAME"
echo "  Port: $PORT"
echo "  Node ID: $NODE_ID"

# Step 1: Check prerequisites
echo -e "${YELLOW}🔧 Step 1: Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js found: $NODE_VERSION${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm found${NC}"

# Step 2: Install dependencies
echo -e "${YELLOW}🔧 Step 2: Installing dependencies...${NC}"
npm install

# Step 3: Create logs directory
echo -e "${YELLOW}🔧 Step 3: Creating logs directory...${NC}"
mkdir -p logs

# Step 4: Set environment variables
echo -e "${YELLOW}🔧 Step 4: Setting environment variables...${NC}"
export NODE_ENV=production
export PORT=$PORT
export NODE_ID=$NODE_ID
export REDIS_URL=redis://localhost:6379
export POSTGRES_URL=postgresql://postgres:password@localhost:5432/halo_indexer
export TLS_API_ENDPOINT=https://api.telestai.io
export LEADER_ELECTION_ENABLED=true

echo -e "${GREEN}✅ Environment variables set${NC}"

# Step 5: Check if Redis is available
echo -e "${YELLOW}🔧 Step 5: Checking Redis availability...${NC}"
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✅ Redis is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis not running, starting in mock mode${NC}"
        export REDIS_MOCK_MODE=true
    fi
else
    echo -e "${YELLOW}⚠️  Redis not installed, using mock mode${NC}"
    export REDIS_MOCK_MODE=true
fi

# Step 6: Start the application
echo -e "${YELLOW}🔧 Step 6: Starting Halo Indexer...${NC}"

# Kill any existing process
pkill -f "node src/index.js" 2>/dev/null || echo "No existing process found"

# Start the application in background
nohup node src/index.js > logs/app.log 2>&1 &
APP_PID=$!

echo -e "${GREEN}✅ Application started with PID: $APP_PID${NC}"

# Step 7: Wait for application to start
echo -e "${YELLOW}🔧 Step 7: Waiting for application to start...${NC}"
sleep 5

# Step 8: Health check
echo -e "${YELLOW}🔧 Step 8: Running health checks...${NC}"

# Check if process is running
if ps -p $APP_PID > /dev/null; then
    echo -e "${GREEN}✅ Application process is running${NC}"
else
    echo -e "${RED}❌ Application failed to start${NC}"
    echo "Logs:"
    tail -n 20 logs/app.log
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
    echo "Logs:"
    tail -n 10 logs/app.log
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
echo "  Process ID: $APP_PID"
echo "  API Endpoint: http://localhost:$PORT"
echo "  Health Check: http://localhost:$PORT/api/health"
echo "  Logs: logs/app.log"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "  View logs: tail -f logs/app.log"
echo "  Stop service: kill $APP_PID"
echo "  Restart service: ./deploy-local-simple.sh"
echo "  Check status: ps aux | grep 'node src/index.js'"
echo ""
echo -e "${BLUE}🧪 Test Commands:${NC}"
echo "  Health check: curl http://localhost:$PORT/api/health"
echo "  Create post: curl -X POST http://localhost:$PORT/api/posts -H 'Content-Type: application/json' -d '{\"content\":\"Test post\",\"userAddress\":\"0x123\",\"signature\":\"test\",\"timestamp\":1754392887,\"postType\":\"free\"}'"
echo "  Get feed: curl http://localhost:$PORT/api/posts"
echo ""
echo -e "${GREEN}🚀 Ready for FluxDrive deployment!${NC}"

# Save PID to file for easy management
echo $APP_PID > .halo-pid
echo -e "${BLUE}💡 PID saved to .halo-pid for easy management${NC}" 