#!/usr/bin/env bash
set -euo pipefail

# Integration test runner for Autonoe
# Runs E2E tests defined in SPEC.md Section 9

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

# Setup: Clean workspace and copy fixture
setup() {
  local fixture="$1"
  echo "  Setting up fixture: $fixture"
  find ./tmp -mindepth 1 ! -name '.gitkeep' -delete
  cp -r "tests/integration/fixtures/$fixture"/* ./tmp/
}

# Run autonoe in Docker
run_autonoe() {
  docker compose run --rm cli autonoe run "$@"
}

# Record test result
pass() {
  echo -e "  ${GREEN}PASS${NC}"
  ((PASSED++)) || true
}

fail() {
  local reason="${1:-}"
  if [[ -n "$reason" ]]; then
    echo -e "  ${RED}FAIL${NC}: $reason"
  else
    echo -e "  ${RED}FAIL${NC}"
  fi
  ((FAILED++)) || true
}

# IT-001: Basic Workflow
test_it001() {
  echo ""
  echo "IT-001: Basic Workflow"
  setup hello-world

  if run_autonoe -n 3; then
    if test -f ./tmp/hello.txt && grep -q "Hello, World!" ./tmp/hello.txt; then
      pass
    else
      fail "hello.txt not found or content mismatch"
    fi
  else
    fail "autonoe execution failed"
  fi
}

# IT-002: Technology Stack Recognition
test_it002() {
  echo ""
  echo "IT-002: Technology Stack Recognition"
  setup nodejs

  if run_autonoe -n 3; then
    if test -f ./tmp/hello.js; then
      # Execute the JS file and check output
      if docker compose run --rm cli node /workspace/hello.js 2>&1 | grep -q "Hello, World!"; then
        pass
      else
        fail "hello.js output mismatch"
      fi
    else
      fail "hello.js not found"
    fi
  else
    fail "autonoe execution failed"
  fi
}

# IT-003: Instruction Override
test_it003() {
  echo ""
  echo "IT-003: Instruction Override"
  setup custom-instruction

  # Capture output with debug flag
  local output
  output=$(docker compose run --rm cli autonoe run -d -n 2 2>&1) || true

  if echo "$output" | grep -q "=== CUSTOM MARKER ==="; then
    pass
  else
    fail "custom marker not found in output"
  fi
}

# IT-004: Deliverable Status Persistence
test_it004() {
  echo ""
  echo "IT-004: Deliverable Status Persistence"
  setup hello-world

  if run_autonoe -n 3; then
    if test -f ./tmp/.autonoe/status.json; then
      # Check if any deliverable has passed=true
      if jq -e '.deliverables[] | select(.passed == true)' ./tmp/.autonoe/status.json > /dev/null 2>&1; then
        pass
      else
        fail "no deliverable with passed=true"
      fi
    else
      fail ".autonoe/status.json not found"
    fi
  else
    fail "autonoe execution failed"
  fi
}

# IT-005: Session Iteration Limit
test_it005() {
  echo ""
  echo "IT-005: Session Iteration Limit"
  setup hello-world

  # Run with max 1 iteration - should exit cleanly
  local exit_code=0
  run_autonoe -n 1 || exit_code=$?

  # Should exit with 0 or 1 (partial completion)
  if [[ $exit_code -eq 0 ]] || [[ $exit_code -eq 1 ]]; then
    pass
  else
    fail "unexpected exit code: $exit_code"
  fi
}

# Main execution
main() {
  echo "================================"
  echo "Autonoe Integration Tests"
  echo "================================"

  # Check prerequisites
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker is required${NC}"
    exit 1
  fi

  if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq is not installed, some tests may fail${NC}"
  fi

  # Build Docker image first
  echo ""
  echo "Building Docker image..."
  docker compose build cli

  # Run all tests
  test_it001
  test_it002
  test_it003
  test_it004
  test_it005

  # Summary
  echo ""
  echo "================================"
  echo "Results: ${PASSED} passed, ${FAILED} failed"
  echo "================================"

  exit $FAILED
}

main "$@"
