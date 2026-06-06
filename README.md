# Nexu — AI Desktop Assistant

Nexu is a Windows-native AI assistant accessible via the browser. It supports voice input, tool execution (system control, file management, web search, WhatsApp, and more), persistent server-side memory, multi-user auth, and multiple AI providers.

## Features

### 🔐 Authentication
- **Login / Signup** — Create an account or sign in with username + password
- **JWT tokens** — 30-day expiry, stored in localStorage, sent with every API request
- **Per-user isolation** — Each user has their own facts, history, and conversations

### 🤖 AI Chat
- Conversational interface with real-time status indicators (idle, listening, thinking, error)
- Multiple AI provider support: **Groq** (Llama 3.3 70B), **Gemini** (2.0 Flash), or **Auto** mode with automatic failover
- Smart intent parsing — strips conversational filler for clean tool execution
- Conversation history and sidebar navigation
- Rich message bubbles with user/AI/tool role indicators

### 🎤 Voice Input
- **Speech-to-Text** — Record audio via browser mic, transcribed by Groq's Whisper API
- **Text-to-Speech** — Click the speaker icon on any assistant message to read it aloud; click again to stop
- Animated recording pulse and listening indicator

### 🧠 Memory & Facts
- **Facts** — Rich key-value storage with **categories** (identity, preferences, relationships, dates, other), **confidence scores** (0–100), **source tracking** (direct statement, chat, WhatsApp), and **status** (saved, pending, rejected)
- **Smart Extraction** — Only extracts when user speaks in first-person ("I", "my", "me"), ignores other people's details. Confidence ≥75 auto-saves, 50–74 goes to Pending tab for approval, <50 discarded
- **Manual Fact Entry** — Add facts yourself from the Memory tab
- **Pending Approval** — Low-confidence facts await your approve/reject in a separate tab
- **Inline Editing** — Edit fact values directly by clicking the edit icon
- **Server-side storage** — All data stored in SQLite, per-user, not localStorage

### 🛠️ Tool System
Nexu can execute tools by parsing structured JSON from the AI response. Tools are organized into categories:

#### System Control
| Tool | Description |
|------|-------------|
| `get_battery` | Check battery percentage & charging status |
| `get_cpu` | Check CPU usage |
| `get_ram` | Check RAM usage |
| `set_volume` | Set system volume (0–100) |
| `notify` | Send a desktop notification |
| `run_command` | Execute a shell command |
| `launch_app` | Launch applications (Chrome, Notepad, Calculator, CMD, Terminal, etc.) |
| `lock_workstation` | Lock the computer |
| `sleep` | Put the computer to sleep |
| `shutdown` | Shut down the computer |
| `hibernate` | Hibernate the computer |

#### File Management
| Tool | Description |
|------|-------------|
| `open_file` | Open a file with its default application |
| `open_in_vscode` | Open a file/folder in VS Code |
| `search_files` | Search for files by name |
| `find_file` | Find a file across Desktop/Documents/Home |
| `get_file_info` | Get file size and modification info |
| `list_directory` | List directory contents |
| `read_pdf` | Extract text from PDF files |

#### Browser & Web
| Tool | Description |
|------|-------------|
| `open_url` | Open any URL in the default browser |
| `search_web` | Search Google from the browser |

#### WhatsApp (Baileys)
| Tool | Description |
|------|-------------|
| `list_whatsapp_chats` | List recent WhatsApp conversations |
| `get_whatsapp_messages` | Get latest messages from a specific contact/chat |
| `send_whatsapp` | Send a message to a contact or phone number |
| `send_whatsapp_number` | Send a message by phone number |
| `get_unread_whatsapp` | Get all unread messages |
| `whatsapp_status` | Check WhatsApp connection status |
| `whatsapp_qr` | Get the QR code link to connect WhatsApp |
| `whatsapp_clear_session` | Clear WhatsApp session and re-link |
| `whatsapp_block` | Block a contact |
| `whatsapp_unblock` | Unblock a contact |
| `whatsapp_delete_chat` | Delete an entire conversation |
| `whatsapp_archive` | Archive a chat |
| `whatsapp_unarchive` | Unarchive a chat |
| `whatsapp_mute` | Mute a chat (8 hours / 1 week / always) |
| `whatsapp_unmute` | Unmute a chat |
| `whatsapp_pin` | Pin a chat to the top |
| `whatsapp_unpin` | Unpin a chat |
| `whatsapp_mark_read` | Mark a chat as read |
| `whatsapp_report` | Report and block a contact |

