# Browser Test

## Environment

- Use `mcp__playwright__browser_install` if browser is not available
- Do NOT run `npx playwright install` - use MCP tools instead
- Use `mcp__playwright__*` tools for browser automation

## Deliverables

### DL-001: Browser Navigation and Screenshot

Use the Playwright MCP browser to navigate to a web page and take a screenshot.

#### Steps

1. Use the Playwright browser to navigate to `https://example.com`
2. Take a snapshot of the page to verify it loaded
3. Take a screenshot and save it as `screenshot.png` in the project root

#### Acceptance Criteria

- File `screenshot.png` exists in project root
- The page title contains "Example Domain"
