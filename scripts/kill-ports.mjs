#!/usr/bin/env node
// Explicit opt-in utility: terminates processes holding the JheckBot dev ports
// (8800, 8801) so a fresh `pnpm dev` can start without port conflicts.
// This is NOT run automatically — invoke via `pnpm dev:clean` when needed.
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

console.log('JheckBot dev ports (8800, 8801) are free.')
