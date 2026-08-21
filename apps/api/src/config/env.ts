import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv, type RuntimeEnv } from './env-validation.js'

// Load .env from the monorepo root — try several candidate paths.
// dotenv does not override variables already present in process.env, so
// explicit environment values (including test fixtures) always win.
for (const candidate of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../.env'),
  resolve(process.cwd(), '../../.env'),
]) {
  if (existsSync(candidate)) {
    config({ path: candidate })
    break
  }
}

export const env = loadEnv()
export type Env = RuntimeEnv
