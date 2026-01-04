# Changelog

## [0.2.0](https://github.com/elct9620/autonoe/compare/core-v0.1.0...core-v0.2.0) (2026-01-04)


### Features

* **cli:** add --thinking option for extended thinking mode ([b39993d](https://github.com/elct9620/autonoe/commit/b39993d85a643c992d158456cf75c967997c46f2))
* **cli:** display deliverable status changes during session ([7bd2691](https://github.com/elct9620/autonoe/commit/7bd2691708621e0a50b4d17a37f1312c1cb6dcd6))
* **cli:** implement autonoe run command with stub session ([1883726](https://github.com/elct9620/autonoe/commit/1883726f8df2dcc1b52a49f850a41a9e8e08e73e))
* **core:** add AgentThinking event type for Claude thinking content ([85a98ae](https://github.com/elct9620/autonoe/commit/85a98aed48aeba758e05a01f4e7dda6f2c952186))
* **core:** add blocked deliverable state and SIGINT handling ([01d8de5](https://github.com/elct9620/autonoe/commit/01d8de50081932666643cf20faafce81f5d87398))
* **core:** add jq to base profile allowed commands ([89b4bd4](https://github.com/elct9620/autonoe/commit/89b4bd4b49cc60bee736832578dc215ac81e4cbf))
* **core:** add language profile support for bash security ([a67f0a1](https://github.com/elct9620/autonoe/commit/a67f0a104c325e9960ede1b8b16fcf987325aabf))
* **core:** add Logger interface with dependency injection ([599eb25](https://github.com/elct9620/autonoe/commit/599eb25835cf6eb05c94a1d59ef8d0167678b0c4))
* **core:** add overall summary and human-readable duration format ([ad8779b](https://github.com/elct9620/autonoe/commit/ad8779b726f0f067fb83e98ee4cea25f5b6dd651))
* **core:** add permissions and allowedTools configuration ([e250385](https://github.com/elct9620/autonoe/commit/e2503852192bf44e6c9e054b1b89eb2aa39bdc66))
* **core:** add quota exceeded handling with wait-for-quota option ([b4cf702](https://github.com/elct9620/autonoe/commit/b4cf7023adfd33606cca0f31e2948e05d381437d))
* **core:** add read-only text processing commands to base profile ([5227815](https://github.com/elct9620/autonoe/commit/522781580f5c9f075f53b6b454fbfe2f0025552a))
* **core:** add retry mechanism and unified exit point for SessionRunner ([8771ca0](https://github.com/elct9620/autonoe/commit/8771ca0695cacacf4521cb1b38bdb5ca8d56b1e2))
* **core:** add selective test execution and browser integration test ([4d57abe](https://github.com/elct9620/autonoe/commit/4d57abef8e4461eba76a07b746ae181e3fa82f1f))
* **core:** add warning and error log levels to Logger ([32652e6](https://github.com/elct9620/autonoe/commit/32652e6becf68d0f4c76926c4ee3045daf02f113))
* **core:** allow bin/dev.sh script execution in bash security ([c1af6e2](https://github.com/elct9620/autonoe/commit/c1af6e2e61a164464c41a39b4fbf7b012fae8848))
* **core:** display SDK result event output to users ([5165b3f](https://github.com/elct9620/autonoe/commit/5165b3fefae4f5f2d3c6bfb0ea17ffa557855331))
* **core:** implement --allow-destructive and --no-sandbox warnings ([25e7336](https://github.com/elct9620/autonoe/commit/25e7336e756de07079b84ba8650979eec0d00e18))
* **core:** implement AgentClient with Session dependency injection ([bebb15a](https://github.com/elct9620/autonoe/commit/bebb15ac6ae6c53ea499bc6692af8ebe713e618b))
* **core:** implement DeliverableStatus tool with SDK MCP server ([bc3d603](https://github.com/elct9620/autonoe/commit/bc3d6039a42c61dc9db20f01b72b8880132b9e4c))
* **core:** implement instruction system for agent guidance ([2c39cb1](https://github.com/elct9620/autonoe/commit/2c39cb123e659c06b4590df70bb2a5ddec1efbee))
* **core:** implement SessionRunner continuous loop ([19d30a0](https://github.com/elct9620/autonoe/commit/19d30a0d382a5f6a228db02a39ed1f748b6193d7))
* **core:** implement three-layer security model ([7888e17](https://github.com/elct9620/autonoe/commit/7888e175f495a9957dc4fe8a0691375690172c9c))
* **core:** use Microsoft Playwright MCP with user-priority config ([76fa2a5](https://github.com/elct9620/autonoe/commit/76fa2a51b4e3a49b9cbe85ed7359076593c4ce26))


### Bug Fixes

* **agent:** pass model parameter to Claude Agent SDK ([af0e959](https://github.com/elct9620/autonoe/commit/af0e959eba0afd2121d183f2112dbf9345262f49))
* **core:** handle SDK errors after session_end with StreamError event ([4a8e2e2](https://github.com/elct9620/autonoe/commit/4a8e2e29365d7550b39c8694518bf6ee9af7792f))
* **core:** prevent EMFILE error with AgentClientFactory pattern ([d94ab4e](https://github.com/elct9620/autonoe/commit/d94ab4e5d4cb30bd89d51ed339c19cd0d8235777))
* **core:** prevent false positive blocking of .autonoe-note.txt ([37a04c1](https://github.com/elct9620/autonoe/commit/37a04c1e3d1869a6e483b6352363167f7dff9e15))
* **core:** update remaining claude-agent-client reference ([70f2ce2](https://github.com/elct9620/autonoe/commit/70f2ce2fd4ffd34251caa8f0dbec8daafc543d26))
* **core:** use MCP browser_install instead of pre-installed browser ([fef9ec0](https://github.com/elct9620/autonoe/commit/fef9ec0c6e6d2759eb0015f26afb24487da7cec3))
* correct typos and add session notes to spec ([2f07677](https://github.com/elct9620/autonoe/commit/2f0767708a1da8aad301b0e2be2cce522ea9d631))
