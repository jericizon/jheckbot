import type { OfficeAgent, OfficeAgentCapability, AgentStatus } from '@jheckbot/shared'
import { pool, type DbExecutor } from '../db/pool.js'

export interface OfficeAgentRecord {
  id: string
  office_id: string
  name: string
  role: string | null
  description: string | null
  avatar: string | null
  personality: string | null
  instructions: string | null
  responsibilities: string | null
  provider: string | null
  model: string | null
  skills: unknown
  tools: unknown
  permissions: unknown
  project_access: unknown
  status: string
  enabled: boolean
  created_at: unknown
  updated_at: unknown
}

export interface OfficeAgentCapabilityRecord {
  id: string
  agent_id: string
  capability: string
  created_at: unknown
}

function asIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return String(value ?? '')
}

function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value as string[]
  return undefined
}

function parseRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  return undefined
}

export function toOfficeAgent(row: OfficeAgentRecord): OfficeAgent {
  return {
    id: row.id,
    officeId: row.office_id,
    name: row.name,
    role: row.role ?? '',
    description: row.description ?? undefined,
    avatar: row.avatar ?? undefined,
    personality: row.personality ?? undefined,
    instructions: row.instructions ?? undefined,
    responsibilities: row.responsibilities ?? undefined,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    skills: parseStringArray(row.skills),
    tools: parseStringArray(row.tools),
    permissions: parseRecord(row.permissions),
    projectAccess: parseStringArray(row.project_access),
    status: row.status as AgentStatus,
    enabled: row.enabled,
    createdAt: asIsoString(row.created_at),
    updatedAt: asIsoString(row.updated_at),
  }
}

export function toOfficeAgentCapability(row: OfficeAgentCapabilityRecord): OfficeAgentCapability {
  return {
    id: row.id,
    agentId: row.agent_id,
    capability: row.capability,
    createdAt: asIsoString(row.created_at),
  }
}

function jsonbOrNull(value: string[] | Record<string, unknown> | undefined): string | null {
  if (value === undefined) return null
  return JSON.stringify(value)
}

export interface OfficeAgentCreateData {
  officeId: string
  name: string
  role: string
  description?: string
  avatar?: string
  personality?: string
  instructions?: string
  responsibilities?: string
  provider?: string
  model?: string
  skills?: string[]
  tools?: string[]
  permissions?: Record<string, unknown>
  projectAccess?: string[]
  status?: AgentStatus
  enabled?: boolean
}

export interface OfficeAgentUpdateData {
  name?: string
  role?: string
  description?: string
  avatar?: string
  personality?: string
  instructions?: string
  responsibilities?: string
  provider?: string
  model?: string
  skills?: string[]
  tools?: string[]
  permissions?: Record<string, unknown>
  projectAccess?: string[]
  status?: AgentStatus
  enabled?: boolean
}

