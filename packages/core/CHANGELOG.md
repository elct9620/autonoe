# Changelog

## [0.5.0](https://github.com/elct9620/autonoe/compare/core-v0.4.2...core-v0.5.0) (2026-01-17)


### Features

* **core:** add Rust and PHP language profiles ([c1a2953](https://github.com/elct9620/autonoe/commit/c1a29538eb642748c7c3d3e38e96b74435b547bf))


### Bug Fixes

* **core:** allow SIGINT to interrupt quota wait ([ec73cf8](https://github.com/elct9620/autonoe/commit/ec73cf8499d09379c97673ae451bb9173fd330ac))

## [0.4.2](https://github.com/elct9620/autonoe/compare/core-v0.4.1...core-v0.4.2) (2026-01-17)


### Bug Fixes

* **agent:** bump version for core 0.4.1 dependency update ([3edfa93](https://github.com/elct9620/autonoe/commit/3edfa9372f09b637f138860aff44a0d79415a45f))

## [0.4.1](https://github.com/elct9620/autonoe/compare/core-v0.4.0...core-v0.4.1) (2026-01-17)


### Bug Fixes

* **core:** update quota wait event interval to match presenter render rate ([ed02174](https://github.com/elct9620/autonoe/commit/ed02174f1931cc240b9806c1fc9802d000b3418c))

## [0.4.0](https://github.com/elct9620/autonoe/compare/core-v0.3.1...core-v0.4.0) (2026-01-17)


### Features

* **core:** add /tmp directory read/write permissions to security baseline ([11e3dcd](https://github.com/elct9620/autonoe/commit/11e3dcd237db6016dfa947d877b5cc0858b7652f))
* **core:** replace WaitProgressReporter with unified ActivityReporter ([de626d2](https://github.com/elct9620/autonoe/commit/de626d25b4ecde945a740e5e22a1f48d538b8a46))

## [0.3.1](https://github.com/elct9620/autonoe/compare/core-v0.3.0...core-v0.3.1) (2026-01-15)


### Bug Fixes

* **agent:** align deliverable tool sets with SPEC.md Section 3.2 ([5273566](https://github.com/elct9620/autonoe/commit/5273566973ad8cac4b7773e836b4ad3d4bd79328))

## [0.3.0](https://github.com/elct9620/autonoe/compare/core-v0.2.0...core-v0.3.0) (2026-01-15)


### Features

* **agent:** add deprecate_deliverable tool with tool set mechanism ([a1b9b77](https://github.com/elct9620/autonoe/commit/a1b9b776fad882896d6f47760d09653547a6863c))
* **core:** add AgentClient.dispose() for resource cleanup ([9b6ac90](https://github.com/elct9620/autonoe/commit/9b6ac90c14b08e487a7d61c8b7d699039ce9b533))
* **core:** add execution mode support for sync command security ([fd4990f](https://github.com/elct9620/autonoe/commit/fd4990f737368cc8e5b9e4258c10e7671b16480f))
* **core:** add progress feedback during quota wait ([942c408](https://github.com/elct9620/autonoe/commit/942c40873802aa1343e416b5bc7d7a74619d0500))
* **core:** add sync and verify instruction types support ([9cb2280](https://github.com/elct9620/autonoe/commit/9cb2280442c6167f4f6002fe1891e6026ff7dc1f))
* **core:** add sync and verify instructions for sync command ([e23b1ea](https://github.com/elct9620/autonoe/commit/e23b1ead41bfbb3343ba1b3a6eee0ea67c962ad3))
* **core:** add tool failure fallback strategy to instructions ([2939fae](https://github.com/elct9620/autonoe/commit/2939fae3dac19f934beda56af7ac0558e6264aa7))
* **core:** allow echo and sleep commands in sync mode ([03455b0](https://github.com/elct9620/autonoe/commit/03455b053e147823b378faf00b3c1315add3e3fc))
* **core:** display verified count instead of passed for sync command ([ae23e82](https://github.com/elct9620/autonoe/commit/ae23e82103da1f85153cbc4c7046de693c95b89e))
* **core:** implement verification tracker for sync command ([d907522](https://github.com/elct9620/autonoe/commit/d9075223a7880e5174baca8f31f220be82b99513))
* **core:** support tiered allowCommands structure for mode-specific extensions ([1a25f3c](https://github.com/elct9620/autonoe/commit/1a25f3ca3fbe662d9dc22bc90ac4dbca60994c8e))


### Bug Fixes

* ensure hidden directories are copied in integration test setup ([1d20dff](https://github.com/elct9620/autonoe/commit/1d20dff26e3a214c42aee85f26d02b29a9dd332b))

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
