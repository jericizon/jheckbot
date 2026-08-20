import { createApp } from './app.js'
import { env } from './config/env.js'

const app = createApp()

const server = app.listen(env.apiPort, () => {
  console.log(`JheckBot API listening on http://localhost:${env.apiPort}`)
})

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully`)
  server.close(() => {
    console.log('API server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export { server }