export class OfficeAgentRepository {
  async create(data: OfficeAgentCreateData, executor: DbExecutor = pool): Promise<OfficeAgent> {
    const { rows } = await executor.query<OfficeAgentRecord>(
      `INSERT INTO agents (
        office_id, name, role, description, avatar, personality, instructions,
        responsibilities, provider, model, skills, tools, permissions, project_access,
        status, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        data.officeId,
        data.name,
        data.role,
        data.description ?? null,
        data.avatar ?? null,
        data.personality ?? null,
        data.instructions ?? null,
        data.responsibilities ?? null,
        data.provider ?? null,
        data.model ?? null,
        jsonbOrNull(data.skills),
        jsonbOrNull(data.tools),
        jsonbOrNull(data.permissions),
        jsonbOrNull(data.projectAccess),
        data.status ?? 'idle',
        data.enabled ?? true,
      ],
    )
    return toOfficeAgent(rows[0])
  }

  async listByOffice(officeId: string, executor: DbExecutor = pool): Promise<OfficeAgent[]> {
    const { rows } = await executor.query<OfficeAgentRecord>(
      'SELECT * FROM agents WHERE office_id = $1 ORDER BY created_at DESC',
      [officeId],
    )
    return rows.map(toOfficeAgent)
  }

  async getById(id: string, executor: DbExecutor = pool): Promise<OfficeAgent | null> {
    const { rows } = await executor.query<OfficeAgentRecord>(
      'SELECT * FROM agents WHERE id = $1',
      [id],
    )
    return rows[0] ? toOfficeAgent(rows[0]) : null
  }

  async update(
    id: string,
    data: OfficeAgentUpdateData,
    executor: DbExecutor = pool,
  ): Promise<OfficeAgent | null> {
    const existing = await this.getById(id, executor)
    if (!existing) return null

    const { rows } = await executor.query<OfficeAgentRecord>(
      `UPDATE agents
       SET name = $1, role = $2, description = $3, avatar = $4, personality = $5,
           instructions = $6, responsibilities = $7, provider = $8, model = $9,
           skills = $10, tools = $11, permissions = $12, project_access = $13,
           status = $14, enabled = $15, updated_at = NOW()
       WHERE id = $16
       RETURNING *`,
      [
        data.name ?? existing.name,
        data.role ?? existing.role,
        data.description !== undefined ? (data.description ?? null) : (existing.description ?? null),
        data.avatar !== undefined ? (data.avatar ?? null) : (existing.avatar ?? null),
        data.personality !== undefined ? (data.personality ?? null) : (existing.personality ?? null),
        data.instructions !== undefined ? (data.instructions ?? null) : (existing.instructions ?? null),
        data.responsibilities !== undefined ? (data.responsibilities ?? null) : (existing.responsibilities ?? null),
        data.provider !== undefined ? (data.provider ?? null) : (existing.provider ?? null),
        data.model !== undefined ? (data.model ?? null) : (existing.model ?? null),
        data.skills !== undefined ? jsonbOrNull(data.skills) : jsonbOrNull(existing.skills),
        data.tools !== undefined ? jsonbOrNull(data.tools) : jsonbOrNull(existing.tools),
        data.permissions !== undefined ? jsonbOrNull(data.permissions) : jsonbOrNull(existing.permissions),
        data.projectAccess !== undefined ? jsonbOrNull(data.projectAccess) : jsonbOrNull(existing.projectAccess),
        data.status ?? existing.status,
        data.enabled ?? existing.enabled,
        id,
      ],
    )
    return rows[0] ? toOfficeAgent(rows[0]) : null
  }

  async delete(id: string, executor: DbExecutor = pool): Promise<boolean> {
    const result = await executor.query('DELETE FROM agents WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }

  async listCapabilities(
    agentId: string,
    executor: DbExecutor = pool,
  ): Promise<OfficeAgentCapability[]> {
    const { rows } = await executor.query<OfficeAgentCapabilityRecord>(
      'SELECT * FROM agent_capabilities WHERE agent_id = $1 ORDER BY created_at DESC',
      [agentId],
    )
    return rows.map(toOfficeAgentCapability)
  }

  async addCapability(
    agentId: string,
    capability: string,
    executor: DbExecutor = pool,
  ): Promise<OfficeAgentCapability | null> {
    const { rows } = await executor.query<OfficeAgentCapabilityRecord>(
      `INSERT INTO agent_capabilities (agent_id, capability)
       VALUES ($1, $2)
       ON CONFLICT (agent_id, capability) DO NOTHING
       RETURNING *`,
      [agentId, capability],
    )
    if (rows[0]) return toOfficeAgentCapability(rows[0])

    const { rows: existing } = await executor.query<OfficeAgentCapabilityRecord>(
      'SELECT * FROM agent_capabilities WHERE agent_id = $1 AND capability = $2',
      [agentId, capability],
    )
    return existing[0] ? toOfficeAgentCapability(existing[0]) : null
  }

  async removeCapability(
    agentId: string,
    capability: string,
    executor: DbExecutor = pool,
  ): Promise<boolean> {
    const result = await executor.query(
      'DELETE FROM agent_capabilities WHERE agent_id = $1 AND capability = $2',
      [agentId, capability],
    )
    return (result.rowCount ?? 0) > 0
  }
}
