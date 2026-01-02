.PHONY: test test-unit test-integration test-all

test: test-unit

test-unit:
	bun run test

# Run all integration tests or a specific test with TEST=<ID>
# Examples:
#   make test-integration            # Run all tests
#   make test-integration TEST=IT-001  # Run specific test
test-integration:
	@echo "Running integration tests..."
ifdef TEST
	./tests/integration/run.sh --test $(TEST)
else
	./tests/integration/run.sh
endif

test-all: test-unit test-integration
