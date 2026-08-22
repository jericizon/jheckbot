import { mkdirSync, readdirSync, realpathSync, rmSync, statSync, existsSync } from 'node:fs'
import { join, relative, isAbsolute, basename, extname } from 'node:path'

export interface ScreenshotRecord {
  filename: string
  url: string
  size: number
  createdAt: string
}

const PNG_EXT = '.png'

/**
 * Stores and serves agent-captured screenshots on the filesystem.
 * Each conversation gets a subdirectory under the configured root.
 * All path resolution is guarded against traversal — only files that
 * resolve inside the conversation directory are exposed.
 */
export class ScreenshotService {
  constructor(private readonly rootDir: string) {}

  /** Ensure the conversation directory exists and return its absolute path. */
  ensureConversationDir(conversationId: string): string {
    const dir = this.conversationDir(conversationId)
    mkdirSync(dir, { recursive: true })
    return dir
  }

  /** Absolute directory for a conversation. */
  conversationDir(conversationId: string): string {
    return join(this.rootDir, conversationId)
  }

  /**
   * Resolve a requested filename to an absolute path inside the conversation
   * directory, or null if the path would escape that directory. The filename
   * must be a bare PNG name (no path separators, no traversal).
   */
  resolveSafePath(conversationId: string, filename: string): string | null {
    const safeName = basename(filename)
    if (safeName !== filename) return null
    if (extname(safeName).toLowerCase() !== PNG_EXT) return null

    const dir = this.conversationDir(conversationId)
    const candidate = join(dir, safeName)
    if (!existsSync(candidate)) return null

    // Guard against symlink traversal outside the conversation dir.
    const dirReal = this.safeRealpath(dir)
    const candidateReal = this.safeRealpath(candidate)
    if (!dirReal || !candidateReal) return null
    const rel = relative(dirReal, candidateReal)
    if (rel.startsWith('..') || isAbsolute(rel) || rel === '') return null
    return candidateReal
  }

  /** List all screenshots for a conversation, newest first. */
  listScreenshots(conversationId: string): ScreenshotRecord[] {
    const dir = this.conversationDir(conversationId)
    if (!existsSync(dir)) return []
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return []
    }
    const records: ScreenshotRecord[] = []
    for (const name of entries) {
      if (extname(name).toLowerCase() !== PNG_EXT) continue
      const abs = join(dir, name)
      try {
        const stat = statSync(abs)
        if (!stat.isFile()) continue
        records.push({
          filename: name,
          url: this.publicUrl(conversationId, name),
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        })
      } catch {
        // skip unreadable files
      }
    }
    records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return records
  }

  /**
   * Scan for screenshots newer than the known set. Returns filenames that
   * are not yet in `known`. Used by the agent watcher to detect new PNGs
   * written by the agent's browser automation tool.
   */
  scanForNew(conversationId: string, known: Set<string>): string[] {
    const dir = this.conversationDir(conversationId)
    if (!existsSync(dir)) return []
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return []
    }
    const fresh: string[] = []
    for (const name of entries) {
      if (extname(name).toLowerCase() !== PNG_EXT) continue
      if (known.has(name)) continue
      fresh.push(name)
    }
    return fresh.sort()
  }

  /** Public URL path for a screenshot, served by the screenshot route. */
  publicUrl(conversationId: string, filename: string): string {
    return `/api/conversations/${conversationId}/screenshots/${filename}`
  }

  /** Markdown image link suitable for embedding in an assistant message. */
  markdownImage(conversationId: string, filename: string): string {
    return `![screenshot](${this.publicUrl(conversationId, filename)})`
  }

  /** Remove all screenshots for a conversation. Called on conversation delete. */
  deleteConversationScreenshots(conversationId: string): void {
    const dir = this.conversationDir(conversationId)
    if (!existsSync(dir)) return
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
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
