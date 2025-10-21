#!/bin/bash
set -e

# Health check script for Prompt Testing Lab deployments
# Comprehensive health validation for deployed applications

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
URL=""
TIMEOUT=30
RETRIES=3
WAIT_BETWEEN_RETRIES=5
VERBOSE=false

# Health check endpoints
HEALTH_ENDPOINTS=(
  "/api/health"
  "/api/health/db"
  "/api/health/redis"
)

# Performance thresholds (in milliseconds)
MAX_RESPONSE_TIME=2000
MAX_DB_RESPONSE_TIME=1000

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO] $1${NC}"
}

log_success() {
  echo -e "${GREEN}[SUCCESS] $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}[WARNING] $1${NC}"
}

log_error() {
  echo -e "${RED}[ERROR] $1${NC}"
}

# Help function
show_help() {
  cat << EOF
Health Check Script for Prompt Testing Lab

Usage: $0 --url=URL [OPTIONS]

REQUIRED:
  --url=URL                 Target URL to health check

OPTIONS:
  --timeout=SECONDS         Request timeout in seconds [default: 30]
  --retries=COUNT          Number of retry attempts [default: 3]
  --wait=SECONDS           Wait time between retries [default: 5]
  --verbose                Enable verbose output
  -h, --help               Show this help message

EXAMPLES:
  $0 --url=https://myapp.vercel.app
  $0 --url=https://staging.myapp.com --timeout=60 --retries=5
  $0 --url=http://localhost:8002 --verbose

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --url=*)
      URL="${1#*=}"
      shift
      ;;
    --timeout=*)
      TIMEOUT="${1#*=}"
      shift
      ;;
    --retries=*)
      RETRIES="${1#*=}"
      shift
      ;;
    --wait=*)
      WAIT_BETWEEN_RETRIES="${1#*=}"
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Validate required parameters
if [[ -z "$URL" ]]; then
  log_error "URL is required. Use --url=URL"
  show_help
  exit 1
fi

# Remove trailing slash from URL
URL="${URL%/}"

log_info "Starting health check for: $URL"
log_info "Timeout: ${TIMEOUT}s, Retries: $RETRIES, Wait: ${WAIT_BETWEEN_RETRIES}s"

# Function to make HTTP request with timing
make_request() {
  local endpoint="$1"
  local full_url="${URL}${endpoint}"
  
  if [[ "$VERBOSE" == true ]]; then
    log_info "Checking: $full_url"
  fi
  
  # Use curl to make request and capture timing information
  local response
  response=$(curl -s -w "%{http_code},%{time_total},%{time_connect},%{time_starttransfer}" \
    --max-time "$TIMEOUT" \
    --connect-timeout 10 \
    --retry 0 \
    "$full_url" 2>/dev/null) || return 1
  
  # Parse response
  local body="${response%,*,*,*}"
  local metrics="${response##*$body}"
  local http_code="${metrics%%,*}"
  local time_total="${metrics#*,}"
  time_total="${time_total%%,*}"
  
  # Convert time to milliseconds
  local time_ms=$(echo "$time_total * 1000" | bc -l | cut -d. -f1)
  
  echo "$http_code,$time_ms,$body"
}

# Function to check a single endpoint
check_endpoint() {
  local endpoint="$1"
  local attempt=1
  
  while [[ $attempt -le $RETRIES ]]; do
    if [[ $attempt -gt 1 ]]; then
      log_info "Retry attempt $attempt for $endpoint"
      sleep "$WAIT_BETWEEN_RETRIES"
    fi
    
    local result
    if result=$(make_request "$endpoint"); then
      local http_code="${result%%,*}"
      local time_ms="${result#*,}"
      time_ms="${time_ms%%,*}"
      local body="${result##*,*,}"
      
      # Check HTTP status code
      if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        # Check response time
        if [[ "$time_ms" -gt "$MAX_RESPONSE_TIME" ]]; then
          log_warning "Slow response for $endpoint: ${time_ms}ms (threshold: ${MAX_RESPONSE_TIME}ms)"
        elif [[ "$VERBOSE" == true ]]; then
          log_info "Response time for $endpoint: ${time_ms}ms"
        fi
        
        # Parse health check response if it's JSON
        if [[ "$endpoint" == "/api/health"* && "$body" =~ ^\{.*\}$ ]]; then
          local status
          status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
          
          if [[ "$status" == "healthy" ]]; then
            log_success "$endpoint: HTTP $http_code, ${time_ms}ms, Status: $status"
            return 0
          else
            log_error "$endpoint: HTTP $http_code, Status: $status"
            return 1
          fi
        else
          log_success "$endpoint: HTTP $http_code, ${time_ms}ms"
          return 0
        fi
      else
        log_error "$endpoint: HTTP $http_code"
        if [[ "$VERBOSE" == true && -n "$body" ]]; then
          log_error "Response body: $body"
        fi
      fi
    else
      log_error "$endpoint: Request failed (timeout or connection error)"
    fi
    
    ((attempt++))
  done
  
  return 1
}

# Function to check basic connectivity
check_basic_connectivity() {
  log_info "Checking basic connectivity..."
  
  if check_endpoint "/"; then
    log_success "Basic connectivity test passed"
    return 0
  else
    log_error "Basic connectivity test failed"
    return 1
  fi
}

