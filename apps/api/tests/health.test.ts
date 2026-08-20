import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'

describe('GET /health', () => {
  it('returns 200 with health status', async () => {
    const app = createApp()
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
    expect(res.body).toHaveProperty('services')
    expect(res.body.services).toHaveProperty('database')
    expect(res.body.services).toHaveProperty('tmux')
    expect(res.body.services).toHaveProperty('devin')
    expect(res.body).toHaveProperty('timestamp')
  })
})
