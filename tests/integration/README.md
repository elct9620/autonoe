# Integration Tests

End-to-end tests for Autonoe using Docker containers.

## Prerequisites

- Docker
- jq (for JSON assertions)
- `ANTHROPIC_API_KEY` environment variable

## Running Tests

```bash
# Run all integration tests
make test-integration

# Or directly
./tests/integration/run.sh
```

## Test Cases

| ID     | Scenario                       | Fixture            |
| ------ | ------------------------------ | ------------------ |
| IT-001 | Basic Workflow                 | hello-world        |
| IT-002 | Technology Stack Recognition   | nodejs             |
| IT-003 | Instruction Override           | custom-instruction |
| IT-004 | Deliverable Status Persistence | hello-world        |
| IT-005 | Session Iteration Limit        | hello-world        |

## Adding New Tests

1. Create a fixture directory under `fixtures/`
2. Add a `SPEC.md` file with deliverables
3. (Optional) Add `.autonoe/initializer.md` for custom instructions
4. Add test function in `run.sh`

## Directory Structure

```
tests/integration/
├── run.sh              # Test runner script
├── README.md           # This file
└── fixtures/
    ├── hello-world/    # Basic workflow test
    │   └── SPEC.md
    ├── nodejs/         # Node.js stack test
    │   └── SPEC.md
    └── custom-instruction/
        ├── SPEC.md
        └── .autonoe/
            └── initializer.md
```

## Notes

- Tests use `./tmp/` as the workspace (mounted to container's `/workspace`)
- Each test cleans the workspace before running
- Tests require API calls and may take several minutes
- Run integration tests manually or in nightly CI (not on every commit)
