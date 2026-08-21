import { realpathSync, statSync, accessSync, constants, existsSync } from 'node:fs'
import { resolve, relative, isAbsolute, join, sep } from 'node:path'

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

  /**
   * Resolve a path against the allowed roots. Accepts both:
   * - Relative paths: "/projects/example-repo" or "projects/example-repo"
   *   → tried as <allowed-root>/projects/example-repo
   * - Absolute paths: "/workspace/projects/example-repo"
   *   → validated directly
   *
   * For relative resolution, the directory must exist and contain a `.git` folder.
   */
  resolveRelative(candidatePath: string): PathValidationResult {
    const trimmed = candidatePath.trim()
    if (!trimmed) {
      return { valid: false, error: 'Path is required' }
    }

    // Try relative resolution against each allowed root first.
    // Strip leading slashes so "/projects/example-repo" becomes "projects/example-repo".
    const relativePath = trimmed.replace(/^\/+/, '')

    for (const root of this.allowedRoots) {
      if (!root.enabled) continue

      const rootReal = this.safeRealpath(root.path)
      if (!rootReal) continue

      const candidate = join(rootReal, relativePath)
      const candidateReal = this.safeRealpath(candidate)
      if (!candidateReal) continue

      const rel = relative(rootReal, candidateReal)
      if (rel.startsWith('..') || isAbsolute(rel)) continue

      try {
        const stat = statSync(candidateReal)
        if (!stat.isDirectory()) continue
      } catch {
        continue
      }

      if (!existsSync(join(candidateReal, '.git'))) {
        return {
          valid: false,
          error: `Directory exists but is not a git repository (no .git folder found in ${candidateReal})`,
        }
      }

      try {
        accessSync(candidateReal, constants.R_OK)
      } catch {
        continue
      }

      return { valid: true, resolvedPath: candidateReal }
    }

    // Fall back to absolute path validation for full paths that don't
    // match any root via relative join. validate() checks containment,
    // existence, and readability but NOT the .git policy, so enforce it
    // here to keep the project-path contract consistent.
    if (isAbsolute(trimmed)) {
      const result = this.validate(trimmed)
      if (!result.valid || !result.resolvedPath) {
        return result
      }
      if (!existsSync(join(result.resolvedPath, '.git'))) {
        return {
          valid: false,
          error: 'Directory is not a git repository (no .git folder found)',
        }
      }
      return result
    }

    return {
      valid: false,
      error: 'Directory not found under any allowed root. Make sure the path is relative to an allowed root and the directory exists with a .git folder.',
    }
  }

  private safeRealpath(p: string): string | null {
    try {
      return realpathSync(p)
    } catch {
      return null
    }
  }
}
