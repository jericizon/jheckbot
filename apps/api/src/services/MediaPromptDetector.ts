/**
 * Detects when a user prompt asks the agent to capture a screenshot or
 * video recording, and appends an instruction to save the file into
 * JheckBot's media directory so it surfaces inline in the chat.
 *
 * Detection is intentionally conservative: it triggers on explicit capture
 * verbs plus "preview" requests. Ambiguous visual phrasing ("show me the
 * code") is not treated as a capture request.
 */

export type MediaIntent = 'image' | 'video' | null

// Video takes precedence: a prompt mentioning both "video" and "screenshot"
// is treated as a video request.
const VIDEO_PATTERNS: RegExp[] = [
  /\brecord\s+(?:a\s+)?(?:video|screen(?:cast| recording)?)\b/i,
  /\bvideo\s+recording\b/i,
  /\bscreen\s+recording\b/i,
  /\bscreencast\b/i,
  /\brecord\s+(?:the\s+)?(?:homepage|page|site|app|screen|flow|demo)\b/i,
  /\b\d+\s*-?\s*second\s+video\b/i,
  /\bcapture\s+(?:a\s+)?video\b/i,
]

const IMAGE_PATTERNS: RegExp[] = [
  /\bscreen\s*shot\b/i,
  /\bscreenshot\b/i,
  /\bsnapshot\b/i,
  /\btake\s+(?:a\s+)?(?:shot|screenshot|snapshot|screen\s*shot)\b/i,
  /\bcapture\s+(?:the\s+)?(?:screen|page|homepage|site|app|ui|view|screenshot)\b/i,
  /\bscreenshot\s+(?:of|preview)\b/i,
  /\bpreview\s+(?:of\s+(?:the\s+)?|the\s+)?(?:homepage|page|site|app|ui|view|screen|landing)\b/i,
  /\bshow\s+me\s+(?:a\s+)?(?:preview|screenshot|snapshot)\s+of\b/i,
  /\b(?:homepage|page|site|app|ui|view|screen|landing)\s+preview\b/i,
]

const MEDIA_DIR_REF = /\bJHECKBOT_MEDIA_DIR\b/i

/** Detect whether a prompt requests an image or video capture. */
export function detectMediaIntent(prompt: string): MediaIntent {
  if (!prompt?.trim()) return null
  if (MEDIA_DIR_REF.test(prompt)) return null // already explicit; don't double-inject
  for (const re of VIDEO_PATTERNS) if (re.test(prompt)) return 'video'
  for (const re of IMAGE_PATTERNS) if (re.test(prompt)) return 'image'
  return null
}

/**
 * Return the prompt with a media-save instruction appended, or the original
 * prompt unchanged if no capture intent is detected or media is disabled.
 */
export function augmentPromptForMedia(prompt: string, mediaEnabled: boolean): string {
  if (!mediaEnabled) return prompt
  const intent = detectMediaIntent(prompt)
  if (!intent) return prompt

  const ext = intent === 'video' ? 'mp4' : 'png'
  const tool = intent === 'video' ? 'record a video of' : 'take a screenshot of'
  const suffix =
    `\n\nSave the captured ${intent === 'video' ? 'video' : 'screenshot'} to ` +
    `$JHECKBOT_MEDIA_DIR/capture.${ext} so it renders inline in this chat. ` +
    `If a browser automation tool (Playwright/Puppeteer MCP) is available, use it to ${tool} the target. ` +
    `If the target is a local dev server, ensure it is running first.`

  return `${prompt.trimEnd()}${suffix}`
}
