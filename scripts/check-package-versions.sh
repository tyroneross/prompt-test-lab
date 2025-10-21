#!/bin/bash
set -e

# Check package.json version synchronization across monorepo
# Ensures all packages use consistent versions for shared dependencies

echo "🔍 Checking package.json version synchronization..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERRORS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Find all package.json files
PACKAGE_FILES=(
  "$ROOT_DIR/package.json"
  "$ROOT_DIR/packages/api/package.json"
  "$ROOT_DIR/packages/web/package.json"
  "$ROOT_DIR/packages/shared/package.json"
  "$ROOT_DIR/packages/sdk/package.json"
)

# Dependencies that should be synchronized
SYNC_DEPS=(
  "typescript"
  "@types/node"
  "eslint"
  "prettier"
  "jest"
  "@playwright/test"
)

declare -A dep_versions

# Function to extract version from package.json
get_version() {
  local file="$1"
  local dep="$2"
  
  if [[ -f "$file" ]]; then
    # Check devDependencies first, then dependencies
    version=$(jq -r ".devDependencies.\"$dep\" // .dependencies.\"$dep\" // empty" "$file" 2>/dev/null)
    echo "$version"
  fi
}

# Check each synchronized dependency
for dep in "${SYNC_DEPS[@]}"; do
  echo "Checking $dep..."
  
  expected_version=""
  
  # Get version from root package.json as the source of truth
  root_version=$(get_version "$ROOT_DIR/package.json" "$dep")
  if [[ -n "$root_version" ]]; then
    expected_version="$root_version"
    echo "  Root version: $expected_version"
  fi
  
  # Check all other package.json files
  for package_file in "${PACKAGE_FILES[@]}"; do
    if [[ "$package_file" == "$ROOT_DIR/package.json" ]]; then
      continue
    fi
    
    if [[ -f "$package_file" ]]; then
      current_version=$(get_version "$package_file" "$dep")
      
      if [[ -n "$current_version" && -n "$expected_version" ]]; then
        if [[ "$current_version" != "$expected_version" ]]; then
          echo -e "${RED}❌ Version mismatch in $(basename "$(dirname "$package_file")")${NC}"
          echo -e "   Expected: ${GREEN}$expected_version${NC}"
          echo -e "   Found: ${RED}$current_version${NC}"
          ERRORS=$((ERRORS + 1))
        else
          echo -e "${GREEN}✅ $(basename "$(dirname "$package_file")") - $current_version${NC}"
        fi
      fi
    fi
  done
  
  echo ""
done

# Check for common dependency version conflicts
echo "🔍 Checking for common dependency conflicts..."

# React versions should match
check_react_versions() {
  local react_version=""
  local react_dom_version=""
  
  for package_file in "${PACKAGE_FILES[@]}"; do
    if [[ -f "$package_file" ]]; then
      local file_react=$(get_version "$package_file" "react")
      local file_react_dom=$(get_version "$package_file" "react-dom")
      
      if [[ -n "$file_react" ]]; then
        if [[ -z "$react_version" ]]; then
          react_version="$file_react"
        elif [[ "$react_version" != "$file_react" ]]; then
          echo -e "${RED}❌ React version mismatch in $package_file${NC}"
          ERRORS=$((ERRORS + 1))
        fi
      fi
      
      if [[ -n "$file_react_dom" ]]; then
        if [[ -z "$react_dom_version" ]]; then
          react_dom_version="$file_react_dom"
        elif [[ "$react_dom_version" != "$file_react_dom" ]]; then
          echo -e "${RED}❌ React DOM version mismatch in $package_file${NC}"
          ERRORS=$((ERRORS + 1))
        fi
      fi
    fi
  done
  
  if [[ -n "$react_version" && -n "$react_dom_version" && "$react_version" != "$react_dom_version" ]]; then
    echo -e "${RED}❌ React and React DOM versions don't match${NC}"
    echo -e "   React: $react_version"
    echo -e "   React DOM: $react_dom_version"
    ERRORS=$((ERRORS + 1))
  fi
}

check_react_versions

# Check Node.js version requirements
echo "🔍 Checking Node.js version requirements..."

for package_file in "${PACKAGE_FILES[@]}"; do
  if [[ -f "$package_file" ]]; then
    node_version=$(jq -r '.engines.node // empty' "$package_file" 2>/dev/null)
    if [[ -n "$node_version" ]]; then
      echo "  $(basename "$(dirname "$package_file")"): $node_version"
    fi
  fi
done

# Summary
echo ""
if [[ $ERRORS -eq 0 ]]; then
  echo -e "${GREEN}✅ All package versions are synchronized!${NC}"
  exit 0
else
  echo -e "${RED}❌ Found $ERRORS version mismatches${NC}"
  echo ""
  echo "To fix version mismatches:"
  echo "1. Update package.json files to use consistent versions"
  echo "2. Run 'npm install' in each package directory"
  echo "3. Consider using 'npm run update-deps' to sync versions automatically"
  exit 1
fi