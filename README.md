# Nexu — AI Desktop Assistant

**Nexu** is a voice-first, AI-powered desktop assistant for Windows. Speak commands, control your computer, send WhatsApp messages, browse the web, and more — hands-free.

> Built for low-end hardware (8GB RAM, i5). Local-first, cloud-enhanced.

---

## Features

### 🎤 Voice Interface
- **Push-to-Talk** — Hold **M** (or configurable hotkey), speak your command, release
- **Wake Word** — Say *"Hey Jarvis"* / *"Nexu"* to activate hands-free
- **Real-time TTS** — Streamed, natural-sounding speech via edge-tts
- **Barge-in** — Interrupt Nexu mid-response by pressing M

### ⌨️ Text Mode
- Press **F3** to type commands instead of speaking

### 🧠 Multi-Provider AI
Multiple AI backends with automatic fallback:
| Provider | API Key | Model |
|----------|---------|-------|
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| Gemini | `GEMINI_API_KEY` | `gemini-2.0-flash-lite` |
| OpenRouter | `OPENROUTER_API_KEY` | `qwen-2.5-72b-instruct` |
| LM Studio | Local URL | Any local model |

### 🛠️ 30+ Tools
| Category | Tools |
|----------|-------|
| **System** | Launch apps, check battery/CPU/RAM, set volume, run commands, send notifications |
| **Files** | Open/search/find files, list directories, open in VS Code |
| **Browser** | Open URLs, search Google, AI-guided web automation |
| **WhatsApp** | Send messages (by contact or number), read recent messages, list contacts |
| **Memory** | Save/recall facts, search conversation history |
| **Utilities** | Clipboard (read/copy), screenshot, read PDFs, play YouTube |

### 💾 Persistent Memory
- **Key-value facts** — "Remember my name is John" → recall later
- **Conversation search** — FTS5-powered full-text search across all past interactions
- **Rich context** — Facts + relevant past conversations injected into every AI prompt

### 🌐 WhatsApp Integration
Full WhatsApp Web automation via Playwright:
- Send messages to saved contacts
- Send messages to any phone number (with country code)
- Read recent messages
- Search/List contacts
- Persistent session (QR scan once, stays logged in)

### 🕸️ AI-Guided Web Automation
Gemini-powered browser agent that can:
- Navigate to URLs
- Read page content
- Click buttons and links
- Automatically log in to portals (if credentials saved)
- Follow multi-step workflows

### 🎯 CLI Mode
`python nexu-cli.py open my calendar` — one-shot text commands from the terminal.

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set up API keys (at least one)
# Create a .env file:
echo GROQ_API_KEY=gsk_your_key_here > .env

# 3. Install Playwright browsers (for WhatsApp & web automation)
playwright install

# 4. Run Nexu
python main.py
```

For a CLI-only experience:
```bash
python nexu-cli.py what's my battery level
```

---

## Configuration

### API Keys (.env)
Create a `.env` file in the project root:

```env
GROQ_API_KEY=gsk_your_key_here
GROQ_API_KEY1=gsk_second_key_here       # optional fallback
GEMINI_API_KEY=your_gemini_key_here     # required for web automation
OPENROUTER_API_KEY=your_key_here        # optional fallback
```

### User Settings (~/.nexu/config.json)
Generated automatically. Edit via the settings UI or directly:

```json
{
  "hotkey": "caps_lock",
  "ai_provider": "groq",
  "groq_model": "llama-3.3-70b-versatile",
  "tts_voice": "en-US-AriaNeural",
  "max_history": 3,
  "ai_timeout": 15,
  "silence_seconds": 2.0,
  "max_record_seconds": 10
}
```

Access the settings GUI:

```bash
python ui_config.py
```

---

## Usage

### Voice Mode
| Action | Input |
|--------|-------|
| **Push-to-Talk** | Hold **M** → speak → release |
| **Barge-in** | Press **M** while Nexu is speaking |
| **Wake Word** | Say *"Hey Jarvis"* or *"Nexu"* |
| **Text Mode** | Press **F3** → type → Enter |
| **Exit** | Press **Esc** |

### CLI Mode
```bash
python nexu-cli.py launch spotify
python nexu-cli.py search for budget spreadsheet
python nexu-cli.py remember favorite_color blue
python nexu-cli.py what's my battery
```

### What You Can Say
| You say | Nexu does |
|---------|-----------|
| *"Open Chrome"* | Launches Google Chrome |
| *"What's my battery?"* | Reports battery percentage |
| *"Send a message to Mom saying I'll be late"* | Sends WhatsApp message |
| *"Remember my email is john@example.com"* | Saves a fact |
| *"What do you know about me?"* | Recalls all saved facts |
| *"Search YouTube for lofi beats"* | Opens YouTube search |
| *"Open the budget.xlsx file"* | Opens file with default app |
| *"Set volume to 50%"* | Adjusts system volume |
| *"What's on my desktop?"* | Lists desktop files |

---

## Architecture

```
nexu/
├── main.py                    # Tkinter overlay + voice loop orchestrator
├── nexu-cli.py                # CLI mode for one-shot commands
├── ai.py                      # Multi-provider AI client (Groq/Gemini/OpenRouter/LM Studio)
├── stt.py                     # Speech-to-text (local whisper + Groq API fallback)
├── tts.py                     # Text-to-speech (edge-tts + pygame)
├── config.py                  # Settings (JSON + .env)
├── wake_word.py               # "Hey Jarvis" wake word detection (OpenWakeWord)
├── nexu_log.py                # Structured logging (file + console, rotation)
├── ui_config.py               # Tkinter settings GUI
│
├── tools/
│   ├── executor.py            # Tool registry & JSON parser
│   ├── files.py               # File operations (open, search, find, list)
│   ├── system.py              # System operations (launch, battery, volume, etc.)
│   ├── browser.py             # Open URLs & search Google
│   ├── browser_automation.py  # AI-guided web navigation (Playwright + Gemini)
│   ├── whatsapp.py            # WhatsApp Web automation (Playwright)
│   ├── memory.py              # Fact storage & conversation search wrappers
│   └── extra.py               # Clipboard, screenshot, PDF reader, YouTube
│
├── memory/
│   ├── store.py               # SQLite key-value fact storage
│   └── vector.py              # SQLite FTS5 conversation search
│
├── build.bat                  # PyInstaller single .exe build
├── install.bat                # Install with auto-start + shortcuts
├── requirements.txt           # Python dependencies
└── .env                       # API keys (not tracked)
```

### Data Flow
```
User speaks → PyAudio records → Groq Whisper (or local faster-whisper)
  → AI provider processes with tools + memory context
  → If tool call: execute tool (file/system/browser/WhatsApp)
  → edge-tts speaks response → Tkinter overlay shows text
