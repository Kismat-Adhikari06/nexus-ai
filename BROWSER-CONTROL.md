# Browser Control — How It Works

Nexu uses **Playwright** (headless Chromium) for browser automation. The system is a **persistent headless browser** that lives on the backend server — the AI drives it by generating structured tool calls.

## Architecture Overview

```
User Chat
   │
   ▼
┌─────────────────────┐
│  src/services/api.ts│  AI generates ---TOOL--- JSON blocks
│  (AI prompt layer)  │  e.g. {"action": "open_url", "url": "..."}
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  src/services/      │  Frontend JS calls backend API
│  tools.ts           │  fetch("http://localhost:3001/api/browser/...")
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  server/index.js    │  Express routes, JWT auth-protected
│  (API routes)       │  POST /api/browser/open, /api/browser/snapshot, etc.
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  server/tools/      │  Thin wrapper — delegates to browserService
│  browser.js         │  openUrl(), searchWeb(), snapshot(), act(), etc.
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  server/services/   │  Core Playwright logic
│  browserService.js  │  Launch, navigate, snapshot, act, etc.
└─────────────────────┘
```

## Key Concepts

### 1. Persistent Headless Browser

A single Chromium instance is shared across the server lifetime. It starts **lazily** on first use and stays open until explicitly closed. This means:
- Pages maintain their state (cookies, localStorage, sessions) between commands
- No cold-start delay after the first request
- You call `browser_launch` / `browser_close` manually if needed

### 2. Operation Mutex (`withLock`)

All exported functions are wrapped in a **mutex** (`operationQueue`). This serializes all browser operations so they don't interleave — essential since there's only one page instance. Each operation waits for the previous one to complete before starting.

### 3. Snapshot + Act Pattern

The core interaction model follows a **snapshot → act → snapshot** cycle:

```
1. browser_snapshot  →  returns a numbered list of all interactive elements
                        and readable text on the current page
                        [1] Link: "Example" → https://example.com
                        [2] Button: "Submit"
                        [3] Input: "Search..." (type: text)
                        [4] Heading: "Welcome"

2. browser_act       →  click or type using the exact numeric ref ID
                        {"action": "browser_act", "refId": "3", "do": "type", "value": "hello"}
                        {"action": "browser_act", "refId": "2", "do": "click"}

3. browser_snapshot  →  see the updated page after the action
```

The ref IDs are **not persistent** — call `browser_snapshot` fresh each time to get current IDs.

### 4. Smart Page Preview

`open_url` returns a **smart summary** of the page, not the raw HTML. It tries multiple extraction strategies in order:

| Strategy | Target | Example Sites |
|----------|--------|---------------|
| 1. `<p>` tags | Blog posts, news articles, docs | Medium, Wikipedia, blog posts |
| 2. Table rows (with links) | Listings, forums | Hacker News, Reddit |
| 3. Content containers | Pages with `<article>`, `<main>`, `.content` | Most modern sites |
| 4. Heading + sibling pairs | Sparse pages | Landing pages |
| 5. Body text (fallback) | Anything | Last resort |

The summary is capped at 5 paragraphs / 3000 chars by default — both configurable via `maxParagraphs` and `maxChars` params.

## API Reference

### All Browser Endpoints

Every endpoint requires a valid JWT token in the `Authorization` header.

| Endpoint | Function | Description |
|----------|----------|-------------|
| `POST /api/browser/launch` | `browser_launch` | Start the headless browser explicitly |
| `POST /api/browser/close` | `browser_close` | Close the browser and free memory |
| `POST /api/browser/open` | `open_url` | Navigate to a URL + return a smart page preview |
| `POST /api/browser/search` | `search_web` | Search DuckDuckGo + return result summaries |
| `POST /api/browser/navigate` | `browser_navigate` | Navigate to a URL (no content returned) |
| `POST /api/browser/snapshot` | `browser_snapshot` | Numbered list of all interactive/text elements |
| `POST /api/browser/act` | `browser_act` | Click or type on an element by ref ID |
| `POST /api/browser/actAndWait` | `browser_act_and_wait` | Click (waits for page navigation) or type |
| `POST /api/browser/extractText` | `browser_extract_text` | Extract text from a CSS selector |
| `POST /api/browser/getText` | `browser_get_text` | Get full page text as plain paragraphs |
| `POST /api/browser/screenshot` | `browser_screenshot` | Take a PNG screenshot (base64) |