> **WhatsApp Setup:** Uses [Baileys](https://github.com/whiskeysockets/Baileys) (unofficial WhatsApp Web API). Call any WhatsApp tool (e.g. "List my WhatsApp chats"), then open `http://localhost:3001/api/whatsapp/qr` in your browser to scan. Session auto-restores on server restart — no re-scan unless expired.

#### Clipboard & Media
| Tool | Description |
|------|-------------|
| `clipboard_read` | Read current clipboard content |
| `clipboard_copy` | Copy text to clipboard |
| `screenshot` | Take a screenshot (saved to `~/.nexu/screenshots/`) |
| `play_youtube` | Play a song/video on YouTube with smart title matching |

#### Memory Tools (via chat)
| Tool | Description |
|------|-------------|
| `remember` | Save a fact about the user |
| `recall` | Retrieve a saved fact |
| `list_facts` | List all saved facts |
| `forget` | Delete a saved fact |
| `approve_fact` | Approve a pending fact (low-confidence) |
| `reject_fact` | Reject a pending fact |
| `search_memory` | Search past conversations |

### 🔗 Connections
- **WhatsApp integration** — Dedicated Connections page with live status, connect/disconnect, and QR page access

### ⚙️ Settings
- API key configuration for Groq and Gemini (with eye toggle to reveal/hide keys)
- AI provider selection (Groq, Gemini, or Auto-failover)
- Hotkey configuration (Caps Lock, F4, F3, M, Space)
- All settings persist in browser localStorage

### 🎨 UI/UX
- Dark theme with custom design system (Nexu theme)
- Smooth transitions, hover states, and animations
- Custom scrollbar styling
- Empty state illustrations and guided tooltips
- Responsive layout with sidebar navigation
- Collapsible tool result messages (hidden by default, click to expand)

## Getting Started

### Prerequisites
- **Node.js** 18+
- **API Keys**: [Groq](https://console.groq.com) and/or [Gemini](https://aistudio.google.com/apikey)

### Installation

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### Usage

```bash
# Start the backend server (must be running for tools to work)
cd server && npm start

# In a separate terminal, start the frontend dev server
npm run dev
```

Open the URL shown by Vite (typically `http://localhost:5173`), create an account, go to Settings, enter your API key(s), and start chatting.

### Build for Production

```bash
npm run build
npm run preview
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React icons
- **Backend**: Node.js, Express 5, CORS, better-sqlite3, bcryptjs, jsonwebtoken
- **AI APIs**: Groq (Llama 3.3 70B), Google Gemini 2.0 Flash
- **Voice**: Groq Whisper (STT), Web Speech API (TTS)
- **WhatsApp**: @whiskeysockets/baileys
- **Storage**: SQLite (server-side, per-user)

## Project Structure

```
nexu/
├── src/                    # Frontend source
│   ├── components/         # React components
│   │   ├── Chat.tsx        # Main chat area with scrolling
│   │   ├── ChatInput.tsx   # Message input with auto-resize
│   │   ├── Connections.tsx # WhatsApp connection management
│   │   ├── Header.tsx      # Status bar component
│   │   ├── LoginPage.tsx   # Login/signup UI
│   │   ├── MemoryView.tsx  # Facts browser
│   │   ├── MessageBubble.tsx # Message display with TTS button
│   │   ├── Settings.tsx    # Settings panel
│   │   ├── Sidebar.tsx     # Navigation sidebar
│   │   └── VoiceButton.tsx # Microphone button
│   ├── hooks/
│   │   └── useVoiceRecorder.ts # Audio recording hook
│   ├── services/
│   │   ├── api.ts          # AI provider API integration + tool parsing
│   │   ├── apiClient.ts    # Auth & API request wrapper
│   │   ├── facts.ts        # Automatic fact extraction from conversations
│   │   ├── memory.ts       # Server-side facts & history storage (async)
│   │   ├── stt.ts          # Speech-to-text via Groq Whisper
│   │   ├── tools.ts        # Tool registry & backend API calls
│   │   └── tts.ts          # Text-to-speech via Web Speech API
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   ├── App.tsx             # Root component with auth + state management
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles & Tailwind theme
├── server/                 # Backend server
│   ├── auth.js             # JWT auth, register, login, middleware
│   ├── db.js               # SQLite database setup & schema
│   ├── index.js            # Express server & route definitions
│   ├── package.json        # Server dependencies
│   ├── routes/
│   │   └── storage.js      # Per-user facts, history, conversations API
│   ├── data/               # SQLite database files (auto-created)
│   ├── sessions/           # WhatsApp session files (auto-created)
│   └── tools/
│       ├── browser.js      # URL opening & web search
│       ├── extra.js        # Clipboard, screenshots, YouTube playback
│       ├── files.js        # File operations & search
│       ├── pdf.js          # PDF text extraction
│       ├── system.js       # System control (battery, CPU, volume, etc.)
│       └── whatsapp.js     # WhatsApp integration with auto-restore
├── package.json            # Frontend dependencies & scripts
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── eslint.config.js        # ESLint configuration
```

## How It Works

1. **Auth** → User logs in or registers. JWT token returned and stored locally
2. **User sends a message** → Message sent to the selected AI provider with context (facts, history, tool descriptions)
3. **AI responds** → Response may contain inline `---TOOL---` JSON blocks for tool execution
4. **Tool execution** → Parsed tool calls are executed against the Express backend or browser APIs
5. **Follow-up** → Tool results are sent back to the AI for a natural language summary
6. **Memory extraction** → Facts are automatically extracted from conversations in the background
7. **Persistence** → All data saved to SQLite per-user via the backend API

## License

ISC
