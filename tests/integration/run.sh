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

# Test metadata for summary generation
declare -A TEST_NAMES=(
  ["IT-001"]="Technology Stack Recognition"
  ["IT-002"]="Instruction Override"
  ["IT-003"]="Session Iteration Limit"
  ["IT-004"]="Sync Without Status.json"
  ["IT-005"]="Sync With Existing Status.json"
  ["SC-B001"]="Browser Navigate to localhost"
)

declare -A TEST_VERIFICATION=(
  ["IT-001"]="File hello.js exists and outputs 'Hello, World!' when executed"
  ["IT-002"]="Agent output contains custom marker '=== CUSTOM MARKER ==='"
  ["IT-003"]="Exit code is 0 or 1 (graceful termination)"
  ["IT-004"]="status.json created with deliverables from SPEC.md"
  ["IT-005"]="new deliverable created and DL-OLD deprecated"
  ["SC-B001"]="status.json has passed deliverable and screenshot.png exists"
)

# Result tracking for summary
declare -a EXECUTED_TESTS=()
declare -A TEST_RESULTS=()
declare -A TEST_NOTES=()
declare -A TEST_STATUS_JSON=()
declare -A TEST_FAIL_REASON=()
CURRENT_TEST=""

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

# Run autonoe sync in Docker
run_autonoe_sync() {
  docker compose run --rm cli autonoe sync $DEFAULT_OPTIONS "$@"
  local exit_code=$?
  fix_permissions
  return $exit_code
}

# Capture test artifacts for summary
capture_test_artifacts() {
  if [[ -f ./tmp/.autonoe-note.md ]]; then
    TEST_NOTES["$CURRENT_TEST"]=$(cat ./tmp/.autonoe-note.md 2>/dev/null || echo "")
  fi
  if [[ -f ./tmp/.autonoe/status.json ]]; then
    TEST_STATUS_JSON["$CURRENT_TEST"]=$(cat ./tmp/.autonoe/status.json 2>/dev/null || echo "")
  fi
}

# Record test result
pass() {
  echo -e "  ${GREEN}PASS${NC}"
  ((PASSED++)) || true
  TEST_RESULTS["$CURRENT_TEST"]="pass"
  capture_test_artifacts
}

fail() {
  local reason="${1:-}"
  if [[ -n "$reason" ]]; then
    echo -e "  ${RED}FAIL${NC}: $reason"
    TEST_FAIL_REASON["$CURRENT_TEST"]="$reason"
  else
    echo -e "  ${RED}FAIL${NC}"
  fi
  ((FAILED++)) || true
  TEST_RESULTS["$CURRENT_TEST"]="fail"
  capture_test_artifacts
}

