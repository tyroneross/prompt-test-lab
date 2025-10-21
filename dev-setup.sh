#!/bin/bash

# =============================================================================
# Prompt Testing Lab - Development Environment Setup Script
# =============================================================================

set -e  # Exit on any error

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$PROJECT_ROOT/packages/api"
WEB_DIR="$PROJECT_ROOT/packages/web"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_section() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}🚀 $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i ":$1" >/dev/null 2>&1
}

# Function to kill processes on a port
kill_port() {
    local port=$1
    local pids=$(lsof -ti ":$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
        log_warning "Killing existing processes on port $port"
        kill -9 $pids 2>/dev/null || true
        sleep 2
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            log_success "$service_name is ready!"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts - waiting for $service_name..."
        sleep 2
        ((attempt++))
    done
    
    log_error "$service_name failed to start after $max_attempts attempts"
    return 1
}

# Cleanup function
cleanup() {
    log_section "CLEANUP"
    
    # Kill background processes if they exist
    if [[ -n "${API_PID:-}" ]]; then
        log_info "Stopping API server (PID: $API_PID)"
        kill $API_PID 2>/dev/null || true
    fi
    
    if [[ -n "${WEB_PID:-}" ]]; then
        log_info "Stopping web server (PID: $WEB_PID)"
        kill $WEB_PID 2>/dev/null || true
    fi
    
    # Clean up any remaining processes on our ports
    kill_port 4001  # API port
    kill_port 3000  # Web port
    
    log_success "Cleanup completed"
}

# Set up signal handlers for cleanup
trap cleanup EXIT INT TERM

# Main setup function
main() {
    log_section "PROMPT TESTING LAB - DEV ENVIRONMENT SETUP"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # 1. Prerequisites check
    log_section "CHECKING PREREQUISITES"
    
    if ! command_exists node; then
        log_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    if ! command_exists pnpm; then
        log_error "pnpm is not installed. Please install pnpm and try again."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
    
    # 2. Environment setup
    log_section "ENVIRONMENT SETUP"
    
    if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
        log_info "Creating .env file from template..."
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        
        # Update .env for development
        sed -i.bak 's|DATABASE_URL=.*|DATABASE_URL=file:./dev.db|g' "$PROJECT_ROOT/.env"
        sed -i.bak 's|PORT=.*|PORT=4001|g' "$PROJECT_ROOT/.env"
        sed -i.bak 's|NODE_ENV=.*|NODE_ENV=development|g' "$PROJECT_ROOT/.env"
        
        log_success "Created .env file with development defaults"
    else
        log_success ".env file already exists"
    fi
    
    # 3. Dependencies installation
    log_section "INSTALLING DEPENDENCIES"
    
    log_info "Installing root dependencies..."
    pnpm install
    
    log_success "Dependencies installed successfully"
    
    # 4. Database setup
    log_section "DATABASE SETUP"
    
    cd "$API_DIR"
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    pnpm prisma generate
    
    # Check if database exists and has tables
    if [[ ! -f "$API_DIR/dev.db" ]] || ! pnpm prisma db execute --stdin <<< ".tables" | grep -q "users"; then
        log_info "Setting up development database..."
        
        # Reset and migrate database
        pnpm prisma migrate reset --force --skip-seed
        pnpm prisma migrate deploy
        
        # Seed database
        log_info "Seeding database with initial data..."
        pnpm run db:seed
        
        log_success "Database setup completed"
    else
        log_success "Database already exists and is migrated"
    fi
    
    cd "$PROJECT_ROOT"
    
    # 5. Build packages
    log_section "BUILDING PACKAGES"
    
    log_info "Building shared package..."
    pnpm run build --filter=@prompt-lab/shared
    
    log_success "Packages built successfully"
    
    # 6. Start services
    log_section "STARTING DEVELOPMENT SERVERS"
    
    # Clean up any existing processes
    kill_port 4001
    kill_port 3000
    
    log_info "Starting API server..."
    cd "$API_DIR"
    PORT=4001 pnpm run dev > "$PROJECT_ROOT/api-dev.log" 2>&1 &
    API_PID=$!
    cd "$PROJECT_ROOT"
    
    # Wait for API to be ready
    if ! wait_for_service "http://localhost:4001/health" "API server"; then
        log_error "Failed to start API server. Check api-dev.log for details."
        exit 1
    fi
    
    log_info "Starting web server..."
    cd "$WEB_DIR"
    pnpm run dev > "$PROJECT_ROOT/web-dev.log" 2>&1 &
    WEB_PID=$!
    cd "$PROJECT_ROOT"
    
    # Wait for web server to be ready
    if ! wait_for_service "http://localhost:3000" "Web server"; then
        log_error "Failed to start web server. Check web-dev.log for details."
        exit 1
    fi
    
    # 7. Health checks
    log_section "RUNNING HEALTH CHECKS"
    
    log_info "Testing API health endpoint..."
    if curl -s "http://localhost:4001/health" | jq -e '.status == "healthy"' >/dev/null; then
        log_success "API health check passed"
    else
        log_warning "API health check returned non-healthy status"
    fi
    
    log_info "Testing detailed health endpoint..."
    curl -s "http://localhost:4001/health/detailed" | jq . > health-check.json
    log_info "Detailed health check saved to health-check.json"
    
    # 8. Success summary
    log_section "DEVELOPMENT ENVIRONMENT READY"
    
    echo -e "${GREEN}🎉 Development environment is running successfully!${NC}\n"
    echo -e "${BLUE}📱 Web Application:${NC}     http://localhost:3000"
    echo -e "${BLUE}🔧 API Server:${NC}          http://localhost:4001"
    echo -e "${BLUE}📊 Health Check:${NC}        http://localhost:4001/health"
    echo -e "${BLUE}📋 API Documentation:${NC}   http://localhost:4001/docs (if available)"
    echo ""
    echo -e "${YELLOW}📝 Log Files:${NC}"
    echo -e "   • API logs:    $PROJECT_ROOT/api-dev.log"
    echo -e "   • Web logs:    $PROJECT_ROOT/web-dev.log"
    echo ""
    echo -e "${YELLOW}🛠️  Useful Commands:${NC}"
    echo -e "   • View API logs:     tail -f api-dev.log"
    echo -e "   • View Web logs:     tail -f web-dev.log"
    echo -e "   • Restart API:       pnpm run dev:api"
    echo -e "   • Restart Web:       pnpm run dev:web"
    echo -e "   • Run tests:         pnpm test"
    echo ""
    echo -e "${GREEN}Press Ctrl+C to stop all servers and exit${NC}"
    
    # Keep script running to maintain servers
    while true; do
        # Check if processes are still running
        if ! kill -0 $API_PID 2>/dev/null; then
            log_error "API server stopped unexpectedly"
            break
        fi
        
        if ! kill -0 $WEB_PID 2>/dev/null; then
            log_error "Web server stopped unexpectedly"
            break
        fi
        
        sleep 5
    done
}

# Run main function
main "$@"