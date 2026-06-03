# Phase 1: Core Voice Loop

## Goal
Get a working conversation loop: press hotkey → speak → hear response. Everything else builds on this.

## What We'll Build

```
Press Caps Lock (or custom hotkey)
    → Record microphone input
    → Transcribe with whisper (STT)
    → Send text to AI (Groq/Gemini)
    → Get response text
    → Speak it back (TTS)
    → Wait for next hotkey press
```

## Files to Create

### 1. `config.py`
- API keys (Groq, Gemini, LM Studio URL)
- Hotkey choice (default: Caps Lock)
- Whisper model path
- Mic device index

### 2. `stt.py`
- Record audio from mic when triggered (e.g., 5 seconds or until silence)
- Save as WAV file
- Pass to whisper.cpp or faster-whisper
- Return transcribed text

### 3. `ai.py`
- Takes text input + conversation history
- Calls Groq API (primary) or Gemini or LM Studio (fallback)
- Returns AI response text
- Keeps a short conversation window for context

### 4. `tts.py`
- Takes response text
- Uses edge-tts (free, fast, no GPU)
- Plays audio through speakers
- Non-blocking (AI can keep working)

### 5. `main.py`
- System tray icon (pystray)
- Global hotkey listener (pynput)
- Wires everything together
- Simple "listening" indicator (subtle)

## Dependencies to Install
```
pip install faster-whisper edge-tts pynput pystray pyaudio groq Pillow
```

## Test Criteria
- [ ] Press hotkey → recording starts (tray icon changes)
- [ ] Release / timeout → transcription appears in console
- [ ] AI responds within 2-3 seconds (Groq)
- [ ] Audio plays back through speakers
- [ ] Repeat smoothly without crashing
- [ ] Idle memory ~150MB or less

## No GUI Yet
This phase is terminal-only for testing. The system tray icon is the only "UI". We validate everything works before adding any window.

## What to Skip (for now)
- WhatsApp
- Memory system
- File control
- Portal checking
- Any tool execution
