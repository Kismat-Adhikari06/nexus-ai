# 🧠 Nexu Roadmap: From Chatbot to Local AI Agent

> **Vision:** Make Nexu a powerful local AI agent that can do anything on your machine — transcribe videos, edit code, process files, run scripts, browse the web, control WhatsApp — all through natural language.

---

## 🎯 Phase 1: Fix the Foundation (Current Gaps)

### 1.1 Upgrade `run_command` — The Agent Escape Hatch

**Current state:** Synchronous, 10s timeout, 500 char output cap, no working directory.

**Target state:**
- Async execution (non-blocking)
- 30–60s timeout (configurable up to 5 min)
- 10k+ char output (no more truncation)
- `cwd` parameter to run commands in any directory
- Temp script support — write multi-line scripts, then execute
- Better error reporting (full stderr + exit code)

**Files to modify:** `server/tools/system.js`, `src/services/tools.ts`, `src/services/api.ts` (tool descriptions)

### 1.2 Better File Read/Write Tools

**Current state:** Can read PDFs only. Can't read plain text files or write/edit them.

**Add these tools:**
| Tool | Description |
|------|-------------|
| `read_file(path, maxChars?)` | Read any text file |
| `write_file(path, content)` | Create or overwrite a file |
| `edit_file(path, oldString, newString)` | Targeted find-and-replace (like Claude Code) |
| `diff_file(path)` | Show local changes vs saved version |

**Files to add:** `server/tools/fileops.js`

### 1.3 Add OpenRouter as AI Provider

**Why:** Access to Claude 3.5 Sonnet, GPT-4o, and other top models for complex multi-step tasks.

**Changes needed:**
- Add OpenRouter API integration in `src/services/api.ts`
- Add OpenRouter API key field in `src/components/Settings.tsx`
- Update provider list in types

---

## 🔧 Phase 2: Local Media Processing (Unique Differentiator)

This is where Nexu beats Claude Code — local media processing with no cloud dependency.

### 2.1 ffmpeg Tool

**What it unlocks:**
- Extract audio from video → feed to Whisper
- Convert video formats (mp4 → gif, mov → mp4)
- Cut/trim videos
- Extract frames/screenshots from video
- Compress media files
- Get video metadata (duration, codec, resolution)

**Tool examples:**
```json
{"action": "ffmpeg_extract_audio", "input": "C:/video.mp4", "output": "C:/audio.mp3"}
{"action": "ffmpeg_convert", "input": "C:/video.mov", "output": "C:/video.mp4"}
{"action": "ffmpeg_trim", "input": "C:/video.mp4", "start": "00:01:30", "duration": "00:00:30"}
```

### 2.2 Local Whisper

**Options:**
| Option | Pros | Cons |
|--------|------|------|
| `whisper.cpp` | Fast on CPU, small binary, C++ | Needs compilation, ~1GB model download |
| `faster-whisper` | Even faster, Python, good accuracy | Python dependency |
| `openai-whisper` | Official, highest accuracy | Heavy Python dependency |

**Integration:** The AI should chain: `find_file` → `ffmpeg_extract_audio` → `whisper_transcribe` → return text

### 2.3 Image Processing (Sharp / ImageMagick)

**What it unlocks:**
- Resize, crop, convert images
- OCR text from images (Tesseract)
- Generate thumbnails
- Batch process folders

---

## 🚀 Phase 3: Agent Features (Like Claude Code)

### 3.1 Code Editing Workflow

Claude Code's killer feature: it reads your codebase, suggests changes, and applies them with your approval.

For Nexu:
1. AI reads files with `read_file`
2. AI proposes edit with `edit_file` (shows a diff)
3. User approves
4. AI applies the change
5. AI runs tests to verify

### 3.2 Project Understanding

- `grep` / code search tool — search codebase for patterns
- `list_project` — see project structure
- `read_project_tree` — understand file relationships

### 3.3 Tool Chaining

**Current:** One `---TOOL---` block per response, then AI waits for result.

**Target:** AI outputs multiple tool calls in sequence:
```
---TOOL---
{"action": "find_file", "filename": "video.mp4"}
```
Wait for result... then:
```
---TOOL---
{"action": "ffmpeg_extract_audio", "input": "C:/video.mp4", "output": "C:/audio.mp3"}
```
Wait for result... then:
```
---TOOL---
{"action": "whisper_transcribe", "input": "C:/audio.mp3"}
```

The AI already supports this pattern! It just needs the tools to exist.

---

## 🛡️ Phase 4: Safety & UX

### 4.1 Confirmation for Destructive Actions
- Auto-confirm for reads and non-destructive actions
- Ask user before: shutdown, delete files, block contacts, write to important files
- "Are you sure?" overlay in the chat

### 4.2 Progress Indicators for Long-Running Tools
- Running transcription? Show "Transcribing... (45% done)"
- Running ffmpeg? Show progress bar
- This requires async tool execution with status polling

### 4.3 Output Viewer
- Large command output should be collapsible / scrollable
- Diff view for code changes
- Image preview for screenshots

---

## 📋 Phase 5: Stretch Goals

| Feature | Why |
|---------|-----|
| **Git integration** | Commit, branch, diff, status — full git control |
| **npm/pip package management** | AI installs dependencies when needed |
| **Docker support** | Run containers, exec into them |
| **SSH / remote execution** | Control other machines |
| **Scheduled tasks** | "Remind me every day at 9am to..." |
| **Voice activation** | Hotkey + voice command without chat UI |
| **Desktop recording** | Record screen, extract text from video |

---

## 📊 Priority Matrix

| Feature | Impact | Effort | Do First? |
|---------|--------|--------|-----------|
| Upgrade `run_command` | 🔥🔥🔥🔥🔥 | 🟢 Low | ✅ **YES** |
| `read_file` / `write_file` | 🔥🔥🔥🔥 | 🟢 Low | ✅ **YES** |
| Add OpenRouter provider | 🔥🔥🔥🔥 | 🟢 Low | ✅ **YES** |
| ffmpeg tool | 🔥🔥🔥🔥 | 🟡 Medium | After basics |
| Local Whisper | 🔥🔥🔥🔥🔥 | 🟡 Medium | After ffmpeg |
| Image processing | 🔥🔥🔥 | 🟡 Medium | Lower priority |
| Code editing workflow | 🔥🔥🔥🔥🔥 | 🔴 High | After file tools |
| Confirmation system | 🔥🔥🔥 | 🟢 Low | Alongside destructive tools |
| Git integration | 🔥🔥🔥 | 🟡 Medium | Nice to have |

---

## 💡 Architecture Notes

### Server stays the same
All heavy lifting stays on the Express server (`localhost:3001`). The frontend is just a UI. This is the right design.

### New tools go in `server/tools/`
Each tool category gets its own file (already the pattern). New ones:
- `server/tools/media.js` — ffmpeg + whisper
- `server/tools/fileops.js` — read/write/edit files
- `server/tools/code.js` — grep, project understanding

### Tool descriptions live in `src/services/api.ts`
Each new tool needs a description in `TOOL_DESCRIPTIONS` so the AI knows how to call it.
