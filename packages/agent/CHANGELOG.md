# Changelog

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