# IT-001: Technology Stack Recognition
test_it001() {
  CURRENT_TEST="IT-001"
  EXECUTED_TESTS+=("IT-001")
  echo ""
  echo "IT-001: Technology Stack Recognition"
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

# IT-002: Instruction Override
test_it002() {
  CURRENT_TEST="IT-002"
  EXECUTED_TESTS+=("IT-002")
  echo ""
  echo "IT-002: Instruction Override"
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

# IT-003: Session Iteration Limit
test_it003() {
  CURRENT_TEST="IT-003"
  EXECUTED_TESTS+=("IT-003")
  echo ""
  echo "IT-003: Session Iteration Limit"
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

# IT-004: Sync Without Status.json
test_it004() {
  CURRENT_TEST="IT-004"
  EXECUTED_TESTS+=("IT-004")
  echo ""
  echo "IT-004: Sync Without Status.json"
  setup hello-world

  if run_autonoe_sync -n 3; then
    if test -f ./tmp/.autonoe/status.json; then
      # Check if deliverables array is not empty
      if jq -e '.deliverables | length > 0' ./tmp/.autonoe/status.json > /dev/null 2>&1; then
        pass
      else
        fail "status.json has no deliverables"
      fi
    else
      fail ".autonoe/status.json not found"
    fi
  else
    fail "autonoe sync execution failed"
  fi
}

# IT-005: Sync With Existing Status.json
test_it005() {
  CURRENT_TEST="IT-005"
  EXECUTED_TESTS+=("IT-005")
  echo ""
  echo "IT-005: Sync With Existing Status.json"
  setup sync-existing

  if run_autonoe_sync -n 3; then
    if test -f ./tmp/.autonoe/status.json; then
      # Check 1: New deliverable created (description contains "New" or similar)
      if ! jq -e '.deliverables[] | select(.description | test("New|new|DL-002"; "i"))' ./tmp/.autonoe/status.json > /dev/null 2>&1; then
        # Fallback check: deliverables count increased
        local count
        count=$(jq '.deliverables | length' ./tmp/.autonoe/status.json)
        if [[ "$count" -lt 3 ]]; then
          fail "new deliverable not created"
          return
        fi
      fi

      # Check 2: DL-OLD is deprecated (has deprecatedAt field)
      if ! jq -e '.deliverables[] | select(.id == "DL-OLD") | select(.deprecatedAt != null)' ./tmp/.autonoe/status.json > /dev/null 2>&1; then
        fail "DL-OLD was not deprecated"
        return
      fi

      pass
    else
      fail ".autonoe/status.json not found"
    fi
  else
    fail "autonoe sync execution failed"
  fi
}

# SC-B001: Browser Navigate to localhost
test_scb001() {
  CURRENT_TEST="SC-B001"
  EXECUTED_TESTS+=("SC-B001")
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
      echo "Available tests:"
      echo "  IT-001   Technology Stack Recognition"
      echo "  IT-002   Instruction Override"
      echo "  IT-003   Session Iteration Limit"
      echo "  IT-004   Sync Without Status.json"
      echo "  IT-005   Sync With Existing Status.json"
      echo "  SC-B001  Browser Navigate to localhost"
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

# Run all E2E tests (alias for run_all_tests)
run_e2e_tests() {
  run_all_tests
}

# Generate GitHub Actions Job Summary
generate_summary() {
  # Skip if not in GitHub Actions
  if [[ -z "${GITHUB_STEP_SUMMARY:-}" ]]; then
    return
  fi

  local summary_file="$GITHUB_STEP_SUMMARY"

  # Header with methodology
  cat >> "$summary_file" << 'EOF'
# Autonoe Integration Test Results

## Test Methodology

Integration tests verify Autonoe's end-to-end behavior by:
1. Setting up a workspace with a fixture (SPEC.md and optional configuration)
2. Running Autonoe in a Docker container with the Claude Agent SDK
3. Verifying the agent produced expected outputs (files, status updates, etc.)

Each test uses a separate fixture from `tests/integration/fixtures/` and validates specific functionality.

## Summary

EOF

  # Summary table
  echo "| Test ID | Name | Status |" >> "$summary_file"
  echo "|---------|------|--------|" >> "$summary_file"

  for test_id in "${EXECUTED_TESTS[@]}"; do
    local name="${TEST_NAMES[$test_id]}"
    local result="${TEST_RESULTS[$test_id]}"
    local status_icon
    if [[ "$result" == "pass" ]]; then
      status_icon=":white_check_mark: PASS"
    else
      status_icon=":x: FAIL"
    fi
    echo "| $test_id | $name | $status_icon |" >> "$summary_file"
  done

  echo "" >> "$summary_file"
  echo "## Test Details" >> "$summary_file"
  echo "" >> "$summary_file"

  # Detailed results for each test
  for test_id in "${EXECUTED_TESTS[@]}"; do
    local name="${TEST_NAMES[$test_id]}"
    local result="${TEST_RESULTS[$test_id]}"
    local verification="${TEST_VERIFICATION[$test_id]}"
    local fail_reason="${TEST_FAIL_REASON[$test_id]:-}"
    local notes="${TEST_NOTES[$test_id]:-}"
    local status_json="${TEST_STATUS_JSON[$test_id]:-}"

    echo "### $test_id: $name" >> "$summary_file"
    echo "" >> "$summary_file"

    if [[ "$result" == "pass" ]]; then
      echo "**Status:** :white_check_mark: PASS" >> "$summary_file"
    else
      echo "**Status:** :x: FAIL" >> "$summary_file"
      if [[ -n "$fail_reason" ]]; then
        echo "" >> "$summary_file"
        echo "**Failure Reason:** $fail_reason" >> "$summary_file"
      fi
    fi
    echo "" >> "$summary_file"

    echo "**Verification:** $verification" >> "$summary_file"
    echo "" >> "$summary_file"

    # Agent notes (collapsible)
    if [[ -n "$notes" ]]; then
      cat >> "$summary_file" << EOF
<details>
<summary>Agent Notes (.autonoe-note.md)</summary>

\`\`\`
$notes
\`\`\`

</details>

EOF
    fi

    # Status JSON (collapsible)
    if [[ -n "$status_json" ]]; then
      cat >> "$summary_file" << EOF
<details>
<summary>Status JSON (.autonoe/status.json)</summary>

\`\`\`json
$status_json
\`\`\`

</details>

EOF
    fi

    echo "---" >> "$summary_file"
    echo "" >> "$summary_file"
  done
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
  echo "  IT-001   Technology Stack Recognition"
  echo "  IT-002   Instruction Override"
  echo "  IT-003   Session Iteration Limit"
  echo "  IT-004   Sync Without Status.json"
  echo "  IT-005   Sync With Existing Status.json"
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

  # Generate GitHub Actions summary
  generate_summary

  exit $FAILED
}

main "$@"
