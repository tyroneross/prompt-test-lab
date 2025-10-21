#!/bin/bash

# Prompt Testing Lab Development Environment Startup Script
# This script ensures a clean development environment startup

set -e

PROJECT_ROOT="/Users/trossjr/Desktop/Personal files/Git Folder/prompt-testing-lab"
API_PORT=8001
WEB_PORT=8002

echo "🚀 Starting Prompt Testing Lab Development Environment..."

# Function to kill processes on specific ports
cleanup_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null || echo "")
    if [ ! -z "$pid" ]; then
        echo "⚠️  Killing existing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Function to wait for port to be available
wait_for_port() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo "🔍 Waiting for $service_name to start on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            echo "✅ $service_name is ready on port $port"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts - waiting..."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start on port $port after $max_attempts attempts"
    return 1
}

# Cleanup existing processes
echo "🧹 Cleaning up existing processes..."
cleanup_port $API_PORT
cleanup_port $WEB_PORT

# Kill any existing tsx or vite processes
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "concurrently" 2>/dev/null || true

sleep 2

# Change to project directory
cd "$PROJECT_ROOT"

echo "📁 Working directory: $(pwd)"

# Start API server in background
echo "🔧 Starting API server..."
cd "$PROJECT_ROOT/packages/api"
npm run dev > "$PROJECT_ROOT/api.log" 2>&1 &
API_PID=$!

# Wait for API server to be ready
if wait_for_port $API_PORT "API Server"; then
    echo "✅ API Server started successfully (PID: $API_PID)"
else
    echo "❌ Failed to start API Server"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

# Start Web server in background
echo "🌐 Starting Web server..."
cd "$PROJECT_ROOT/packages/web"
npm run dev > "$PROJECT_ROOT/web.log" 2>&1 &
WEB_PID=$!

# Wait for Web server to be ready
if wait_for_port $WEB_PORT "Web Server"; then
    echo "✅ Web Server started successfully (PID: $WEB_PID)"
else
    echo "❌ Failed to start Web Server"
    kill $WEB_PID 2>/dev/null || true
    kill $API_PID 2>/dev/null || true
    exit 1
fi

# Test API connectivity
echo "🔍 Testing API connectivity..."
if curl -s -f http://localhost:$API_PORT/api/health > /dev/null; then
    echo "✅ API Server is responding correctly"
else
    echo "⚠️  API Server is running but may have issues (this might be expected for protected endpoints)"
fi

# Test Web server connectivity
echo "🔍 Testing Web server connectivity..."
if curl -s -f http://localhost:$WEB_PORT > /dev/null; then
    echo "✅ Web Server is responding correctly"
else
    echo "❌ Web Server is not responding"
    exit 1
fi

# Test API proxy through Web server
echo "🔍 Testing API proxy through Web server..."
if curl -s http://localhost:$WEB_PORT/api/health > /dev/null; then
    echo "✅ API proxy is working correctly"
else
    echo "❌ API proxy is not working"
    exit 1
fi

echo ""
echo "🎉 Development environment is ready!"
echo "   📊 API Server:  http://localhost:$API_PORT"
echo "   🌐 Web Server:  http://localhost:$WEB_PORT"
echo "   📝 API Logs:    tail -f $PROJECT_ROOT/api.log"
echo "   🖥️  Web Logs:    tail -f $PROJECT_ROOT/web.log"
echo ""
echo "🛑 To stop all services:"
echo "   kill $API_PID $WEB_PID"
echo ""
echo "✨ Happy coding!"

# Keep script running and monitor processes
trap "echo '🛑 Shutting down...'; kill $API_PID $WEB_PID 2>/dev/null || true; exit 0" INT TERM

wait