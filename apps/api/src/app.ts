import express from 'express'
import type { HealthStatus } from '@jheckbot/shared'

export function createApp(): express.Express {
  const app = express()

  app.use(express.json())

  app.get('/health', (_req, res) => {
    const status: HealthStatus = {
      status: 'ok',
      services: {
        database: 'unknown',
        tmux: 'unknown',
        devin: 'unknown',
      },
      timestamp: new Date().toISOString(),
    }
    res.json(status)
  })

  return app
}
