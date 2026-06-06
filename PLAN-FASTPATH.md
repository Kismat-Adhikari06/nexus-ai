# 🚀 Future Plan: AI Fast-Path for Simple Commands

> **Idea:** If a tool doesn't need AI to run (lock PC, screenshot, open browser, check battery, etc.), why waste AI quota on it? Build a **fast-path pattern matcher** that catches simple commands before they ever hit the AI API.

---

## The Problem

Right now every single user message goes through the AI — even trivial ones like "lock my PC" or "volume 50". That's **2 AI API calls** per message:
1. One to understand what you want & generate the tool JSON
2. One to summarize the tool's result

For simple, deterministic actions, this is overkill. The tool doesn't need AI — it just needs input → match → execute → respond.

---

## The Solution: Hybrid Architecture

```
User says: "lock my PC"
         │
         ▼
   ┌─────────────────┐
   │  Pattern Matcher │ ← fast, local, zero AI cost
   └────────┬────────┘
            │
     ┌──────┴──────┐
     ▼              ▼
  Match?          No match?
     │              │
     ▼              ▼
  Run tool      Send to AI
  directly       (normal flow)
     │              │
     ▼              ▼
  "Locked!"     AI generates
                response
```

### Fast-Path (0 AI calls)
Simple commands matched by regex/pattern matching → execute tool → return static response.

### Slow-Path (2 AI calls, as today)
Complex/ambiguous messages → AI processes → executes tools → AI summarizes.

---

## Which Commands Would Be Fast-Path?

### System
| Command | Patterns | Action |
|---------|----------|--------|
| Lock PC | `lock`, `lock my pc`, `lock computer`, `secure` | `LockWorkStation` |
| Sleep | `sleep`, `put to sleep` | `SetSuspendState` |
| Shutdown | `shut(down)?`, `turn off`, `power off` | `shutdown /s /t 5` |
| Hibernate | `hibernate`, `hybrid` | `shutdown /h` |
| Battery | `battery`, `battery (level|percentage|status|left)`, `how much battery`, `charge` | `WMIC battery` |
| CPU | `cpu`, `processor usage`, `cpu (usage|load|percentage)` | `WMIC cpu` |
| RAM | `ram`, `memory`, `ram (usage|left|status)`, `memory usage` | `os.totalmem()` |
| Volume | `volume (set|to) \d+`, `volume \d+`, `set volume` | SendKeys |
| Notify | `notify( me)?`, `send notification` | `WScript.Popup` |
| Launch app | `open (chrome|edge|notepad|calculator|...)`, `launch` | `cmd /c start` |

### File
| Command | Patterns | Action |
|---------|----------|--------|
| Open file | `open (file |.)`, `open .*` | `start "" path` |
| List dir | `list (dir|directory|files|folder)`, `what('s| is) in` | `fs.readdir` |
| Read PDF | `read (pdf|file)` | `pdf-parse` |

### Browser
| Command | Patterns | Action |
|---------|----------|--------|
| Open URL | `open (url|site|website|page)`, `go to`, `navigate to`, `https?://` | Playwright navigate |
| Search web | `search( for)?`, `look up`, `find (out|about|info|results|on the web|online|on internet|google|ddg|duckduckgo|web)`, `browse`, `what('s| is) .+\?` when not a personal Q | Playwright DuckDuckGo |
| Screenshot | `screenshot`, `take (a )?(screenshot|pic|picture|snapshot|screen shot|screen cap|screen capture)`, `capture screen`, `print screen` | PowerShell .NET capture |

### WhatsApp
| Command | Patterns | Action |
|---------|----------|--------|
| Status | `whatsapp status`, `(is )?whatsapp connected`, `wa status` | `whatsapp.getStatus()` |
| QR | `whatsapp qr`, `show qr`, `scan qr` | `whatsapp.getQR()` |
| Unread | `unread messages`, `new messages`, `whatsapp unread` | `whatsapp.getUnreadMessages()` |

### Extra
| Command | Patterns | Action |
|---------|----------|--------|
| Clipboard | `clipboard( read)?`, `what('s| is) (in |on |copied to |on the )?(clipboard|clip board)` | `Get-Clipboard` |
| Screenshot | Same as Browser |
| YouTube | `play .+`, `play .+ on youtube`, `play .+ (song|music|video)`, `listen to`, `put on`, `start` | `playYoutube()` |

---

## Edge Cases & Nuance

### Mixed messages
> "lock my pc and open chrome"

This is a compound command — could run both in sequence without AI, or could still be passed to AI if too complex.

### Ambiguous phrases
> "open a folder"

Could be a file tool (list directory) or could be `launchApp('explorer')`. The pattern matcher needs a priority system.

### Confirmation-required actions
> "shutdown"

Destructive actions (shutdown, delete file, block WhatsApp contact) should still ask for confirmation even in fast-path mode.

### Smart fallback
If the pattern matcher is even slightly unsure → pass to AI. **Better to use AI than to do the wrong thing.**

---

## Implementation Sketch

```
src/
  fastpath/
    index.ts         ← Main entry: takes user input, returns {matched, action, params} or null
    patterns.ts      ← All regex/pattern definitions grouped by category
    responses.ts     ← Static response templates for fast-path tools
    executor.ts      ← Calls the actual tool functions directly
```

The main chat flow in `App.tsx` would change from:
```
userMessage → send to AI → parse tools → execute → send results to AI → display
```

To:
```
userMessage → try fastpath matcher
  ├─ matched → execute tool directly → display response (0 AI calls)
  └─ no match → send to AI → [normal flow] (2 AI calls)
```

---

## Benefits

- **Saves AI quota** for complex tasks where it's actually needed
- **Feels faster** — no 1-3 second AI latency for simple commands
- **Works offline** — fast-path commands don't need internet
- **More predictable** — "lock my pc" always does the same thing instantly

---

## Future Stretch: Voice Activation

Once the fast-path is solid, this could be surfaced as a "quick command" mode where you can just say things without waiting for the chat interface — a hotkey + command phrase executes instantly, like a smarter voice assistant.
