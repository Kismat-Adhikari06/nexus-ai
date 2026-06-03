# Nexu — AI Desktop Voice Assistant

## Status: ✅ Phase 5 Complete

An AI voice assistant for Windows. Local-first, cloud-enhanced.

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Core Voice Loop (STT → AI → TTS) | ✅ Done |
| 2 | Computer Control Tools | ✅ Done |
| 3 | Memory & Context | ✅ Done |
| 4 | WhatsApp Integration | ✅ Done |
| 5 | Polish & Packaging | ✅ Done |

## Architecture

- **main.py** — Tkinter overlay + hotkey orchestrator
- **stt.py** — PyAudio recording → Groq Whisper API transcription
- **ai.py** — Multi-provider AI (Groq / Gemini / OpenRouter / LM Studio)
- **tts.py** — edge-tts + pygame playback
- **config.py** — Settings (JSON user config + .env API keys)
- **nexu_log.py** — Structured logging (file + console)
- **nexu-cli.py** — CLI mode for text commands
- **ui_config.py** — Tkinter settings window
- **wake_word.py** — Optional "Hey Nexu" wake word detection

### Tools (`tools/`)
- `files.py` — Open, search, find, list files
- `system.py` — Launch apps, battery/CPU/RAM, volume, notify
- `browser.py` — Open URLs, search Google
- `browser_automation.py` — AI-guided web navigation (Playwright + Gemini)
- `whatsapp.py` — WhatsApp Web messaging (Playwright)
- `memory.py` — Fact storage wrapper + conversation search
- `extra.py` — Clipboard, screenshot, PDF reader
- `executor.py` — Tool registry, JSON parsing, lazy loading

### Memory (`memory/`)
- `store.py` — SQLite key-value facts
- `vector.py` — SQLite FTS5 conversation history

## Packaging

```bash
build.bat        # Build single .exe with PyInstaller
install.bat      # Install with auto-start + shortcut
```

## Usage

- **F4 (hold)** — Voice mode
- **F3** — Text mode
- **Esc** — Exit

## Architecture Principles
- Low-end first (8GB RAM, i5)
- Hybrid cloud+local AI
- Tool-based architecture
- Memory-first design
