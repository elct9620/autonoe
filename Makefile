.PHONY: test test-unit test-integration test-all

test: test-unit

test-unit:
	bun run test

test-integration:
	@echo "Running integration tests..."
	./tests/integration/run.sh

test-all: test-unit test-integration
