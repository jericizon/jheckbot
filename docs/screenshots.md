# Screenshots

JheckBot surfaces agent-captured screenshots inline in the chat. When the
Devin agent takes a screenshot (via a browser automation MCP server like
Playwright or Puppeteer), the PNG is stored on the JheckBot API host and
rendered as an image in the assistant message. Clicking an image opens a
lightbox.

## How it works

1. On each agent run, JheckBot passes two environment variables to the
   Devin process inside its tmux session:
   - `JHECKBOT_SCREENSHOTS_DIR` — absolute path to
     `<SCREENSHOTS_DIR>/<conversationId>/`
   - `JHECKBOT_CONVERSATION_ID` — the conversation UUID
2. The agent's browser automation tool saves PNGs into
   `JHECKBOT_SCREENSHOTS_DIR`.
3. The JheckBot API watcher scans that directory on each tick. For every
   new PNG it:
   - emits a `screenshot` SSE event (`{ url, filename }`)
   - appends a markdown image link to the run's output buffer, so the
     screenshot persists in the final assistant message
4. The frontend renders the markdown image inline. A click-to-zoom
   lightbox is built into `Markdown.vue`.
5. Screenshots are served via
   `GET /api/conversations/:id/screenshots/:filename` (auth-gated,
   path-traversal-safe). Listing:
   `GET /api/conversations/:id/screenshots`.
6. On conversation delete, the conversation's screenshot directory is
   removed (best-effort).

## Configuration

`SCREENSHOTS_DIR` (optional, defaults to `<repo-root>/data/screenshots`).
Set it in `.env` if you want screenshots stored elsewhere.

## Enabling the agent to take screenshots

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

Then ask the agent to take a screenshot, e.g.:

> Start the dev server on port 3000, then use Playwright to screenshot
> `http://localhost:3000`. Save the screenshot to
> `$JHECKBOT_SCREENSHOTS_DIR/home.png`.

The agent will save the PNG to the directory JheckBot watches, and it
will appear inline in the chat within a few hundred milliseconds.

## Security

- Screenshot routes require the same session auth as all other API routes.
- Filename resolution uses `basename` + symlink-realpath containment
  checks, so `..` traversal and symlink escapes are rejected.
- Only `.png` files are served.
- `Content-Type` is forced to `image/png`; no content sniffing.