# Function to check all health endpoints
check_health_endpoints() {
  log_info "Checking health endpoints..."
  
  local failed_endpoints=()
  
  for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
    if ! check_endpoint "$endpoint"; then
      failed_endpoints+=("$endpoint")
    fi
  done
  
  if [[ ${#failed_endpoints[@]} -eq 0 ]]; then
    log_success "All health endpoints are healthy"
    return 0
  else
    log_error "Failed health endpoints: ${failed_endpoints[*]}"
    return 1
  fi
}

# Function to check specific API endpoints
check_api_endpoints() {
  log_info "Checking critical API endpoints..."
  
  local api_endpoints=(
    "/api/auth/status"
    "/api/projects"
    "/api/prompts"
  )
  
  local failed_apis=()
  
  for endpoint in "${api_endpoints[@]}"; do
    # These might return 401 (unauthorized) which is acceptable
    local result
    if result=$(make_request "$endpoint"); then
      local http_code="${result%%,*}"
      
      # Accept 200, 401 (unauthorized), 403 (forbidden) as healthy
      if [[ "$http_code" -eq 200 || "$http_code" -eq 401 || "$http_code" -eq 403 ]]; then
        log_success "$endpoint: HTTP $http_code (API responding)"
      else
        log_warning "$endpoint: HTTP $http_code (unexpected status)"
        failed_apis+=("$endpoint")
      fi
    else
      log_error "$endpoint: Request failed"
      failed_apis+=("$endpoint")
    fi
  done
  
  if [[ ${#failed_apis[@]} -eq 0 ]]; then
    log_success "All API endpoints are responding"
    return 0
  else
    log_warning "Some API endpoints failed: ${failed_apis[*]}"
    # Don't fail the overall health check for API endpoints
    return 0
  fi
}

# Function to check performance
check_performance() {
  log_info "Running performance checks..."
  
  local start_time=$(date +%s%3N)
  local result
  
  if result=$(make_request "/api/health"); then
    local end_time=$(date +%s%3N)
    local total_time=$((end_time - start_time))
    local response_time="${result#*,}"
    response_time="${response_time%%,*}"
    
    log_info "Health endpoint response time: ${response_time}ms"
    
    if [[ "$response_time" -gt "$MAX_RESPONSE_TIME" ]]; then
      log_warning "Response time exceeds threshold (${MAX_RESPONSE_TIME}ms)"
      return 1
    else
      log_success "Performance check passed"
      return 0
    fi
  else
    log_error "Performance check failed - health endpoint unreachable"
    return 1
  fi
}

# Function to check SSL certificate (for HTTPS URLs)
check_ssl_certificate() {
  if [[ "$URL" =~ ^https:// ]]; then
    log_info "Checking SSL certificate..."
    
    local domain="${URL#https://}"
    domain="${domain%%/*}"
    
    # Check certificate expiration
    local cert_info
    if cert_info=$(echo | timeout 10 openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null); then
      local not_after
      not_after=$(echo "$cert_info" | grep "notAfter=" | cut -d= -f2)
      
      if [[ -n "$not_after" ]]; then
        local expiry_date
        expiry_date=$(date -d "$not_after" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$not_after" +%s 2>/dev/null)
        local current_date=$(date +%s)
        local days_until_expiry=$(( (expiry_date - current_date) / 86400 ))
        
        if [[ $days_until_expiry -lt 30 ]]; then
          log_warning "SSL certificate expires in $days_until_expiry days"
        else
          log_success "SSL certificate valid (expires in $days_until_expiry days)"
        fi
        
        return 0
      fi
    fi
    
    log_warning "Could not verify SSL certificate"
    return 1
  else
    log_info "Skipping SSL check (not HTTPS)"
    return 0
  fi
}

# Function to generate health report
generate_report() {
  local exit_code="$1"
  local end_time=$(date)
  
  echo ""
  echo "=============================================="
  echo "        HEALTH CHECK REPORT"
  echo "=============================================="
  echo "URL: $URL"
  echo "Timestamp: $end_time"
  echo "Timeout: ${TIMEOUT}s"
  echo "Retries: $RETRIES"
  echo ""
  
  if [[ $exit_code -eq 0 ]]; then
    echo -e "${GREEN}Overall Status: ✅ HEALTHY${NC}"
  else
    echo -e "${RED}Overall Status: ❌ UNHEALTHY${NC}"
  fi
  
  echo "=============================================="
}

# Main health check function
main() {
  local overall_status=0
  local start_time=$(date)
  
  log_info "Health check started at: $start_time"
  
  # Run all health checks
  check_basic_connectivity || overall_status=1
  check_health_endpoints || overall_status=1
  check_api_endpoints || true  # Don't fail overall check
  check_performance || true    # Don't fail overall check
  check_ssl_certificate || true  # Don't fail overall check
  
  # Generate report
  generate_report "$overall_status"
  
  if [[ $overall_status -eq 0 ]]; then
    log_success "All critical health checks passed"
  else
    log_error "One or more critical health checks failed"
  fi
  
  exit $overall_status
}

# Check for required dependencies
if ! command -v curl &> /dev/null; then
  log_error "curl is required but not installed"
  exit 1
fi

if ! command -v bc &> /dev/null; then
  log_warning "bc is not installed, response time calculations may be inaccurate"
fi

# Run main function
main "$@"