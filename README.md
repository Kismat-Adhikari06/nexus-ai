# Nexu — AI Desktop Assistant

Nexu is a Windows-native AI assistant accessible via the browser. It supports voice input/output, tool execution (system control, file management, web search, and more), persistent memory, and multiple AI providers.

## Features

### 🤖 AI Chat
- Conversational interface with real-time status indicators (idle, listening, thinking, speaking, error)
- Multiple AI provider support: **Groq** (Llama 3.3 70B), **Gemini** (2.0 Flash), or **Auto** mode with automatic failover
- Smart intent parsing — strips conversational filler for clean tool execution
- Conversation history and sidebar navigation
- Rich message bubbles with user/AI/tool role indicators

### 🎤 Voice
- **Speech-to-Text** — Record audio via browser mic, transcribed by Groq's Whisper API
- **Text-to-Speech** — AI responses spoken aloud via browser Speech Synthesis API with natural voice selection
- Voice input/output toggles in Settings
- Animated recording pulse and listening indicator

### 🧠 Memory & Facts
- **Facts** — Rich key-value storage with **categories** (identity, preferences, relationships, dates, other), **confidence scores** (0–100), **source tracking** (direct statement, chat, WhatsApp), and **status** (saved, pending, rejected)
- **Smart Extraction** — Only extracts when user speaks in first-person ("I", "my", "me"), ignores other people's details. Confidence ≥75 auto-saves, 50–74 goes to Pending tab for approval, <50 discarded
- **Manual Fact Entry** — Add facts yourself from the Memory tab with a key, value, and category
- **Pending Approval** — Low-confidence facts await your approve/reject in a separate tab
- **Inline Editing** — Edit fact values directly by clicking the edit icon
- **Conversations** — Full chat sessions are saved to localStorage like ChatGPT, with auto-generated titles from the first message. Browse, reopen, or delete them from the sidebar
- **History** — Individual message history with search, per-entry delete, and bulk delete

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

| `whatsapp_qr` | Get the QR code link to connect WhatsApp (opens in browser) |

> **Note:** WhatsApp uses [Baileys](https://github.com/whiskeysockets/Baileys) (unofficial WhatsApp Web API). On first use, just call any WhatsApp tool (e.g. "List my WhatsApp chats") and then open `http://localhost:3001/api/whatsapp/qr` in your browser to see the QR code. Scan it with WhatsApp (Settings → Linked Devices → Link a Device). The QR is shown in the browser, not the terminal. Session is persisted in `server/sessions/whatsapp/`. Connection is lazy — established only when a WhatsApp tool is first called.

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
- **WhatsApp integration** — Connect your WhatsApp via QR code (Baileys-based). Dedicated Connections page with live status, connect/disconnect, and QR page access

### ⚙️ Settings
- API key configuration for Groq and Gemini
- AI provider selection (Groq, Gemini, or Auto-failover)
- Hotkey configuration (Caps Lock, F4, F3, M, Space)
- Voice input/output toggle switches
- All settings persist in browser localStorage

### 🎨 UI/UX
- Dark theme with custom design system (Nexu theme)
- Smooth transitions, hover states, and animations
- Custom scrollbar styling
- Empty state illustrations and guided tooltips
- Responsive layout with sidebar navigation
- Thinking dots animation and processing indicators

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

Open the URL shown by Vite (typically `http://localhost:5173`), go to Settings, enter your API key(s), and start chatting.

### Build for Production

```bash
npm run build
npm run preview
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React icons
- **Backend**: Node.js, Express 5, CORS
- **AI APIs**: Groq (Llama 3.3 70B), Google Gemini 2.0 Flash
- **Voice**: Groq Whisper (STT), Web Speech API (TTS)
- **Storage**: Browser localStorage (facts, conversation history, settings)

## Project Structure

```
nexu/
├── src/                    # Frontend source
│   ├── components/         # React components
│   │   ├── Chat.tsx        # Main chat area with scrolling
│   │   ├── ChatInput.tsx   # Message input with auto-resize
│   │   ├── Connections.tsx # WhatsApp connection management
│   │   ├── Header.tsx      # Status bar component
│   │   ├── MemoryView.tsx  # Facts & history browser
│   │   ├── MessageBubble.tsx # Message display component
│   │   ├── Settings.tsx    # Settings panel
│   │   ├── Sidebar.tsx     # Navigation sidebar
│   │   └── VoiceButton.tsx # Microphone button
│   ├── hooks/
│   │   └── useVoiceRecorder.ts # Audio recording hook
│   ├── services/
│   │   ├── api.ts          # AI provider API integration + tool parsing
│   │   ├── facts.ts        # Automatic fact extraction from conversations
│   │   ├── memory.ts       # localStorage-based facts & history storage
│   │   ├── stt.ts          # Speech-to-text via Groq Whisper
│   │   ├── tools.ts        # Tool registry & backend API calls
│   │   └── tts.ts          # Text-to-speech via Web Speech API
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   ├── App.tsx             # Root component with state management
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles & Tailwind theme
├── server/                 # Backend server
│   ├── index.js            # Express server & route definitions
│   ├── package.json        # Server dependencies
│   └── tools/
│       ├── browser.js      # URL opening & web search
│       ├── extra.js        # Clipboard, screenshots, YouTube playback
│       ├── files.js        # File operations & search
│       ├── pdf.js          # PDF text extraction
│       ├── system.js       # System control (battery, CPU, volume, etc.)
│       └── whatsapp.js     # WhatsApp (placeholder for Phase 2)
├── package.json            # Frontend dependencies & scripts
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── eslint.config.js        # ESLint configuration
```

## How It Works

1. **User sends a message** → Message appears in chat, sent to the selected AI provider with context (facts, history, tool descriptions)
2. **AI responds** → Response may contain inline `---TOOL---` JSON blocks for tool execution
3. **Tool execution** → Parsed tool calls are executed against the Express backend or browser APIs
4. **Follow-up** → Tool results are sent back to the AI for a natural language summary
5. **Memory extraction** → Facts are automatically extracted from conversations in the background
6. **Voice output** → If enabled, the response is spoken aloud via the browser's speech synthesis

## License

ISC
