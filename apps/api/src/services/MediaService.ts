import { mkdirSync, readdirSync, realpathSync, rmSync, statSync, existsSync } from 'node:fs'
import { join, relative, isAbsolute, basename, extname } from 'node:path'

export interface MediaRecord {
  filename: string
  url: string
  kind: 'image' | 'video'
  mimeType: string
  size: number
  createdAt: string
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.ogv', '.m4v'])

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg',
  '.m4v': 'video/x-m4v',
}

export function mediaKind(filename: string): 'image' | 'video' | null {
  const ext = extname(filename).toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  return null
}

export function mimeTypeFor(filename: string): string {
  const ext = extname(filename).toLowerCase()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

/**
 * Stores and serves agent-captured media (images + videos) on the filesystem.
 * Each conversation gets a subdirectory under the configured root.
 * All path resolution is guarded against traversal — only files that
 * resolve inside the conversation directory are exposed.
 */
export class MediaService {
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
   * must be a bare media file name (no path separators, no traversal) with
   * a recognized image or video extension.
   */
  resolveSafePath(conversationId: string, filename: string): string | null {
    const safeName = basename(filename)
    if (safeName !== filename) return null
    if (mediaKind(safeName) === null) return null

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

  /** List all media files for a conversation, newest first. */
  listMedia(conversationId: string): MediaRecord[] {
    const dir = this.conversationDir(conversationId)
    if (!existsSync(dir)) return []
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return []
    }
    const records: MediaRecord[] = []
    for (const name of entries) {
      const kind = mediaKind(name)
      if (!kind) continue
      const abs = join(dir, name)
      try {
        const stat = statSync(abs)
        if (!stat.isFile()) continue
        records.push({
          filename: name,
          url: this.publicUrl(conversationId, name),
          kind,
          mimeType: mimeTypeFor(name),
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
   * Scan for media files newer than the known set. Returns filenames that
   * are not yet in `known`. Used by the agent watcher to detect new files
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
      if (mediaKind(name) === null) continue
      if (known.has(name)) continue
      fresh.push(name)
    }
    return fresh.sort()
  }

  /** Public URL path for a media file, served by the media route. */
  publicUrl(conversationId: string, filename: string): string {
    return `/api/conversations/${conversationId}/media/${filename}`
  }

  /** Markdown image link for both images and videos. The frontend renderer
   * detects video URLs by extension and emits a <video> tag. */
  markdownFor(conversationId: string, filename: string): string {
    const url = this.publicUrl(conversationId, filename)
    return `![media](${url})`
  }

  /** Remove all media for a conversation. Called on conversation delete. */
  deleteConversationMedia(conversationId: string): void {
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
