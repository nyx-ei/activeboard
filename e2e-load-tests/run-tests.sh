#!/bin/bash

# ActiveBoard Load Test Runner
# Usage: ./run-tests.sh [scenario] [test-file]
# Examples:
#   ./run-tests.sh smoke
#   ./run-tests.sh load session-lifecycle
#   ./run-tests.sh stress connection-stability

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
SCENARIO=${1:-smoke}
TEST_FILE=${2:-session-lifecycle}
BASE_URL=${BASE_URL:-http://localhost:3000}
RESULTS_DIR="results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Verify k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}✗ k6 not found${NC}"
    echo "Install k6: https://k6.io/docs/getting-started/installation/"
    echo ""
    echo "Quick install:"
    echo "  macOS: brew install k6"
    echo "  Linux: sudo apt-get install k6"
    echo "  Docker: docker build -t activeboard-load-tests ."
    exit 1
fi

# Create results directory
mkdir -p "$RESULTS_DIR"

# Print header
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       ActiveBoard Load Testing Suite - k6${NC}               ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Validate scenario
valid_scenarios=(smoke load stress spike)
if [[ ! " ${valid_scenarios[@]} " =~ " ${SCENARIO} " ]]; then
    echo -e "${RED}✗ Invalid scenario: ${SCENARIO}${NC}"
    echo "Valid scenarios: ${valid_scenarios[@]}"
    exit 1
fi

# Validate test file exists
if [[ ! -f "${TEST_FILE}.js" ]]; then
    echo -e "${RED}✗ Test file not found: ${TEST_FILE}.js${NC}"
    exit 1
fi

# Print configuration
echo -e "${YELLOW}Test Configuration:${NC}"
echo "  Scenario:  ${SCENARIO}"
echo "  Test File: ${TEST_FILE}.js"
echo "  Base URL:  ${BASE_URL}"
echo "  Results:   ${RESULTS_DIR}/${TEST_FILE}_${SCENARIO}_${TIMESTAMP}/"
echo ""

# Run test
OUTPUT_DIR="${RESULTS_DIR}/${TEST_FILE}_${SCENARIO}_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}▶ Running test...${NC}"
echo ""

k6 run \
  -e SCENARIO="$SCENARIO" \
  -e BASE_URL="$BASE_URL" \
  --out json="$OUTPUT_DIR/results.json" \
  "${TEST_FILE}.js" \
  2>&1 | tee "$OUTPUT_DIR/output.log"

TEST_EXIT_CODE=$?

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Parse results if test passed
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ Test completed successfully${NC}"

    # Summary
    echo ""
    echo -e "${YELLOW}Results saved to: ${OUTPUT_DIR}${NC}"
    echo ""

    # Generate summary if jq is available
    if command -v jq &> /dev/null; then
        echo -e "${YELLOW}Key Metrics:${NC}"
        jq -r '.metrics | to_entries[] | "\(.key): \(.value | .value // .values | @json)"' \
            "$OUTPUT_DIR/results.json" 2>/dev/null | head -10 || true
    fi
else
    echo -e "${RED}✗ Test failed (exit code: $TEST_EXIT_CODE)${NC}"
    exit $TEST_EXIT_CODE
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review results: cat ${OUTPUT_DIR}/output.log"
echo "  2. Analyze JSON: cat ${OUTPUT_DIR}/results.json"
echo "  3. View metrics: k6 inspect ${OUTPUT_DIR}/results.json (if using cloud)"
echo ""
