import { pool } from '../db/pool.js'
import type { AllowedRoot } from '../services/PathValidator.js'

export interface ProjectRecord {
  id: string
  name: string
  slug: string
  path: string
  description: string | null
  enabled: boolean
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
  }): Promise<ProjectRecord> {
    const { rows } = await pool.query<ProjectRecord>(
      `INSERT INTO projects (name, slug, path, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.slug, data.path, data.description ?? null],
    )
    return rows[0]
  }

  async update(
    id: string,
    data: { name?: string; description?: string; enabled?: boolean },
  ): Promise<ProjectRecord | null> {
    const existing = await this.findById(id)
    if (!existing) return null

    const { rows } = await pool.query<ProjectRecord>(
      `UPDATE projects
       SET name = $1, description = $2, enabled = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        data.name ?? existing.name,
        data.description ?? existing.description,
        data.enabled ?? existing.enabled,
        id,
      ],
    )
    return rows[0] ?? null
  }

  async delete(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM projects WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }

  async findAllowedRoots(): Promise<AllowedRoot[]> {
    const { rows } = await pool.query<AllowedRoot>(
      'SELECT id, name, path, enabled FROM allowed_roots WHERE enabled = TRUE ORDER BY created_at',
    )
    return rows
  }
}
