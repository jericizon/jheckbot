#!/usr/bin/env node
// Kills any processes holding the JheckBot dev ports (8800, 8801)
// so `pnpm dev` always starts cleanly without port conflicts.
import { execSync } from 'node:child_process'

const PORTS = [8800, 8801]

for (const port of PORTS) {
  try {
    const pids = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean)
    if (pids.length === 0) continue
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGTERM')
        console.log(`Killed PID ${pid} on port ${port}`)
      } catch {
        // Process may have already exited
      }
    }
    // Give processes time to release the port
    execSync('sleep 1')
  } catch {
    // No process on this port
  }
}

console.log('Ports 8800 and 8801 are free.')
