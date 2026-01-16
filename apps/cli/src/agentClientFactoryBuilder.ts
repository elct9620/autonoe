import {
  DefaultBashSecurity,
  createBashSecurityHook,
  createAutonoeProtectionHook,
  createSyncWriteRestrictionHook,
  VerificationTracker,
  type AgentClientFactory,
  type AgentConfig,
  type InstructionName,
  type PreToolUseHook,
  type DeliverableStatusCallback,
} from '@autonoe/core'
import {
  ClaudeAgentClient,
  createDeliverableMcpServer,
  type FileDeliverableRepository,
} from '@autonoe/agent'
import type { SandboxMode } from './options'

export interface AgentClientFactoryBuildResult {
  factory: AgentClientFactory
  getVerificationTracker?: () => VerificationTracker | undefined
}

export class AgentClientFactoryBuilder {
  private _projectDir?: string
  private _config?: AgentConfig
  private _repository?: FileDeliverableRepository
  private _onStatusChange?: DeliverableStatusCallback
  private _sandboxMode?: SandboxMode
  private _model?: string
  private _maxThinkingTokens?: number
  private _mode?: 'run' | 'sync'
  private _allowDestructive = false

  withProjectDir(dir: string): this {
    this._projectDir = dir
    return this
  }

  withConfig(config: AgentConfig): this {
    this._config = config
    return this
  }

  withRepository(repo: FileDeliverableRepository): this {
    this._repository = repo
    return this
  }

  withStatusChangeCallback(cb: DeliverableStatusCallback): this {
    this._onStatusChange = cb
    return this
  }

  withSandboxMode(mode: SandboxMode): this {
    this._sandboxMode = mode
    return this
  }

  withModel(model?: string): this {
    this._model = model
    return this
  }

  withMaxThinkingTokens(tokens?: number): this {
    this._maxThinkingTokens = tokens
    return this
  }

  withRunMode(allowDestructive: boolean): this {
    this._mode = 'run'
    this._allowDestructive = allowDestructive
    return this
  }

  withSyncMode(): this {
    this._mode = 'sync'
    this._allowDestructive = false
    return this
  }

  build(): AgentClientFactoryBuildResult {
    this.validateRequiredFields()

    const projectDir = this._projectDir!
    const config = this._config!
    const repository = this._repository!
    const onStatusChange = this._onStatusChange
    const sandboxMode = this._sandboxMode!
    const model = this._model
    const maxThinkingTokens = this._maxThinkingTokens

    const preToolUseHooks = this.createPreToolUseHooks()
    const sandbox = sandboxMode.disabled ? undefined : config.sandbox

    if (this._mode === 'sync') {
      return this.buildSyncFactory(
        projectDir,
        config,
        repository,
        onStatusChange,
        sandbox,
        preToolUseHooks,
        model,
        maxThinkingTokens,
      )
    }

    return {
      factory: this.buildRunFactory(
        projectDir,
        config,
        repository,
        onStatusChange,
        sandbox,
        preToolUseHooks,
        model,
        maxThinkingTokens,
      ),
    }
  }

  private validateRequiredFields(): void {
    if (!this._projectDir) {
      throw new Error('AgentClientFactoryBuilder: projectDir is required')
    }
    if (!this._config) {
      throw new Error('AgentClientFactoryBuilder: config is required')
    }
    if (!this._repository) {
      throw new Error('AgentClientFactoryBuilder: repository is required')
    }
    if (!this._sandboxMode) {
      throw new Error('AgentClientFactoryBuilder: sandboxMode is required')
    }
    if (!this._mode) {
      throw new Error(
        'AgentClientFactoryBuilder: mode is required (call withRunMode or withSyncMode)',
      )
    }
  }

  private createPreToolUseHooks(): PreToolUseHook[] {
    const bashSecurity = new DefaultBashSecurity({
      ...this._config!.bashSecurity,
      mode: this._mode!,
      allowDestructive: this._allowDestructive,
      projectDir: this._projectDir!,
    })

    const bashHook = createBashSecurityHook(bashSecurity)

    if (this._mode === 'sync') {
      return [bashHook, createSyncWriteRestrictionHook()]
    }

    return [bashHook, createAutonoeProtectionHook()]
  }

  private buildRunFactory(
    projectDir: string,
    config: AgentConfig,
    repository: FileDeliverableRepository,
    onStatusChange: DeliverableStatusCallback | undefined,
    sandbox: AgentConfig['sandbox'] | undefined,
    preToolUseHooks: PreToolUseHook[],
    model: string | undefined,
    maxThinkingTokens: number | undefined,
  ): AgentClientFactory {
    return {
      create: (instructionName: InstructionName) => {
        const { server: deliverableMcpServer, allowedTools: deliverableTools } =
          createDeliverableMcpServer(repository, {
            toolSet: instructionName,
            onStatusChange,
          })

        return new ClaudeAgentClient({
          cwd: projectDir,
          permissionLevel: 'acceptEdits',
          sandbox,
          mcpServers: config.mcpServers,
          preToolUseHooks,
          sdkMcpServers: [deliverableMcpServer],
          allowedTools: [...config.allowedTools, ...deliverableTools],
          model,
          maxThinkingTokens,
        })
      },
    }
  }

  private buildSyncFactory(
    projectDir: string,
    config: AgentConfig,
    repository: FileDeliverableRepository,
    onStatusChange: DeliverableStatusCallback | undefined,
    sandbox: AgentConfig['sandbox'] | undefined,
    preToolUseHooks: PreToolUseHook[],
    model: string | undefined,
    maxThinkingTokens: number | undefined,
  ): AgentClientFactoryBuildResult {
    let verificationTracker: VerificationTracker | undefined

    const factory: AgentClientFactory = {
      create: (instructionName: InstructionName) => {
        if (instructionName === 'verify' && !verificationTracker) {
          const status = repository.loadSync()
          if (status) {
            verificationTracker = VerificationTracker.fromStatus(status)
          }
        }

        const { server: deliverableMcpServer, allowedTools: deliverableTools } =
          createDeliverableMcpServer(repository, {
            toolSet: instructionName,
            onStatusChange,
            verificationTracker:
              instructionName === 'verify' ? verificationTracker : undefined,
          })

        return new ClaudeAgentClient({
          cwd: projectDir,
          permissionLevel: 'acceptEdits',
          sandbox,
          mcpServers: config.mcpServers,
          preToolUseHooks,
          sdkMcpServers: [deliverableMcpServer],
          allowedTools: [...config.allowedTools, ...deliverableTools],
          model,
          maxThinkingTokens,
        })
      },
    }

    return {
      factory,
      getVerificationTracker: () => verificationTracker,
    }
  }
}
