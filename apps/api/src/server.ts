import { createApp } from './app.js'
import { env } from './config/env.js'
import { runMigrations } from './db/migrate.js'
import { closePool } from './db/pool.js'
import { ProjectRepository } from './repositories/ProjectRepository.js'
import { UserRepository } from './repositories/UserRepository.js'
import { AuthService } from './services/AuthService.js'
import type { AgentManager } from './agent/AgentManager.js'

async function main() {
  try {
    await runMigrations()
    console.log('Database migrations complete')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }

  // Synchronize configured allowed roots before any project validation runs.
  try {
    const projectRepo = new ProjectRepository()
    await projectRepo.syncAllowedRoots(env.allowedRoots)
    console.log('Allowed roots synchronized')
  } catch (err) {
    console.error('Allowed root synchronization failed:', err)
    await closePool()
    process.exit(1)
  }

  // Seed default admin user if none exists
  const authService = new AuthService(new UserRepository())
  await authService.ensureSeedUser()

  const app = createApp()
  try {
    await (app.locals.agentManager as AgentManager).recoverSessions()
    console.log('Agent session recovery complete')
  } catch (err) {
    console.error('Agent session recovery failed:', err)
    await closePool()
    return
  }

  const server = app.listen(env.apiPort, () => {
    console.log(`JheckBot API listening on http://localhost:${env.apiPort}`)
  })

  function shutdown(signal: string) {
    console.log(`Received ${signal}, shutting down gracefully`)
    server.close(async () => {
      await closePool()
      console.log('API server closed')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main()
