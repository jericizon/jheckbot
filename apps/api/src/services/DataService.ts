import { ProjectRepository } from '../repositories/ProjectRepository.js'
import type { AgentManager } from '../agent/AgentManager.js'

export interface ClearAllResult {
  stoppedAgents: number
  deletedProjects: number
}

/**
 * Coordinates destructive bulk operations across projects, conversations,
 * messages, and agent events. Active agent runs are stopped before any data
 * is removed so tmux sessions do not outlive their database records.
 */
export class DataService {
  constructor(
    private projectRepo: ProjectRepository,
    private agentManager: AgentManager,
  ) {}

  async clearAll(): Promise<ClearAllResult> {
    // Stop every active agent run before deleting the records they reference.
    const activeRuns = this.agentManager.listActiveRuns()
    await Promise.all(
      activeRuns.map((run) =>
        this.agentManager.stop(run.conversationId).catch(() => {
          // Best-effort stop; a session that already exited is safe to ignore.
        }),
      ),
    )

    // Deleting projects cascades to conversations, messages, and agent_events.
    const deletedProjects = await this.projectRepo.deleteAll()
    return { stoppedAgents: activeRuns.length, deletedProjects }
  }
}
