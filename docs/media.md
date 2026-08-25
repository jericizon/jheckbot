# Media (Images & Videos)

JheckBot surfaces agent-captured images and videos inline in the chat. When
the Devin agent captures a screenshot or records a video (via a browser
automation MCP server like Playwright or Puppeteer), the file is stored on
the JheckBot API host and rendered inline in the assistant message.

- **Images** render as inline images; clicking opens a lightbox.
- **Videos** render as inline `<video>` players with controls; double-click
  opens a larger lightbox player.

## Supported formats

- **Images:** png, jpg, jpeg, gif, webp, svg, bmp, ico
- **Videos:** mp4, webm, mov, ogv, m4v

## How it works

1. On each agent run, JheckBot passes two environment variables to the
   Devin process inside its tmux session:
   - `JHECKBOT_MEDIA_DIR` — absolute path to
     `<MEDIA_DIR>/<conversationId>/`
   - `JHECKBOT_CONVERSATION_ID` — the conversation UUID
2. The agent's browser automation tool saves files into
   `JHECKBOT_MEDIA_DIR`.
3. The JheckBot API watcher scans that directory on each tick. For every
   new file it:
   - emits a `media` SSE event (`{ url, filename }`)
   - appends a markdown image link to the run's output buffer, so the
     media persists in the final assistant message
4. The frontend renders the markdown. A custom marked renderer detects
   video URLs by extension and emits a `<video>` tag instead of `<img>`.
5. Media files are served via
   `GET /api/conversations/:id/media/:filename` (auth-gated,
   path-traversal-safe, correct Content-Type per extension). Listing:
   `GET /api/conversations/:id/media`.
6. On conversation delete, the conversation's media directory is
   removed (best-effort).

## Configuration

`MEDIA_DIR` (optional, defaults to `<repo-root>/data/media`).
Set it in `.env` if you want media stored elsewhere.

## Enabling the agent to capture media

The agent needs a browser automation MCP server configured in Devin CLI.
Example `.devin/config.json` (or `~/.config/devin/config.json`) entry for
the Playwright MCP server:

```json
{
  "mcpServers": {
    "mcp-playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    }
  }
}
```

Then ask the agent to capture media, e.g.:

> Start the dev server on port 3000, then use Playwright to screenshot
> `http://localhost:3000`. Save the screenshot to
> `$JHECKBOT_MEDIA_DIR/home.png`.

Or for video:

> Use Playwright to record a 5-second video of `http://localhost:3000`.
> Save it to `$JHECKBOT_MEDIA_DIR/demo.mp4`.

The agent will save the file to the directory JheckBot watches, and it
will appear inline in the chat within a few hundred milliseconds.

## Automatic media-path injection

You do not have to specify `$JHECKBOT_MEDIA_DIR` manually. JheckBot inspects
each prompt (initial and follow-up) for capture intent and, when detected,
appends a save instruction to the prompt sent to the agent. The stored user
message is left untouched — only the agent sees the augmented prompt.

Detected as a **screenshot** (image):

- "screenshot", "screen shot", "snapshot"
- "take a screenshot/shot/snapshot of ..."
- "capture the screen/page/homepage/site/app/ui/view"
- "preview of the homepage/page/site/app/ui/view/screen/landing"
- "show me a preview/screenshot/snapshot of ..."
- "homepage/page/... preview"

Detected as a **video recording** (video):

- "record a video", "video recording", "screen recording", "screencast"
- "record the homepage/page/site/app/screen/flow/demo"
- "capture a video"
- "N-second video"

If the prompt already references `$JHECKBOT_MEDIA_DIR`, no instruction is
appended (the explicit path wins). Detection is conservative on purpose:
phrasing like "show me the code" or "what does the config look like" is not
treated as a capture request. If a capture is not surfaced inline, either
name the file explicitly with `$JHECKBOT_MEDIA_DIR/<name>.<ext>` or confirm
a browser-automation MCP server is configured.

## Security

- Media routes require the same session auth as all other API routes.
- Filename resolution uses `basename` + symlink-realpath containment
  checks, so `..` traversal and symlink escapes are rejected.
- Only recognized image and video extensions are served.
- `Content-Type` is set from the extension; no content sniffing.
