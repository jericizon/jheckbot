import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

describe('GET /health', () => {
  it('returns 200 with health status', async () => {
    const app = createApp()
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status')
    expect(res.body).toHaveProperty('services')
    expect(res.body.services).toHaveProperty('database')
    expect(res.body.services).toHaveProperty('tmux')
    expect(res.body.services).toHaveProperty('devin')
    expect(res.body).toHaveProperty('timestamp')
  })

  it('reports database status as connected or disconnected (not unknown)', async () => {
    const app = createApp()
    const res = await request(app).get('/health')

    expect(res.body.services.database).toMatch(/^(connected|disconnected)$/)
  })

  it('reports tmux status as available or missing (not unknown)', async () => {
    const app = createApp()
    const res = await request(app).get('/health')

    expect(res.body.services.tmux).toMatch(/^(available|missing)$/)
  })

  it('reports devin status as available or missing', async () => {
    const app = createApp()
    const res = await request(app).get('/health')

    expect(res.body.services.devin).toMatch(/^(available|missing)$/)
  })

  it('reports degraded status when any service is missing', async () => {
    const app = createApp()
    const res = await request(app).get('/health')

    const services = res.body.services
    const anyMissing = services.database === 'disconnected' || services.tmux === 'missing' || services.devin === 'missing'
    if (anyMissing) {
      expect(res.body.status).toBe('degraded')
    } else {
      expect(res.body.status).toBe('ok')
    }
  })
})
