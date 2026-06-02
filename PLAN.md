# Nexu — AI Desktop Assistant for Windows

## Vision
A voice-controlled AI assistant that lives in your system tray, understands your files/projects/university context, and can do anything you can do on your laptop — open files, browse the web, send WhatsApp messages, launch apps, check portals.

## Core Philosophy
- **Low-end first:** Runs on 8GB RAM, i5, Iris Xe. No heavy frameworks.
- **Hybrid AI:** Use cloud APIs (Groq, Gemini) when online; LM Studio with Qwen when offline.
- **Tool-based architecture:** AI doesn't guess — it emits structured commands that the system executes.
- **Memory-first:** Remembers your university portal URL, where projects live, what you're working on.

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│              Hotkey Listener (pynput)            │
│         Push-to-talk → Record mic audio          │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│           Speech-to-Text (whisper.cpp)           │
│           Audio → Text transcription             │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│           AI Brain (Groq / Gemini / LM Studio)   │
│     Takes transcription + memory context         │
│     Returns: response text + tool calls          │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│            Tool Executor (Python layer)          │
│  Interprets tool calls → controls laptop        │
│  - open_file, open_browser, launch_app          │
│  - send_whatsapp, read_notifications            │
│  - search_files, check_portal                   │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│           Text-to-Speech (edge-tts)             │
│           Response text → spoken audio          │
└─────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | Python 3.11+ | Best Windows system control + ML ecosystem |
| STT | whisper.cpp (tiny) / faster-whisper | Offline, low RAM |
| TTS | edge-tts | Free, natural, uses Windows, no GPU |
| Hotkey | pynput + keyboard | Global push-to-talk |
| System Tray | pystray | Minimizes to tray |
| AI Backend | Groq API / Gemini / LM Studio | Hybrid cloud+local |
| Computer Control | pyautogui + subprocess + win32api | Full Windows control |
| WhatsApp | playwright (web.whatsapp.com) | Reliable programmatic access |
| Memory | sqlite3 + chromadb | Simple + vector search |
| Notifications | win10toast | Non-intrusive alerts |
| Packaging | PyInstaller | Single .exe |

## Project Structure

```
nexuv2/
├── main.py              # Entry point — tray icon + hotkey
├── stt.py               # Speech-to-text module
├── tts.py               # Text-to-speech module
├── ai.py                # AI backend (Groq/Gemini/LM Studio)
├── tools/               # All computer control tools
│   ├── __init__.py
│   ├── files.py         # Open files, search, launch apps
│   ├── browser.py       # Open URLs, scrape, check portals
│   ├── whatsapp.py      # Send WhatsApp messages
│   └── system.py        # Volume, brightness, shutdown etc.
├── memory/
│   ├── __init__.py
│   ├── store.py         # SQLite key-value memory
│   └── vector.py        # ChromaDB semantic memory
├── config.py            # API keys, paths, settings
├── requirements.txt
└── README.md
```

## Phases

1. **Phase 1: Voice Loop** — Hotkey → STT → AI → TTS (core conversation)
2. **Phase 2: Tool System** — File ops, browser, app launching
3. **Phase 3: Memory** — Remember portals, projects, preferences
4. **Phase 4: WhatsApp** — Send messages, read chats
5. **Phase 5: Polish** — Packaging, error handling, noise filtering

## Constraints
- Must idle under 200MB RAM
- No Electron, no Node.js runtime (except sidecar if needed)
- Offline-capable with LM Studio fallback
- All data stays local unless using cloud API explicitly
