import type { Message } from '../types';

const TOOL_DESCRIPTIONS = `Available tools — ONLY use these for file, system, browser, or action requests. NEVER for chit-chat.

System Tools:
  get_battery — Check battery percentage and charging status
    {"action": "get_battery"}
  get_cpu — Check CPU usage
    {"action": "get_cpu"}
  get_ram — Check RAM usage
    {"action": "get_ram"}
  set_volume — Set system volume 0-100
    {"action": "set_volume", "level": 50}
  lock_workstation — Lock your computer
    {"action": "lock_workstation"}
  sleep — Put the computer to sleep
    {"action": "sleep"}
  shutdown — Shut down the computer (5s delay)
    {"action": "shutdown"}
  hibernate — Hibernate the computer
    {"action": "hibernate"}
  notify — Send a desktop notification
    {"action": "notify", "title": "Title", "message": "Body"}
  run_command — Run a shell command
    {"action": "run_command", "command": "echo hello"}
  launch_app — Launch an application (brave, chrome, firefox, edge, notepad, calculator, cmd, terminal, etc.)
    For browsers with multiple profiles, it auto-detects and lists them. Then call again with the profile name.
    {"action": "launch_app", "name": "chrome"}
    {"action": "launch_app", "name": "brave", "profile": "Profile 1"}

File Tools:
  open_file — Open a file with its default app
    {"action": "open_file", "path": "C:/path/to/file.txt"}
  open_in_vscode — Open a file or folder in VS Code
    {"action": "open_in_vscode", "path": "C:/path"}
  search_files — Search for files by name
    {"action": "search_files", "query": "invoice", "location": "C:/Users/..."}
  find_file — Search for a file across Desktop/Documents/Home
    {"action": "find_file", "filename": "project.docx"}
  get_file_info — Get file size and info
    {"action": "get_file_info", "path": "C:/path/to/file.txt"}
  list_directory — List contents of a directory
    {"action": "list_directory", "path": "C:/Users/..."}
  read_pdf — Extract text from a PDF file
    {"action": "read_pdf", "path": "C:/path/to/document.pdf"}

Browser Tools (Playwright — persistent headless browser):
  browser_launch — Start the headless browser. Auto-starts on first use, call explicitly if you closed it.
    {"action": "browser_launch"}
  browser_close — Close the browser completely. Use when done to free memory.
    {"action": "browser_close"}
  open_url — Navigate to a URL and return a **preview** of the page (first ~5 paragraphs, ~3000 chars by default). Use for any website the user wants to visit. **You can control how much content to return** by adding maxParagraphs and/or maxChars params. If the user asks for a specific amount (e.g. "first paragraph", "show 2 paragraphs"), set maxParagraphs to that number. Example: maxParagraphs=1 returns just the first paragraph. If the user needs more from the page, use browser_get_text to read more, or browser_snapshot to interact with elements.
    {"action": "open_url", "url": "https://example.com"}
    {"action": "open_url", "url": "https://en.wikipedia.org/wiki/Artificial_intelligence", "maxParagraphs": 1}
    {"action": "open_url", "url": "https://en.wikipedia.org/wiki/Artificial_intelligence", "maxParagraphs": 2}
  search_web — Search DuckDuckGo and return a **summary** of the results page (first ~8 paragraphs by default). Use for web searches. You can also use maxParagraphs to control how many results to return.
    {"action": "search_web", "query": "weather today"}
    {"action": "search_web", "query": "latest AI news", "maxParagraphs": 5}
  browser_navigate — Navigate to a URL without returning any content. Use after browser_act when you already know the page.
    {"action": "browser_navigate", "url": "https://example.com"}
  browser_snapshot — **Call this first to see interactive elements.** Returns a numbered list of every interactive element (links, buttons, inputs) and readable text (headings, paragraphs) on the current page. Each element has a ref ID like [1], [2], etc. Use the ref IDs with browser_act to interact.
    {"action": "browser_snapshot"}
  browser_act — Click or type on an element using its exact numeric ref ID from the snapshot. The refId MUST be a number like "3" or "11" — never a description. For 'click', provide refId and do="click". For 'type', also provide value. After acting, call browser_snapshot again to see the updated page.
    {"action": "browser_act", "refId": "3", "do": "click"}
    {"action": "browser_act", "refId": "5", "do": "type", "value": "hello world"}
  browser_act_and_wait — Same as browser_act but **waits for page navigation** after clicking a link. Use this when clicking on links, search results, or navigation buttons that load a new page. After clicking, the page will finish loading before you need to snapshot again.
    {"action": "browser_act_and_wait", "refId": "3", "do": "click"}
    {"action": "browser_act_and_wait", "refId": "2", "do": "type", "value": "search term"}
  browser_extract_text — Extract text from a specific CSS selector. Use when you need details from a particular section of the page.
    {"action": "browser_extract_text", "selector": "#main"}
  browser_get_text — Get the **full page text** as plain readable text (all paragraphs). Use this when the user wants you to read a lot of content from the page, or when open_url's preview wasn't enough.
    {"action": "browser_get_text"}
  browser_screenshot — Take a screenshot of the current page (returns base64). Use when the user asks to see something visually.
    {"action": "browser_screenshot"}

Memory Tools:
  remember — Save a fact about the user
    {"action": "remember", "key": "favorite_color", "value": "blue"}
  recall — Retrieve a saved fact
    {"action": "recall", "key": "favorite_color"}
  list_facts — List all saved facts
    {"action": "list_facts"}
  forget — Delete a saved fact
    {"action": "forget", "key": "favorite_color"}
  approve_fact — Approve a pending fact (low-confidence fact that needs user confirmation)
    {"action": "approve_fact", "key": "name"}
  reject_fact — Reject a pending fact
    {"action": "reject_fact", "key": "name"}
  search_memory — Search past conversations
    {"action": "search_memory", "query": "project name"}

WhatsApp Tools (Baileys — requires QR scan on first use):
  **ACTION PLAN for "text/send message to X":**
    1. Call send_whatsapp directly — put the contact name or number in "to" and message in "message".
    2. If that fails because the contact isn't found, call list_whatsapp_chats to find the right name.
    3. NEVER describe what you're about to do. NEVER ask permission. Just output ---TOOL--- and the JSON.
    4. IMPORTANT: Use the EXACT name or number the user gave you. Do NOT make up example numbers.

  list_whatsapp_chats — List recent WhatsApp conversations
    {"action": "list_whatsapp_chats", "limit": 10}
  get_whatsapp_messages — Get latest messages from a specific contact/chat
    {"action": "get_whatsapp_messages", "chat": "contact name or number", "limit": 10}
  send_whatsapp — Send a WhatsApp message to a contact name OR phone number. Works with BOTH.
    Examples: send to contact: {"action": "send_whatsapp", "to": "Mom", "message": "Hi!"}
    Examples: send to number: {"action": "send_whatsapp", "to": "+1234567890", "message": "Hi!"}
  get_unread_whatsapp — Get unread WhatsApp messages
    {"action": "get_unread_whatsapp"}
  whatsapp_status — Check WhatsApp connection status
    {"action": "whatsapp_status"}
  whatsapp_qr — Get the QR code link to connect WhatsApp (scan with phone)
    {"action": "whatsapp_qr"}
  whatsapp_clear_session — Clear WhatsApp session and auth (re-scan QR needed)
    {"action": "whatsapp_clear_session"}

  whatsapp_block — Block a WhatsApp contact (stops them from messaging you)
    {"action": "whatsapp_block", "contact": "contact name or number"}
  whatsapp_unblock — Unblock a previously blocked WhatsApp contact
    {"action": "whatsapp_unblock", "contact": "contact name or number"}
  whatsapp_delete_chat — Delete an entire WhatsApp conversation
    {"action": "whatsapp_delete_chat", "contact": "contact name or number"}
  whatsapp_archive — Archive a WhatsApp chat (hides it from main inbox)
    {"action": "whatsapp_archive", "contact": "contact name or number"}
  whatsapp_unarchive — Unarchive a WhatsApp chat (brings it back to main inbox)
    {"action": "whatsapp_unarchive", "contact": "contact name or number"}
  whatsapp_mute — Mute a WhatsApp contact (duration: '8hours', '1week', or 'always')
    {"action": "whatsapp_mute", "contact": "contact name or number", "duration": "always"}
  whatsapp_unmute — Unmute a previously muted WhatsApp contact
    {"action": "whatsapp_unmute", "contact": "contact name or number"}
  whatsapp_pin — Pin a WhatsApp chat to the top of your chat list
    {"action": "whatsapp_pin", "contact": "contact name or number"}
  whatsapp_unpin — Unpin a previously pinned WhatsApp chat
    {"action": "whatsapp_unpin", "contact": "contact name or number"}
  whatsapp_mark_read — Mark a WhatsApp chat as read
    {"action": "whatsapp_mark_read", "contact": "contact name or number"}
  whatsapp_report — Report and block a WhatsApp contact (blocks via API + gives manual report instructions)
    {"action": "whatsapp_report", "contact": "contact name or number"}

**QR Code Flow**: On first use, call a WhatsApp tool to trigger connection, then get the QR link by calling whatsapp_qr or opening http://localhost:3001/api/whatsapp/qr in your browser. Scan it with your phone. If you already scanned before but it's not working, say "Clear my WhatsApp session" and try again.

Gmail Tools (requires Gmail connection via Connections page):
  **ACTION PLAN for Gmail:**
    1. Check if connected: call gmail_status first before any Gmail tool.
    2. If not connected, tell the user to go to Connections page and connect Gmail.
    3. If connected, use the tools below.
    4. NEVER describe what you're about to do. NEVER ask permission. Just output ---TOOL--- and the JSON.

  gmail_status — Check if Gmail is connected and working
    {"action": "gmail_status"}
  list_emails — List recent emails from your inbox. Shows subject, sender, and preview for each.
    {"action": "list_emails", "maxResults": 5}
    {"action": "list_emails"} // defaults to 10
  get_email — Read the full content of a specific email by its ID. Use the ID from list_emails results.
    {"action": "get_email", "id": "12345abc"}
  send_email — Send an email via your Gmail account.
    {"action": "send_email", "to": "recipient@example.com", "subject": "Hello!", "body": "This is the email body."}
  search_emails — Search your inbox with a Gmail query. Supports Gmail search operators like "from:", "subject:", "has:attachment", etc.
    {"action": "search_emails", "query": "from:someone@example.com"}
    {"action": "search_emails", "query": "invoice", "maxResults": 5}
  list_labels — List all your Gmail labels (both system and custom).
    {"action": "list_labels"}

Extra Tools:
  clipboard_read — Read current clipboard content
    {"action": "clipboard_read"}
  clipboard_copy — Copy text to clipboard
    {"action": "clipboard_copy", "text": "text to copy"}
  screenshot — Take a screenshot
    {"action": "screenshot"}
  play_youtube — PLAY a song/video on YouTube (auto-opens first result directly). Use this when the user wants to PLAY something.
    {"action": "play_youtube", "query": "song name by artist"}

Rules:
- Greetings, thanks, goodbyes: just reply naturally. No tools.
- **Smart intent parsing**: Strip conversational filler from tool queries. If the user says "search recipes for me thanks", the tool JSON MUST use query:"recipes" — NOT query:"recipes for me thanks". Strip filler words like: for me, please, thanks, thank you, could you, can you, I need, I want, would you, just, maybe, perhaps.
- **YouTube intent**: CRITICAL to distinguish "play" from "search":
  - If user wants to PLAY something ("play X", "listen to X", "put on X") → use play_youtube
  - If user wants to SEARCH/BROWSE ("search for X on yt", "find X on youtube", "show me X", "look for X", "dont just pick show the search") → use open_url with a YouTube search URL
  - Also open_url with YouTube search when user mentions "slowed", "reverb", "remix", "cover", "live", "lyrics" — these are specific versions you shouldn't auto-pick
- Action requests (open, launch, search, find, send, check, lock, sleep, browser_act, browser_navigate, browser_snapshot, browser_extract_text, browser_get_text, browser_screenshot): NEVER write preliminary text like "Let me check..." or describe what you're about to do. Output the tool JSON directly after ---TOOL---. The parameter values MUST be the actual values from the snapshot, not descriptions or placeholders.
  Wrong: "Let me check your battery" + ---TOOL--- + {"action": "get_battery"}
  Correct: ---TOOL--- + {"action": "get_battery"}
- Don't ask permission for reversible actions. Only ask before destructive ones (shutdown, delete, format).
- Use forward slashes for paths (C:/Users/...).
- Be concise, friendly, and direct.
- **Browser workflow**: First navigate (open_url or browser_navigate), then call browser_snapshot to see the page as a numbered list. Use browser_act with the exact numeric ref ID (like "3" or "11") to click or type. **IMPORTANT: When clicking links or search results that navigate to a new page, ALWAYS use browser_act_and_wait instead of browser_act** — it waits for the new page to finish loading. NEVER use descriptions or brackets as refId — only use the literal numbers from the snapshot. Call browser_snapshot again after each action to see the updated page. When the user asks you to read page content or retrieve text, use browser_get_text instead of browser_snapshot — it returns clean plain text without technical formatting.
- **Respect quantity limits with maxParagraphs**: If the user asks for a specific amount of content ("first paragraph", "second paragraph", "give me 2 paragraphs", "first 3 paragraphs", etc.), use the maxParagraphs parameter on open_url to request exactly that many paragraphs. For example, if the user says "show me the first paragraph", use maxParagraphs: 1. If they say "give me 2 paragraphs", use maxParagraphs: 2. **Never** request the default (5 paragraphs) when the user specifies a quantity — always pass maxParagraphs to match their request exactly.
- Use ---TOOL--- followed by the tool JSON on a new line.`;

