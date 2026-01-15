# Changelog

## [0.3.0](https://github.com/elct9620/autonoe/compare/cli-v0.2.1...cli-v0.3.0) (2026-01-15)


### Features

* **agent:** add deprecate_deliverable tool with tool set mechanism ([a1b9b77](https://github.com/elct9620/autonoe/commit/a1b9b776fad882896d6f47760d09653547a6863c))
* **cli:** add openssh-client and gnupg for Git signing support ([d4faef3](https://github.com/elct9620/autonoe/commit/d4faef3ecb81e6a110eff170390c5da29663630a))
* **cli:** add sync command with dummy implementation ([3f7e2fe](https://github.com/elct9620/autonoe/commit/3f7e2fedd5520a479cd7b60155ab82b3415bc799))
* **cli:** add temporary default max-iterations for sync command ([4bf3312](https://github.com/elct9620/autonoe/commit/4bf3312f0fbbc18075acb16996f532e63d75afe8))
* **cli:** implement SyncCommandHandler two-phase execution ([58b0bb0](https://github.com/elct9620/autonoe/commit/58b0bb0d06d287b909a3adbf45f9297dd17e5412))
* **core:** add execution mode support for sync command security ([fd4990f](https://github.com/elct9620/autonoe/commit/fd4990f737368cc8e5b9e4258c10e7671b16480f))
* **core:** add progress feedback during quota wait ([942c408](https://github.com/elct9620/autonoe/commit/942c40873802aa1343e416b5bc7d7a74619d0500))
* **core:** add sync and verify instruction types support ([9cb2280](https://github.com/elct9620/autonoe/commit/9cb2280442c6167f4f6002fe1891e6026ff7dc1f))
* **core:** implement verification tracker for sync command ([d907522](https://github.com/elct9620/autonoe/commit/d9075223a7880e5174baca8f31f220be82b99513))


### Bug Fixes

* **cli:** apply AUTONOE_NO_SANDBOX env var to sync command ([97aec5e](https://github.com/elct9620/autonoe/commit/97aec5ef04df911380e5e04eb992d5dba183fd5e))
* **cli:** output warn and error messages to stderr ([9de43af](https://github.com/elct9620/autonoe/commit/9de43af0666c2fa6bed85ca8d84856581dd3f1d9))
* **cli:** treat all_blocked as failure per SPEC.md ([d8d1ee1](https://github.com/elct9620/autonoe/commit/d8d1ee1cba8aa268b401c714ae835bc1f98ab3ae))


### Performance Improvements

* **cli:** optimize Dockerfile layer order to improve build cache ([17ef469](https://github.com/elct9620/autonoe/commit/17ef469f4ce3ba40d9fdd272d03e47b47bfe16c2))

## [0.2.1](https://github.com/elct9620/autonoe/compare/cli-v0.2.0...cli-v0.2.1) (2026-01-04)


### Bug Fixes

* **cli:** add package description and workflow concurrency settings ([ae48ac0](https://github.com/elct9620/autonoe/commit/ae48ac0f5551bf263c07e6c009733deb21ce3e76))

## [0.2.0](https://github.com/elct9620/autonoe/compare/cli-v0.1.0...cli-v0.2.0) (2026-01-04)


### Features

* **ci:** add Docker and binary release workflows ([23a9fbd](https://github.com/elct9620/autonoe/commit/23a9fbd5eef6e98e913bad06da0e6485cf7f97be))
* **cli:** add --project-dir option for remote project targeting ([11998b1](https://github.com/elct9620/autonoe/commit/11998b1a79bda752c40aa0ea3fd45ee25e9c75ab))
* **cli:** add --thinking option for extended thinking mode ([b39993d](https://github.com/elct9620/autonoe/commit/b39993d85a643c992d158456cf75c967997c46f2))
* **cli:** add AUTONOE_NO_SANDBOX env var for sandbox control ([1a20a5a](https://github.com/elct9620/autonoe/commit/1a20a5a6bcb58b34bcf53dc1ff315472b91fc1c9))
* **cli:** add Docker configuration for multi-target builds ([10b7e9f](https://github.com/elct9620/autonoe/commit/10b7e9f288b55722c9e1784b408df9dcfa7c1bec))
* **cli:** add jq to all Docker image stages ([a3c6f90](https://github.com/elct9620/autonoe/commit/a3c6f9032f76fe399e2c355eeb58692d8e661910))
* **cli:** display deliverable status changes during session ([7bd2691](https://github.com/elct9620/autonoe/commit/7bd2691708621e0a50b4d17a37f1312c1cb6dcd6))
* **cli:** implement autonoe run command with stub session ([1883726](https://github.com/elct9620/autonoe/commit/1883726f8df2dcc1b52a49f850a41a9e8e08e73e))
* **cli:** install uv in Python Docker image ([3027510](https://github.com/elct9620/autonoe/commit/30275106f7db5c798e35cef074717a01f2aeaa2e))
* **core:** add blocked deliverable state and SIGINT handling ([01d8de5](https://github.com/elct9620/autonoe/commit/01d8de50081932666643cf20faafce81f5d87398))
* **core:** add Logger interface with dependency injection ([599eb25](https://github.com/elct9620/autonoe/commit/599eb25835cf6eb05c94a1d59ef8d0167678b0c4))
* **core:** add permissions and allowedTools configuration ([e250385](https://github.com/elct9620/autonoe/commit/e2503852192bf44e6c9e054b1b89eb2aa39bdc66))
* **core:** add quota exceeded handling with wait-for-quota option ([b4cf702](https://github.com/elct9620/autonoe/commit/b4cf7023adfd33606cca0f31e2948e05d381437d))
* **core:** add retry mechanism and unified exit point for SessionRunner ([8771ca0](https://github.com/elct9620/autonoe/commit/8771ca0695cacacf4521cb1b38bdb5ca8d56b1e2))
* **core:** add warning and error log levels to Logger ([32652e6](https://github.com/elct9620/autonoe/commit/32652e6becf68d0f4c76926c4ee3045daf02f113))
* **core:** display SDK result event output to users ([5165b3f](https://github.com/elct9620/autonoe/commit/5165b3fefae4f5f2d3c6bfb0ea17ffa557855331))
* **core:** implement --allow-destructive and --no-sandbox warnings ([25e7336](https://github.com/elct9620/autonoe/commit/25e7336e756de07079b84ba8650979eec0d00e18))
* **core:** implement DeliverableStatus tool with SDK MCP server ([bc3d603](https://github.com/elct9620/autonoe/commit/bc3d6039a42c61dc9db20f01b72b8880132b9e4c))
* **core:** implement instruction system for agent guidance ([2c39cb1](https://github.com/elct9620/autonoe/commit/2c39cb123e659c06b4590df70bb2a5ddec1efbee))
* **core:** implement SessionRunner continuous loop ([19d30a0](https://github.com/elct9620/autonoe/commit/19d30a0d382a5f6a228db02a39ed1f748b6193d7))
* **core:** implement three-layer security model ([7888e17](https://github.com/elct9620/autonoe/commit/7888e175f495a9957dc4fe8a0691375690172c9c))


### Bug Fixes

* **agent:** pass model parameter to Claude Agent SDK ([af0e959](https://github.com/elct9620/autonoe/commit/af0e959eba0afd2121d183f2112dbf9345262f49))
* **ci:** replace GoReleaser with Bun cross-compile for binary releases ([5776d26](https://github.com/elct9620/autonoe/commit/5776d26f290cba8dd9cca14c603acd101f840895))
* **cli:** pre-install Chromium browser in Docker images ([ec37de1](https://github.com/elct9620/autonoe/commit/ec37de1460049bf712e93cb77dfa14aed318e536))
* **core:** prevent EMFILE error with AgentClientFactory pattern ([d94ab4e](https://github.com/elct9620/autonoe/commit/d94ab4e5d4cb30bd89d51ed339c19cd0d8235777))
* **core:** prevent false positive blocking of .autonoe-note.txt ([37a04c1](https://github.com/elct9620/autonoe/commit/37a04c1e3d1869a6e483b6352363167f7dff9e15))
* **core:** use MCP browser_install instead of pre-installed browser ([fef9ec0](https://github.com/elct9620/autonoe/commit/fef9ec0c6e6d2759eb0015f26afb24487da7cec3))
