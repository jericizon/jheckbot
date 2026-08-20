import { realpathSync, statSync, accessSync, constants } from 'node:fs'
import { resolve, relative, isAbsolute, sep } from 'node:path'

export interface AllowedRoot {
  id: string
  name: string
  path: string
  enabled: boolean
}

export interface PathValidationResult {
  valid: boolean
  resolvedPath?: string
  error?: string
}

/**
 * Validates that a project path is safe:
 * 1. Must be absolute
 * 2. Must be under an enabled allowed root
 * 3. Must resolve to a real directory (no symlink traversal outside allowed root)
 * 4. Must be readable
 *
 * Protects against:
 * - `..` traversal
 * - symlink traversal outside allowed root
 * - arbitrary absolute paths
 * - deleted/replaced directories
 */
export class PathValidator {
  constructor(private allowedRoots: AllowedRoot[]) {}

  /**
   * Resolve and validate a candidate path against the allowed roots.
   * Returns the real filesystem path if valid, or an error description.
   */
  validate(candidatePath: string): PathValidationResult {
    if (!isAbsolute(candidatePath)) {
      return { valid: false, error: 'Path must be absolute' }
    }

    const normalizedPath = resolve(candidatePath)

    // Check against each enabled allowed root using realpath
    for (const root of this.allowedRoots) {
      if (!root.enabled) continue

      const rootReal = this.safeRealpath(root.path)
      if (!rootReal) continue

      const candidateReal = this.safeRealpath(normalizedPath)
      if (!candidateReal) {
        return { valid: false, error: 'Path does not exist' }
      }

      const rel = relative(rootReal, candidateReal)
      if (rel.startsWith('..') || isAbsolute(rel)) {
        // Not inside this root — try the next one
        continue
      }

      // Path is inside an allowed root — verify it's a readable directory
      try {
        const stat = statSync(candidateReal)
        if (!stat.isDirectory()) {
          return { valid: false, error: 'Path is not a directory' }
        }
      } catch {
        return { valid: false, error: 'Path is not accessible' }
      }

      try {
        accessSync(candidateReal, constants.R_OK)
      } catch {
        return { valid: false, error: 'Directory is not readable' }
      }

      return { valid: true, resolvedPath: candidateReal }
    }

    return { valid: false, error: 'Path is not under any allowed root' }
  }

  private safeRealpath(p: string): string | null {
    try {
      return realpathSync(p)
    } catch {
      return null
    }
  }
}