### open_url Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `url` | (required) | The URL to navigate to |
| `maxParagraphs` | `5` | How many paragraphs/items to return |
| `maxChars` | `3000` | Max characters to return |

### browser_act / browser_act_and_wait Parameters

| Param | Description |
|-------|-------------|
| `refId` | Exact numeric ID from the last snapshot (e.g. `"3"`) |
| `do` | Either `"click"` or `"type"` |
| `value` | Text to type (only for `"type"` actions) |

### search_web Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `query` | (required) | Search query |
| `maxParagraphs` | `8` | Max search results to return |

## Key Implementation Details

### Browser Launch Configuration

```js
LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',  // Hide automation
  '--no-sandbox',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
];

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
```

The browser also runs a script on every page to hide the `navigator.webdriver` property — making the headless browser harder to detect.

### Snapshot System

The snapshot stores selectors in a `WeakMap` keyed to the page object:
- **Interactive elements** collected: `<a>`, `<button>`, `<input>`, `<textarea>`, `<select>`, `[role="button"]`, `[tabindex]`
- **Text elements** collected: `<h1>`–`<h6>`, `<p>`, `<li>`, `<th>`, `<td>`, `<label>`, `<figcaption>`, `<blockquote>`
- Hidden elements (`display: none`, `visibility: hidden`, `type="hidden"`) are filtered out
- Selectors are built with `id` → `name` → `tag.class:nth-of-type(n)` fallback

### actAndWait — Navigation Detection

`browser_act_and_wait` detects whether the clicked element is a link (or inside a link) and, if so, waits for `domcontentloaded` before returning. This prevents race conditions where the next `snapshot` runs before the new page loads.

### DuckDuckGo Search

`search_web` navigates to `https://duckduckgo.com/?q=<query>` and then extracts search results using DuckDuckGo-specific selectors (`article[data-testid="result"]`). It returns ranked results with headings, snippets, and links.

### Screenshot

`browser_screenshot` returns a PNG as a **base64-encoded string** (not a file path). This can be displayed inline in the frontend.

## Typical Usage Flow

### Browsing a website
```
1. open_url("https://example.com")      →  Page preview (5 paragraphs)
2. browser_snapshot                     →  Numbered element list
3. browser_act("3", "click")            →  Click a link
4. browser_snapshot                     →  Updated element list
5. browser_get_text                     →  Full page text
```

### Searching the web
```
1. search_web("latest AI news")         →  Search summaries
2. open_url(result_link)                →  Open a result
3. browser_snapshot + browser_act       →  Interact with the page
```

### Form filling
```
1. open_url("https://example.com/form")
2. browser_snapshot
3. browser_act("5", "type", "John")     →  Type into name field
4. browser_act("7", "type", "john@...") →  Type into email field
5. browser_act("9", "click")            →  Submit the form
```

## Frontend Integration

In `src/services/tools.ts`, each browser function calls the corresponding backend API endpoint with JWT auth headers. Functions return a `Promise<string>` — either the result text or an error message.

In `src/services/api.ts`, the AI system prompt includes structured descriptions of every browser tool with JSON examples. The AI model outputs `---TOOL---` followed by a JSON object, which the frontend parses and executes via `tools.ts`.

## Notes

- **All browser routes are JWT-protected** — requires `authenticateToken` middleware
- **Web search is DuckDuckGo-specific** — designed for that layout
- **The browser is headless** — no visible window on the desktop
- **Session persists across chat turns** — you can navigate, go back, interact step by step across multiple user messages
