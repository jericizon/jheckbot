#!/usr/bin/env node
// Expose the local JheckBot dev server through a Cloudflare quick tunnel.
// Requires `cloudflared` (https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)
// and `pnpm dev` to already be running on port 8800.
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'

const PORT = Number(process.env.JHECKBOT_TUNNEL_PORT) || 8800
const ORIGIN = `http://localhost:${PORT}`
const TUNNEL_URL_RE = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/

function isPortOpen(port, host = 'localhost', timeout = 1000) {
  return new Promise((resolve) => {
    const socket = createConnection(port, host)
    let settled = false

    function done(value) {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }

    socket.setTimeout(timeout)
    socket.on('connect', () => done(true))
    socket.on('error', () => done(false))
    socket.on('timeout', () => done(false))
  })
}

async function waitForPort(port, maxAttempts = 10, delayMs = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortOpen(port)) return true
    if (i < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return false
}

function isCloudflaredInstalled() {
  return new Promise((resolve) => {
    const proc = spawn('cloudflared', ['--version'], { stdio: 'ignore' })
    proc.on('error', () => resolve(false))
    proc.on('close', (code) => resolve(code === 0))
  })
}

async function main() {
  const hasCloudflared = await isCloudflaredInstalled()
  if (!hasCloudflared) {
    console.error('cloudflared is not installed or not in PATH.')
    console.error(
      'Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/',
    )
    process.exit(1)
  }

  console.log(`Waiting for JheckBot at ${ORIGIN}...`)
  const open = await waitForPort(PORT)
  if (!open) {
    console.error(`JheckBot is not reachable on port ${PORT}.`)
    console.error('Start the dev server first: pnpm dev')
    process.exit(1)
  }

  console.log(`Creating Cloudflare quick tunnel to ${ORIGIN}...`)
  console.log('Press Ctrl+C to stop the tunnel.\n')

  const proc = spawn('cloudflared', ['tunnel', '--url', ORIGIN], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let printed = false

  function handleData(data, stream) {
    const text = data.toString()
    const match = text.match(TUNNEL_URL_RE)
    if (match && !printed) {
      printed = true
      console.log('='.repeat(60))
      console.log(' Tunnel URL:')
      console.log(` ${match[0]}`)
      console.log('='.repeat(60))
      console.log('\nWARNING: Quick Tunnels do not support Server-Sent Events (SSE).')
      console.log('Live agent output in the chat may not work over this tunnel.')
      console.log('For a production tunnel with SSE support, see deploy/README.md.\n')
    }
    stream.write(data)
  }

  proc.stdout.on('data', (data) => handleData(data, process.stdout))
  proc.stderr.on('data', (data) => handleData(data, process.stderr))

  proc.on('close', (code) => {
    process.exit(code ?? 0)
  })

  function forward(signal) {
    return () => {
      proc.kill(signal)
    }
  }

  process.on('SIGINT', forward('SIGINT'))
  process.on('SIGTERM', forward('SIGTERM'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