const SYSTEM_PROMPT = `You are Nexu, an autonomous AI assistant on Windows. Be concise, helpful, and direct.

You are an autonomous agent. When a user asks you to interact with a webpage, do not stop to ask for permission. Take initiative: immediately call browser_snapshot on your own to find the element IDs, and then call browser_act to fill fields or click buttons. Only reply with standard text when the entire task is complete.

${TOOL_DESCRIPTIONS}

Current facts about the user (for direct use — do NOT call recall for these):
{FACTS}

Relevant past conversations:
{HISTORY}

Facts above are for direct use — do NOT call recall to fetch them.`;

interface AIProvider {
  name: string;
  call: (messages: { role: string; content: string }[], apiKey: string, systemPrompt: string) => Promise<string>;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const groqProvider: AIProvider = {
  name: 'groq',
  call: async (messages, apiKey, systemPrompt) => {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  },
};

const geminiProvider: AIProvider = {
  name: 'gemini',
  call: async (messages, apiKey, systemPrompt) => {
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMsg = messages[messages.length - 1];

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...history,
          {
            role: lastMsg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: lastMsg.content }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  },
};

// ─── NVIDIA NIM provider ───────────────────────────────────────────────────
// OpenAI-compatible API hosted at https://integrate.api.nvidia.com/v1
// Supports a wide range of models — see https://build.nvidia.com/explore/discover
const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

const nvidiaProvider: AIProvider = {
  name: 'nvidia',
  call: async (messages, apiKey, systemPrompt) => {
    const model = localStorage.getItem('nexu:nvidiaModel') || 'deepseek-ai/deepseek-v4-flash';
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`NVIDIA NIM API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  },
};

// ─── Local / OpenAI-compatible provider ────────────────────────────────────
// Works with LM Studio (http://localhost:1234), Ollama (http://localhost:11434/v1),
// text-generation-webui, vLLM, or any OpenAI-compatible local server.
const localProvider: AIProvider = {
  name: 'local',
  call: async (messages, _apiKey, systemPrompt) => {
    const endpoint = localStorage.getItem('nexu:localEndpoint') || 'http://localhost:1234/v1/chat/completions';
    const model = localStorage.getItem('nexu:localModel') || 'local-model';
    const localApiKey = localStorage.getItem('nexu:localApiKey') || '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (localApiKey) headers['Authorization'] = `Bearer ${localApiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Local AI error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  },
};

const openRouterProvider: AIProvider = {
  name: 'openrouter',
  call: async (messages, apiKey, systemPrompt) => {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // OpenRouter-specific headers for model routing and credits tracking
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Nexu',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  },
};

const providers: Record<string, AIProvider> = { groq: groqProvider, gemini: geminiProvider, nvidia: nvidiaProvider, openrouter: openRouterProvider, local: localProvider };
const PROVIDER_ORDER = ['groq', 'gemini', 'openrouter', 'nvidia', 'local'] as const;

/** Build the rendered system prompt with user facts and history injected. */
export function buildSystemPrompt(facts: string, history: string): string {
  return SYSTEM_PROMPT
    .replace('{FACTS}', facts || 'None yet')
    .replace('{HISTORY}', history || 'None yet');
}

export async function getAIResponse(
  messages: Message[],
  settings: { groqApiKey: string; geminiApiKey: string; nvidiaApiKey?: string; nvidiaModel?: string; openRouterApiKey?: string; localEndpoint?: string; localModel?: string; localApiKey?: string; groqModel?: string; geminiModel?: string; openRouterModel?: string; provider: string },
  facts: string,
  history: string
): Promise<string> {
  // Filter out tool messages — they're already reflected in the assistant's response
  // and including them as 'assistant' confuses the AI into repeating tool calls
  const conversation = messages
    .filter(m => m.role !== 'tool')
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

  // Render system prompt with context
  const systemPrompt = SYSTEM_PROMPT
    .replace('{FACTS}', facts || 'None yet')
    .replace('{HISTORY}', history || 'None yet');

  // Persist local settings to localStorage so the provider can read them
  if (settings.localEndpoint) localStorage.setItem('nexu:localEndpoint', settings.localEndpoint);
  if (settings.localModel) localStorage.setItem('nexu:localModel', settings.localModel);
  if (settings.localApiKey) localStorage.setItem('nexu:localApiKey', settings.localApiKey);

  let lastError: Error | null = null;

  // Persist model selections to localStorage so server-side can read them
  if (settings.groqModel) localStorage.setItem('nexu:groqModel', settings.groqModel);
  if (settings.geminiModel) localStorage.setItem('nexu:geminiModel', settings.geminiModel);
  if (settings.openRouterModel) localStorage.setItem('nexu:openRouterModel', settings.openRouterModel);

  if (settings.provider !== 'auto') {
    const provider = providers[settings.provider];
    if (!provider) throw new Error(`Unknown provider: ${settings.provider}`);
    let key: string;
    if (settings.provider === 'groq') key = settings.groqApiKey;
    else if (settings.provider === 'gemini') key = settings.geminiApiKey;
    else if (settings.provider === 'nvidia') key = settings.nvidiaApiKey || '';
    else if (settings.provider === 'openrouter') key = settings.openRouterApiKey || '';
    else key = settings.localApiKey || '';
    if (!key && settings.provider !== 'local') throw new Error(`No API key set for ${settings.provider}`);
    return await provider.call(conversation, key, systemPrompt);
  }

  for (const name of PROVIDER_ORDER) {
    const provider = providers[name];
    let key: string;
    if (name === 'groq') key = settings.groqApiKey;
    else if (name === 'gemini') key = settings.geminiApiKey;
    else if (name === 'nvidia') key = settings.nvidiaApiKey || '';
    else if (name === 'openrouter') key = settings.openRouterApiKey || '';
    else key = settings.localApiKey || '';
    if (!key && name !== 'local') continue;

    try {
      return await provider.call(conversation, key, systemPrompt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`${name} failed, trying next provider:`, err);
    }
  }

  throw lastError || new Error('No AI providers available');
}

// Strip conversational filler from user input so 'search recipes for me thanks' becomes 'search recipes'
export function stripFiller(text: string): string {
  return text
    .replace(/\b(for me|please|thanks|thank you|could you|can you|i need|i want|would you|just|maybe|perhaps|a little|quickly)\b/gi, '')
    .replace(/\b(thank you|thanks|ty)\s*!*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Parse tool calls from AI response
export function parseToolCalls(text: string): { action: string; [key: string]: unknown }[] {
  const calls: { action: string; [key: string]: unknown }[] = [];
  const parts = text.split('---TOOL---');
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.startsWith('{')) {
      // Extract JSON object using brace matching to handle
      // trailing text like '---' that the LLM sometimes adds.
      let depth = 0;
      let jsonStart = -1;
      for (let j = 0; j < part.length; j++) {
        if (part[j] === '{') {
          if (depth === 0) jsonStart = j;
          depth++;
        } else if (part[j] === '}') {
          depth--;
          if (depth === 0 && jsonStart >= 0) {
            const jsonStr = part.substring(jsonStart, j + 1);
            try { calls.push(JSON.parse(jsonStr)); }
            catch { /* skip invalid JSON */ }
            jsonStart = -1;
          }
        }
      }
    }
  }
  return calls;
}
