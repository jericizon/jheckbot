import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function runMigrations(): Promise<void> {
  const migrationsDir = join(__dirname, '..', '..', 'migrations')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const { rows: applied } = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations',
  )
  const appliedSet = new Set(applied.map((r) => r.filename))

  for (const file of files) {
    if (appliedSet.has(file)) continue

    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    await pool.query('BEGIN')
    try {
      await pool.query(sql)
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      await pool.query('COMMIT')
      console.log(`Migration applied: ${file}`)
    } catch (err) {
      await pool.query('ROLLBACK')
      throw new Error(`Migration failed: ${file} — ${err}`)
    }
  }
}
