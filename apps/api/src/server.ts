import { createApp } from './app.js'
import { env } from './config/env.js'
import { runMigrations } from './db/migrate.js'
import { closePool } from './db/pool.js'

async function main() {
  try {
    await runMigrations()
    console.log('Database migrations complete')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }

  const app = createApp()
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
