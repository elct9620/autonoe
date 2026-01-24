# Changelog

## [1.0.0](https://github.com/elct9620/autonoe/compare/claude-agent-v0.4.6...claude-agent-v1.0.0) (2026-01-24)


### ⚠ BREAKING CHANGES

* **claude-agent:** Package renamed from @autonoe/agent to @autonoe/claude-agent. Users must update their imports.

### Bug Fixes

* **agent:** bump version for core 0.4.1 dependency update ([3edfa93](https://github.com/elct9620/autonoe/commit/3edfa9372f09b637f138860aff44a0d79415a45f))


### Code Refactoring

* **claude-agent:** rename package from @autonoe/agent to @autonoe/claude-agent ([ff7afa4](https://github.com/elct9620/autonoe/commit/ff7afa4531d05807d78cc372ae4b745d0afd99bd))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @autonoe/core bumped to 0.9.0

## [0.4.6](https://github.com/elct9620/autonoe/compare/agent-v0.4.5...agent-v0.4.6) (2026-01-21)


### Bug Fixes

* **core:** remove built-in Playwright MCP from codebase ([36f9ed0](https://github.com/elct9620/autonoe/commit/36f9ed0dade35b46a233b94675df565ea1195563))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @autonoe/core bumped to 0.8.0

## [0.4.5](https://github.com/elct9620/autonoe/compare/agent-v0.4.4...agent-v0.4.5) (2026-01-18)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @autonoe/core bumped to 0.7.1

## [0.4.4](https://github.com/elct9620/autonoe/compare/agent-v0.4.3...agent-v0.4.4) (2026-01-18)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @autonoe/core bumped to 0.7.0

## [0.4.3](https://github.com/elct9620/autonoe/compare/agent-v0.4.2...agent-v0.4.3) (2026-01-18)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @autonoe/core bumped to 0.6.0

## [0.4.2](https://github.com/elct9620/autonoe/compare/agent-v0.4.1...agent-v0.4.2) (2026-01-17)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @autonoe/core bumped to 0.5.0

## [0.4.1](https://github.com/elct9620/autonoe/compare/agent-v0.4.0...agent-v0.4.1) (2026-01-17)


### Bug Fixes

* **agent:** bump version for core 0.4.1 dependency update ([3edfa93](https://github.com/elct9620/autonoe/commit/3edfa9372f09b637f138860aff44a0d79415a45f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @autonoe/core bumped to 0.4.2

## [0.4.0](https://github.com/elct9620/autonoe/compare/agent-v0.3.1...agent-v0.4.0) (2026-01-17)


### Features

* **core:** replace WaitProgressReporter with unified ActivityReporter ([de626d2](https://github.com/elct9620/autonoe/commit/de626d25b4ecde945a740e5e22a1f48d538b8a46))

## [0.3.1](https://github.com/elct9620/autonoe/compare/agent-v0.3.0...agent-v0.3.1) (2026-01-15)


### Bug Fixes

* **agent:** align deliverable tool sets with SPEC.md Section 3.2 ([5273566](https://github.com/elct9620/autonoe/commit/5273566973ad8cac4b7773e836b4ad3d4bd79328))

## [0.3.0](https://github.com/elct9620/autonoe/compare/agent-v0.2.0...agent-v0.3.0) (2026-01-15)


### Features

* **agent:** add deprecate_deliverable tool with tool set mechanism ([a1b9b77](https://github.com/elct9620/autonoe/commit/a1b9b776fad882896d6f47760d09653547a6863c))
* **agent:** enable SDK to load project CLAUDE.md settings ([ef9bed3](https://github.com/elct9620/autonoe/commit/ef9bed3fddfd51decf754a95bf0f81b8334b92b9))
* **core:** add AgentClient.dispose() for resource cleanup ([9b6ac90](https://github.com/elct9620/autonoe/commit/9b6ac90c14b08e487a7d61c8b7d699039ce9b533))
* **core:** add execution mode support for sync command security ([fd4990f](https://github.com/elct9620/autonoe/commit/fd4990f737368cc8e5b9e4258c10e7671b16480f))
* **core:** implement verification tracker for sync command ([d907522](https://github.com/elct9620/autonoe/commit/d9075223a7880e5174baca8f31f220be82b99513))

## [0.2.0](https://github.com/elct9620/autonoe/compare/agent-v0.1.0...agent-v0.2.0) (2026-01-04)


### Features

* **cli:** add --thinking option for extended thinking mode ([b39993d](https://github.com/elct9620/autonoe/commit/b39993d85a643c992d158456cf75c967997c46f2))
* **cli:** display deliverable status changes during session ([7bd2691](https://github.com/elct9620/autonoe/commit/7bd2691708621e0a50b4d17a37f1312c1cb6dcd6))
* **core:** add AgentThinking event type for Claude thinking content ([85a98ae](https://github.com/elct9620/autonoe/commit/85a98aed48aeba758e05a01f4e7dda6f2c952186))
* **core:** add blocked deliverable state and SIGINT handling ([01d8de5](https://github.com/elct9620/autonoe/commit/01d8de50081932666643cf20faafce81f5d87398))
* **core:** add quota exceeded handling with wait-for-quota option ([b4cf702](https://github.com/elct9620/autonoe/commit/b4cf7023adfd33606cca0f31e2948e05d381437d))


### Bug Fixes

* **agent:** pass model parameter to Claude Agent SDK ([af0e959](https://github.com/elct9620/autonoe/commit/af0e959eba0afd2121d183f2112dbf9345262f49))
* **core:** handle SDK errors after session_end with StreamError event ([4a8e2e2](https://github.com/elct9620/autonoe/commit/4a8e2e29365d7550b39c8694518bf6ee9af7792f))
