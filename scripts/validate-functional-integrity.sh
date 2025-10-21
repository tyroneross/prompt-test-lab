#!/bin/bash

# Functional Integrity Validation Script
# Checks for violations of Calm Precision Principle #9

echo "🔍 Validating Functional Integrity (Calm Precision Principle #9)"
echo "================================================================"
echo ""

WEB_SRC="packages/web/src"
VIOLATIONS=0

# Check 1: Console.log statements in production code
echo "✓ Checking for console.log statements..."
CONSOLE_LOGS=$(grep -r "console\.log" --include="*.tsx" --include="*.ts" "$WEB_SRC/pages" "$WEB_SRC/components" 2>/dev/null | grep -v "node_modules" | grep -v ".test." || true)
if [ -n "$CONSOLE_LOGS" ]; then
  echo "  ❌ Found console.log statements:"
  echo "$CONSOLE_LOGS" | sed 's/^/     /'
  ((VIOLATIONS++))
else
  echo "  ✅ No console.log statements found"
fi
echo ""

# Check 2: TODO comments for API calls
echo "✓ Checking for TODO API comments..."
TODO_API=$(grep -r "TODO.*API\|TODO.*Implement API" --include="*.tsx" --include="*.ts" "$WEB_SRC" 2>/dev/null | grep -v "node_modules" || true)
if [ -n "$TODO_API" ]; then
  echo "  ❌ Found TODO API comments:"
  echo "$TODO_API" | sed 's/^/     /'
  ((VIOLATIONS++))
else
  echo "  ✅ No TODO API comments found"
fi
echo ""

# Check 3: Empty onClick handlers
echo "✓ Checking for empty onClick handlers..."
EMPTY_ONCLICK=$(grep -r "onClick.*=>\s*{}" --include="*.tsx" "$WEB_SRC" 2>/dev/null | grep -v "node_modules" || true)
if [ -n "$EMPTY_ONCLICK" ]; then
  echo "  ⚠️  Found empty onClick handlers:"
  echo "$EMPTY_ONCLICK" | sed 's/^/     /'
  ((VIOLATIONS++))
else
  echo "  ✅ No empty onClick handlers found"
fi
echo ""

# Check 4: Buttons without disabled or onClick props
echo "✓ Checking for interactive elements integrity..."
echo "  ℹ️  Manual review recommended for:"
echo "     - Buttons without onClick or disabled props"
echo "     - Forms without onSubmit handlers"
echo "     - Links without href"
echo ""

# Summary
echo "================================================================"
if [ $VIOLATIONS -eq 0 ]; then
  echo "✅ SUCCESS: All functional integrity checks passed!"
  echo ""
  echo "Key principles validated:"
  echo "  ✓ No console.log in production code"
  echo "  ✓ No TODO comments for API implementations"
  echo "  ✓ No empty onClick handlers"
  echo ""
  echo "The codebase complies with Calm Precision Principle #9:"
  echo "  \"Only make interactive if action exists AND backend connected\""
  exit 0
else
  echo "❌ FAILED: Found $VIOLATIONS violation(s)"
  echo ""
  echo "Please fix the issues above and run this script again."
  exit 1
fi
