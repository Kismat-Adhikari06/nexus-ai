# Phase 5: Polish & Packaging

## Goal
Make it feel like a real product — robust, fast, and packaged as a single .exe.

## 1. Error Handling
- Microphone not available → graceful fallback, notify user
- AI API down → switch to LM Studio local
- Network offline → local-only mode (limited tools)
- Tool execution fails → "I couldn't open that file, does it still exist?"

## 2. Voice Improvements
- **Noise filtering** — basic noise gate before recording
- **Voice activity detection (VAD)** — stop recording when you stop talking instead of fixed duration
- **Wake word** — optional "Hey Nexu" to begin (instead of hotkey)
- **Interrupt** — say something while AI is speaking → it stops and listens

## 3. Performance
- Pre-load whisper model at startup (faster first transcription)
- Keep AI connection warm (keepalive)
- Profile RAM usage, optimize imports
- Lazy-load tools only when needed

## 4. Packaging with PyInstaller
```bash
pip install pyinstaller
pyinstaller --onefile --windowed --icon=nexu.ico main.py
```
- Single .exe, no Python required to run
- Auto-start with Windows option
- Installer (NSIS or Inno Setup) for clean setup

## 5. Configuration UI (Optional)
- Simple settings window to change:
  - Hotkey
  - AI provider (Groq/Gemini/LM Studio)
  - Voice speed/pitch
  - Microphone device
- Saved in `config.json`

## 6. Extra Tools (Ideas)
- **Clipboard** — read/copy/paste
- **Calendar** — check Google Calendar
- **Email** — read/send via Gmail API
- **Spotify/YouTube Music** — play/pause/skip
- **Screenshot** — capture and describe
- **PDF reader** — summarize documents

## 7. Logging & Debugging
- `logs/` directory with daily log files
- Console mode for debugging (--debug flag)
- Audio save for debugging transcription issues

## Test Criteria
- [ ] Single .exe runs on clean Windows install
- [ ] Startup time < 3 seconds
- [ ] RAM usage < 200MB idle
- [ ] No console window in release mode
- [ ] Auto-start with Windows works
- [ ] Graceful handling of all error states
