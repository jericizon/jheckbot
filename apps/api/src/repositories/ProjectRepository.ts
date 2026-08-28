import { resolve, sep } from 'node:path'
import { pool, withTransaction } from '../db/pool.js'
import type { AllowedRoot } from '../services/PathValidator.js'

export interface ProjectRecord {
  id: string
  name: string
  slug: string
  path: string
  description: string | null
  enabled: boolean
  default_provider_id: string | null
  default_provider_config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export class ProjectRepository {
  async findAll(): Promise<ProjectRecord[]> {
    const { rows } = await pool.query<ProjectRecord>(
      'SELECT * FROM projects ORDER BY created_at DESC',
    )
    return rows
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const { rows } = await pool.query<ProjectRecord>(
      'SELECT * FROM projects WHERE id = $1',
      [id],
    )
    return rows[0] ?? null
  }

  async findBySlug(slug: string): Promise<ProjectRecord | null> {
    const { rows } = await pool.query<ProjectRecord>(
      'SELECT * FROM projects WHERE slug = $1',
      [slug],
    )
    return rows[0] ?? null
  }

  async create(data: {
    name: string
    slug: string
    path: string
    description?: string
    defaultProviderId?: string
    defaultProviderConfig?: Record<string, unknown> | null
  }): Promise<ProjectRecord> {
    const { rows } = await pool.query<ProjectRecord>(
      `INSERT INTO projects (name, slug, path, description, default_provider_id, default_provider_config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.slug,
        data.path,
        data.description ?? null,
        data.defaultProviderId ?? null,
        data.defaultProviderConfig ? JSON.stringify(data.defaultProviderConfig) : null,
      ],
    )
    return rows[0]
  }

  async update(
    id: string,
    data: {
      name?: string
      description?: string
      enabled?: boolean
      defaultProviderId?: string
      defaultProviderConfig?: Record<string, unknown> | null
    },
  ): Promise<ProjectRecord | null> {
    const existing = await this.findById(id)
    if (!existing) return null

    const { rows } = await pool.query<ProjectRecord>(
      `UPDATE projects
       SET name = $1, description = $2, enabled = $3, default_provider_id = $4,
           default_provider_config = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        data.name ?? existing.name,
        data.description ?? existing.description,
        data.enabled ?? existing.enabled,
        data.defaultProviderId ?? existing.default_provider_id,
        data.defaultProviderConfig !== undefined
          ? (data.defaultProviderConfig ? JSON.stringify(data.defaultProviderConfig) : null)
          : existing.default_provider_config,
        id,
      ],
    )
    return rows[0] ?? null
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM projects WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }

  // Cascades to conversations, messages, and agent_events via ON DELETE CASCADE
  async deleteAll(): Promise<number> {
    const result = await pool.query('DELETE FROM projects')
    return result.rowCount ?? 0
  }

  async findAllowedRoots(): Promise<AllowedRoot[]> {
    const { rows } = await pool.query<AllowedRoot>(
      'SELECT id, name, path, enabled FROM allowed_roots WHERE enabled = TRUE ORDER BY created_at',
    )
    return rows
  }

  /**
   * Synchronize configured roots into the allowed_roots table idempotently.
   * Configured roots are inserted or re-enabled; rows absent from the
   * configured set are disabled (never deleted) so existing projects keep
   * their foreign-key references intact.
   */
  async syncAllowedRoots(paths: string[]): Promise<void> {
    // Canonicalize and deduplicate before persistence.
    const seen = new Set<string>()
    const canonical: string[] = []
    for (const raw of paths) {
      const resolved = resolve(raw)
      if (seen.has(resolved)) continue
      seen.add(resolved)
      canonical.push(resolved)
    }

    await withTransaction(async (client) => {
      for (const path of canonical) {
        const name = path.split(sep).filter(Boolean).pop() ?? path
        await client.query(
          `INSERT INTO allowed_roots (name, path, enabled)
           VALUES ($1, $2, TRUE)
           ON CONFLICT (path) DO UPDATE SET enabled = TRUE, updated_at = NOW()`,
          [name, path],
        )
      }

      if (canonical.length > 0) {
        await client.query(
          `UPDATE allowed_roots SET enabled = FALSE, updated_at = NOW()
           WHERE path <> ALL($1::text[])`,
          [canonical],
        )
      }
    })
  }
}
