import { withTransaction, type DbExecutor } from '../db/pool.js'
import { AgentManager, AgentManagerError, type AgentRun } from '../agent/AgentManager.js'
import { ConversationRepository, type ConversationRecord } from '../repositories/ConversationRepository.js'
import { ProjectRepository } from '../repositories/ProjectRepository.js'
import { MessageRepository, type MessageRecord } from '../repositories/MessageRepository.js'
import { AgentEventRepository } from '../repositories/AgentEventRepository.js'
import { PathValidator, type AllowedRoot } from '../services/PathValidator.js'
import { DEFAULT_DEVIN_MODEL } from '@jheckbot/shared'

const MAX_PROMPT_BYTES = 32 * 1024
const MAX_ACTIVE_RUNS = 3
const ADVISORY_LOCK_KEY = 0x4a656372 // 'Jecr' — fixed global prompt-submission lock

export interface PromptSendInput {
  conversationId: string
  prompt: string
  model?: string
  bypass?: boolean
}

export interface PromptSendResult {
  message: MessageRecord
  run: AgentRun
}

type PathValidatorFactory = (roots: AllowedRoot[]) => PathValidator

export class PromptExecutionService {
  constructor(
    private agentManager: AgentManager,
    private conversationRepo: ConversationRepository,
    private projectRepo: ProjectRepository,
    private messageRepo: MessageRepository,
    private eventRepo: AgentEventRepository,
    private pathValidatorFactory?: PathValidatorFactory,
  ) {}

  async send(input: PromptSendInput): Promise<PromptSendResult> {
    if (!input.conversationId?.trim()) {
      throw new PromptExecutionError('Conversation ID is required', 400)
    }
    if (!input.prompt?.trim()) {
      throw new PromptExecutionError('Prompt content is required', 400)
    }
    if (Buffer.byteLength(input.prompt, 'utf8') > MAX_PROMPT_BYTES) {
      throw new PromptExecutionError('Prompt content exceeds 32KB limit', 400)
    }

    return withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [ADVISORY_LOCK_KEY])

      const conversation = await this.conversationRepo.findByIdForUpdate(
        input.conversationId,
        client as DbExecutor,
      )
      if (!conversation) {
        throw new PromptExecutionError('Conversation not found', 404)
      }

      const project = await this.projectRepo.findById(conversation.project_id)
      if (!project) {
        throw new PromptExecutionError('Project not found', 404)
      }
      if (!project.enabled) {
        throw new PromptExecutionError('Project is disabled', 400)
      }

      let cwd = project.path
      if (this.pathValidatorFactory) {
        const roots = await this.projectRepo.findAllowedRoots()
        const validator = this.pathValidatorFactory(roots)
        const pathResult = validator.resolveRelative(project.path)
        if (!pathResult.valid || !pathResult.resolvedPath) {
          throw new PromptExecutionError(`Project path invalid: ${pathResult.error}`, 400)
        }
        cwd = pathResult.resolvedPath
      }

      if (this.agentManager.isConversationActive(input.conversationId)) {
        throw new AgentManagerError('Agent is currently working', 409)
      }

      // Reconcile stale in-memory locks: the lock may persist if a previous
      // run's watcher failed to clean up (e.g. API restart mid-run). This
      // checks whether the tmux session is actually still alive and clears
      // the lock if not.
      await this.agentManager.reconcileStaleLock(input.conversationId)
      if (this.agentManager.isConversationActive(input.conversationId)) {
        throw new AgentManagerError('Agent is currently working', 409)
      }

      const activeCount = await this.conversationRepo.countActiveAgents(client as DbExecutor)
      if (activeCount >= MAX_ACTIVE_RUNS) {
        throw new AgentManagerError('Maximum concurrent agent sessions reached', 429)
      }

      const requestedModel = input.model?.trim() || DEFAULT_DEVIN_MODEL

      const message = await this.messageRepo.create(
        {
          conversationId: input.conversationId,
          role: 'user',
          content: input.prompt,
          messageType: 'prompt',
          model: requestedModel,
        },
        client as DbExecutor,
      )

      // Auto-generate title from the first prompt if title is still default
      if (conversation.title === 'New Conversation') {
        const title = this.generateTitle(input.prompt)
        await this.conversationRepo.update(
          input.conversationId,
          { title },
          client as DbExecutor,
        )
      }

      await this.conversationRepo.setAgentStatus(
        input.conversationId,
        'starting',
        client as DbExecutor,
      )

      // Honor model selection. Devin CLI ignores --model when resuming a session,
      // so if the requested model differs from the one used by the active session
      // we must clear the session ID and start fresh.
      const currentModel = await this.resolveCurrentModel(conversation, client as DbExecutor)

      if (currentModel !== null && currentModel !== requestedModel) {
        // Model changed mid-conversation: discard the resumed session so the
        // new model is actually used. The old tmux session is cleaned up before
        // the next session is launched.
        await this.conversationRepo.clearAgentSessionId(
          input.conversationId,
          client as DbExecutor,
        )
        conversation.agent_session_id = null
      }

      await this.conversationRepo.update(
        input.conversationId,
        {
          providerConfig: {
            ...(conversation.provider_config ?? {}),
            model: requestedModel,
          },
        },
        client as DbExecutor,
      )

      let prepared: ReturnType<typeof this.agentManager.prepareRun> | undefined
      try {
        prepared = this.agentManager.prepareRun({
          conversationId: input.conversationId,
          projectId: project.id,
          projectSlug: project.slug,
          cwd,
          prompt: input.prompt,
          devinSessionId: conversation.agent_session_id ?? undefined,
          model: requestedModel,
          userMessageId: message.id,
          bypass: input.bypass,
        })

        await this.eventRepo.create(
          {
            conversationId: input.conversationId,
            eventType: 'status',
            content: JSON.stringify({ status: 'starting' }),
          },
          client as DbExecutor,
        )
      } catch (error) {
        prepared?.rollback()
        throw error
      }

      // Transaction commits here. The prepared run is committed only after
      // the database transaction succeeds, so a rollback never leaves an
      // orphaned user message.
      const preparedRun = prepared
      return {
        message,
        preparedRun,
      }
    }).then(({ message, preparedRun }) => {
      const run = preparedRun.commit()
      return { message, run }
    })
  }

  private generateTitle(prompt: string): string {
    const trimmed = prompt.trim()
    if (trimmed.length <= 60) return trimmed
    return trimmed.slice(0, 57).trimEnd() + '...'
  }

  private async resolveCurrentModel(
    conversation: ConversationRecord,
    executor: DbExecutor,
  ): Promise<string | null> {
    const configured = conversation.provider_config?.model
    if (typeof configured === 'string' && configured.trim()) {
      return configured
    }

    if (conversation.agent_session_id) {
      const last = await this.messageRepo.findLastAssistantMessage(conversation.id, executor)
      return last?.model ?? null
    }

    return null
  }
}

export class PromptExecutionError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'PromptExecutionError'
    this.statusCode = statusCode
  }
}
