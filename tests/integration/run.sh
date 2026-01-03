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

# Default CLI options for all tests
DEFAULT_OPTIONS="--model opus --thinking"

# Change to project root
cd "$PROJECT_ROOT"

# Clean workspace using Docker (handles root-owned files in CI)
cleanup_workspace() {
  docker compose run --rm --entrypoint "" cli find /workspace -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} + 2>/dev/null || true
}

# Setup: Clean workspace and copy fixture
setup() {
  local fixture="$1"
  echo "  Setting up fixture: $fixture"
  cleanup_workspace
  cp -r "tests/integration/fixtures/$fixture"/* ./tmp/
}

# Fix permissions on workspace files (for CI where Docker runs as root)
fix_permissions() {
  docker compose run --rm --entrypoint "" cli find /workspace -mindepth 1 ! -name '.gitkeep' -exec chmod 777 {} + 2>/dev/null || true
}

# Run autonoe in Docker
run_autonoe() {
  docker compose run --rm cli autonoe run $DEFAULT_OPTIONS "$@"
  local exit_code=$?
  fix_permissions
  return $exit_code
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
  output=$(docker compose run --rm cli autonoe run $DEFAULT_OPTIONS -d -n 2 2>&1) || true
  fix_permissions

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

# SC-B001: Browser Navigate to localhost
test_scb001() {
  echo ""
  echo "SC-B001: Browser Navigate to localhost"
  setup browser-test

  # Run with more iterations for browser interaction
  if run_autonoe -n 5; then
    # Verify browser test completed via status.json
    if test -f ./tmp/.autonoe/status.json; then
      if jq -e '.deliverables[] | select(.passed == true)' ./tmp/.autonoe/status.json > /dev/null 2>&1; then
        # Check if screenshot was taken
        if test -f ./tmp/screenshot.png; then
          pass
        else
          fail "screenshot.png not found"
        fi
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

# Run a single test by ID
run_test() {
  local test_id="$1"
  case "$test_id" in
    IT-001|it-001) test_it001 ;;
    IT-002|it-002) test_it002 ;;
    IT-003|it-003) test_it003 ;;
    IT-004|it-004) test_it004 ;;
    IT-005|it-005) test_it005 ;;
    SC-B001|sc-b001) test_scb001 ;;
    *)
      echo -e "${RED}Error: Unknown test ID: $test_id${NC}"
      echo "Available tests: IT-001, IT-002, IT-003, IT-004, IT-005, SC-B001"
      exit 1
      ;;
  esac
}

# Run all tests
run_all_tests() {
  test_it001
  test_it002
  test_it003
  test_it004
  test_it005
}

# Show usage
usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --test <ID>  Run a specific test (e.g., IT-001, SC-B001)"
  echo "  --help       Show this help message"
  echo ""
  echo "Available tests:"
  echo "  IT-001   Basic Workflow"
  echo "  IT-002   Technology Stack Recognition"
  echo "  IT-003   Instruction Override"
  echo "  IT-004   Deliverable Status Persistence"
  echo "  IT-005   Session Iteration Limit"
  echo "  SC-B001  Browser Navigate to localhost"
}

# Main execution
main() {
  local selected_test=""

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --test)
        if [[ -n "${2:-}" ]]; then
          selected_test="$2"
          shift 2
        else
          echo -e "${RED}Error: --test requires a test ID${NC}"
          exit 1
        fi
        ;;
      --help)
        usage
        exit 0
        ;;
      *)
        echo -e "${RED}Error: Unknown option: $1${NC}"
        usage
        exit 1
        ;;
    esac
  done

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

  # Run tests
  if [[ -n "$selected_test" ]]; then
    run_test "$selected_test"
  else
    run_all_tests
  fi

  # Summary
  echo ""
  echo "================================"
  echo "Results: ${PASSED} passed, ${FAILED} failed"
  echo "================================"

  exit $FAILED
}

main "$@"