```

### Design Principles
- **Low-end first** — Runs comfortably on 8GB RAM, i5 processors
- **Local-first** — Local whisper, local wake word, offline-capable tools
- **Cloud-enhanced** — API-based AI for intelligence, fallback for reliability
- **Tool-based** — Extensible registry architecture, ~30 tools and growing
- **Memory-first** — Every interaction is stored and searchable

---

## Installation & Packaging

### Build a Portable .exe
```bash
build.bat
```
Produces `dist/Nexu.exe` — a single-file, no-dependency executable.

### Install with Auto-Start
```bash
install.bat
```
- Adds Nexu to Windows startup
- Creates Desktop shortcut
- Can run headless at boot

### Manual Start
```bash
python main.py --install    # Install auto-start only
python main.py --uninstall  # Remove auto-start
python main.py --debug      # Run with debug logging
```

---

## Memory System

### Facts (Key-Value)
Persistent SQLite storage in `~/.nexu/memory.db`:
```
remember name John
remember favorite_color blue
recall name              → "John"
forget favorite_color
list_facts               → "name: John"
```

### Conversation Search (FTS5)
Every interaction is indexed for full-text search:
```
search_memory "budget"   → finds past conversations about budget
```
Relevant past conversations are automatically injected into the AI context for smarter responses.

---

## Development

### Add a New Tool
1. Create your function in an existing tool module or a new one
2. Register it in `tools/executor.py` → `REGISTRY` dict
3. Restart — Nexu will automatically include it in the system prompt

```python
# tools/example.py
def my_tool(param: str) -> str:
    return f"Did something with {param}"

# In executor.py REGISTRY:
"my_tool": ("tools.example.my_tool", "Description of what it does", {"param": "description of param"})
```

### Dependencies
```
edge-tts            # TTS voice synthesis
pynput              # Global keyboard listener
PyAudio             # Microphone recording
groq                # Groq API client
google-generativeai # Gemini API (optional)
pygame              # Audio playback
pycaw, comtypes     # Windows volume control (Windows only)
playwright          # Browser automation
pyperclip           # Clipboard access
PyPDF2              # PDF reading
pyautogui           # Screenshots
yt-dlp              # YouTube search
openwakeword        # Wake word detection (ONNX)
psutil              # System stats (CPU, RAM, battery)
plyer               # Desktop notifications
python-dotenv       # .env file loading
```

---

## Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Core Voice Loop (STT → AI → TTS) | ✅ Complete |
| 2 | Computer Control Tools | ✅ Complete |
| 3 | Memory & Context | ✅ Complete |
| 4 | WhatsApp Integration | ✅ Complete |
| 5 | Polish & Packaging | ✅ Complete |

### Future Improvements
- [ ] Offline TTS via Windows SAPI (SAPI.SpVoice)
- [ ] Command caching for deterministic results (battery, CPU, etc.)
- [ ] Semantic memory via AI summarization (beyond keyword search)
- [ ] System tray icon with menu

---

## License

MIT
