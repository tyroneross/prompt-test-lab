#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}🚀 Starting Prompt Testing Lab E2E Test Runner${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to check if a server is running
check_server() {
    local port=$1
    local name=$2
    nc -z localhost $port 2>/dev/null
    return $?
}

# Function to start servers
start_servers() {
    echo -e "${YELLOW}Starting servers...${NC}"

    # Start API server
    if ! check_server 4001 "API"; then
        echo -e "  Starting API server on port 4001..."
        cd ../api && npm run dev > /tmp/api-server.log 2>&1 &
        API_PID=$!
        sleep 3
    else
        echo -e "  ${GREEN}✅${NC} API server already running on port 4001"
    fi

    # Start Web server
    if ! check_server 4173 "Web"; then
        echo -e "  Starting Web server on port 4173..."
        cd ../web && npm run preview > /tmp/web-server.log 2>&1 &
        WEB_PID=$!
        sleep 3
    else
        echo -e "  ${GREEN}✅${NC} Web server already running on port 4173"
    fi

    # Wait for servers to be ready
    echo -e "${YELLOW}Waiting for servers to be ready...${NC}"
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if check_server 4001 "API" && check_server 4173 "Web"; then
            echo -e "${GREEN}✅ Both servers are ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done

    echo -e "\n${RED}❌ Failed to start servers${NC}"
    return 1
}

# Check if servers are running
echo -e "${BOLD}Checking server status...${NC}"

API_RUNNING=false
WEB_RUNNING=false

if check_server 4001 "API"; then
    echo -e "  ${GREEN}✅${NC} API server is running on port 4001"
    API_RUNNING=true
else
    echo -e "  ${YELLOW}⚠${NC}  API server is not running on port 4001"
fi

if check_server 4173 "Web"; then
    echo -e "  ${GREEN}✅${NC} Web server is running on port 4173"
    WEB_RUNNING=true
else
    echo -e "  ${YELLOW}⚠${NC}  Web server is not running on port 4173"
fi

echo ""

# Start servers if needed
if [ "$API_RUNNING" = false ] || [ "$WEB_RUNNING" = false ]; then
    start_servers
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to start servers. Please start them manually:${NC}"
        echo -e "  API: cd packages/api && npm run dev"
        echo -e "  Web: cd packages/web && npm run preview"
        exit 1
    fi
    echo ""
fi

# Run the comprehensive E2E tests
echo -e "${BOLD}Running E2E tests...${NC}"
echo ""

# Make test script executable if not already
chmod +x test-e2e-comprehensive.sh

# Run the test script
./test-e2e-comprehensive.sh

# Capture exit code
TEST_EXIT_CODE=$?

# Cleanup: Kill servers if we started them
if [ ! -z "$API_PID" ]; then
    echo ""
    echo -e "${YELLOW}Stopping API server (PID: $API_PID)...${NC}"
    kill $API_PID 2>/dev/null
fi

if [ ! -z "$WEB_PID" ]; then
    echo -e "${YELLOW}Stopping Web server (PID: $WEB_PID)...${NC}"
    kill $WEB_PID 2>/dev/null
fi

# Exit with test exit code
exit $TEST_EXIT_CODE