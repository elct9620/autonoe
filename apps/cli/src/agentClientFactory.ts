import {
  DefaultBashSecurity,
  createBashSecurityHook,
  createAutonoeProtectionHook,
  createSyncWriteRestrictionHook,
  VerificationTracker,
  Workflow,
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
} from '@autonoe/claude-agent'
import {
  DEFAULT_CODING_MODEL,
  DEFAULT_PLANNING_MODEL,
  type SandboxMode,
} from './options'

export interface AgentClientFactoryResult {
  factory: AgentClientFactory
  getVerificationTracker?: () => VerificationTracker | undefined
}

export interface AgentClientFactoryOptions {
  projectDir: string
  config: AgentConfig
  repository: FileDeliverableRepository
  sandboxMode: SandboxMode
  mode: 'run' | 'sync'
  onStatusChange?: DeliverableStatusCallback
  model?: string
  planModel?: string
  maxThinkingTokens?: number
  allowDestructive?: boolean
}

export function createAgentClientFactory(
  options: AgentClientFactoryOptions,
): AgentClientFactoryResult {
  const {
    projectDir,
    config,
    repository,
    sandboxMode,
    mode,
    onStatusChange,
    model,
    planModel,
    maxThinkingTokens,
    allowDestructive = false,
  } = options

  const preToolUseHooks = createPreToolUseHooks(
    config,
    mode,
    allowDestructive,
    projectDir,
  )
  const sandbox = sandboxMode.disabled ? undefined : config.sandbox

  if (mode === 'sync') {
    return buildSyncFactory(
      projectDir,
      config,
      repository,
      onStatusChange,
      sandbox,
      preToolUseHooks,
      model,
      planModel,
      maxThinkingTokens,
    )
  }

  return {
    factory: buildRunFactory(
      projectDir,
      config,
      repository,
      onStatusChange,
      sandbox,
      preToolUseHooks,
      model,
      planModel,
      maxThinkingTokens,
    ),
  }
}

function createPreToolUseHooks(
  config: AgentConfig,
  mode: 'run' | 'sync',
  allowDestructive: boolean,
  projectDir: string,
): PreToolUseHook[] {
  const bashSecurity = new DefaultBashSecurity({
    ...config.bashSecurity,
    mode,
    allowDestructive,
    projectDir,
  })

  const bashHook = createBashSecurityHook(bashSecurity)

  if (mode === 'sync') {
    return [bashHook, createSyncWriteRestrictionHook()]
  }

  return [bashHook, createAutonoeProtectionHook()]
}

function buildRunFactory(
  projectDir: string,
  config: AgentConfig,
  repository: FileDeliverableRepository,
  onStatusChange: DeliverableStatusCallback | undefined,
  sandbox: AgentConfig['sandbox'] | undefined,
  preToolUseHooks: PreToolUseHook[],
  model: string | undefined,
  planModel: string | undefined,
  maxThinkingTokens: number | undefined,
): AgentClientFactory {
  return {
    create: (instructionName: InstructionName) => {
      const isPlanning = Workflow.run.isPlanningInstruction(instructionName)
      const selectedModel = isPlanning
        ? (planModel ?? DEFAULT_PLANNING_MODEL)
        : (model ?? DEFAULT_CODING_MODEL)

      const { server: deliverableMcpServer, allowedTools: deliverableTools } =
        createDeliverableMcpServer(repository, {
          toolSet: instructionName,
          onStatusChange,
        })

      return new ClaudeAgentClient({
        cwd: projectDir,
        sandbox,
        mcpServers: config.mcpServers,
        preToolUseHooks,
        sdkMcpServers: [deliverableMcpServer],
        allowedTools: [...config.allowedTools, ...deliverableTools],
        model: selectedModel,
        maxThinkingTokens,
      })
    },
  }
}

function buildSyncFactory(
  projectDir: string,
  config: AgentConfig,
  repository: FileDeliverableRepository,
  onStatusChange: DeliverableStatusCallback | undefined,
  sandbox: AgentConfig['sandbox'] | undefined,
  preToolUseHooks: PreToolUseHook[],
  model: string | undefined,
  planModel: string | undefined,
  maxThinkingTokens: number | undefined,
): AgentClientFactoryResult {
  let verificationTracker: VerificationTracker | undefined

  const factory: AgentClientFactory = {
    create: (instructionName: InstructionName) => {
      const isPlanning = Workflow.sync.isPlanningInstruction(instructionName)
      const selectedModel = isPlanning
        ? (planModel ?? DEFAULT_PLANNING_MODEL)
        : (model ?? DEFAULT_CODING_MODEL)

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
        sandbox,
        mcpServers: config.mcpServers,
        preToolUseHooks,
        sdkMcpServers: [deliverableMcpServer],
        allowedTools: [...config.allowedTools, ...deliverableTools],
        model: selectedModel,
        maxThinkingTokens,
      })
    },
  }

  return {
    factory,
    getVerificationTracker: () => verificationTracker,
  }
}
