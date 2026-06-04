import { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import MemoryView from './components/MemoryView';
import Settings from './components/Settings';
import Connections from './components/Connections';
import ChatInput from './components/ChatInput';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { getAIResponse, parseToolCalls, stripFiller } from './services/api';
import { getRecentFacts, listFacts, saveFact, getFactValue, deleteFact, addToHistory, searchHistory, approveFact, rejectFact, getPendingFacts } from './services/memory';
import { transcribeAudio } from './services/stt';

import { extractFacts } from './services/facts';
import * as tools from './services/tools';
import type { AppStatus, AppView, Message, Conversation } from './types';

const LS_KEYS = 'nexu:groqApiKey';
const LS_GEMINI = 'nexu:geminiApiKey';
const LS_PROVIDER = 'nexu:provider';
const LS_CONVERSATIONS = 'nexu:conversations';

function generateId() {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadSetting(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function saveSetting(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

// Map action names to tool functions
const toolRegistry: Record<string, (...args: unknown[]) => Promise<string> | string> = {
  get_battery: tools.getBattery,
  get_cpu: tools.getCpu,
  get_ram: tools.getRam,
  set_volume: (level) => tools.setVolume(Number(level)),
  notify: (title, message) => tools.notify(String(title), String(message)),
  run_command: (command) => tools.runCommand(String(command)),
  launch_app: (name) => tools.launchApp(String(name)),
  lock_workstation: tools.lockWorkstation,
  sleep: tools.sleep,
  shutdown: tools.shutdownPC,
  hibernate: tools.hibernate,
  read_pdf: (path) => tools.readPdf(String(path)),
  open_file: (path) => tools.openFile(String(path)),
  open_in_vscode: (path) => tools.openInVscode(String(path)),
  search_files: (query, location) => tools.searchFiles(String(query), location ? String(location) : undefined),
  find_file: (filename) => tools.findFile(String(filename)),
  get_file_info: (path) => tools.getFileInfo(String(path)),
  list_directory: (path) => tools.listDirectory(path ? String(path) : undefined),
  open_url: (url) => tools.openUrl(String(url)),
  search_web: (query) => tools.searchWeb(String(query)),
  clipboard_read: tools.clipboardRead,
  clipboard_copy: (text) => tools.clipboardCopy(String(text)),
  screenshot: tools.screenshot,
  play_youtube: (query) => tools.playYoutube(String(query)),
  remember: (key, value) => saveFact(String(key), String(value)),
  recall: (key) => getFactValue(String(key)) || `I don't have anything saved for '${key}'`,
  list_facts: () => listFacts(),
  forget: (key) => deleteFact(String(key)),
  approve_fact: (key) => {
    const result = approveFact(String(key));
    return result ? `Approved fact '${key}'.` : `No pending fact found for '${key}'.`;
  },
  reject_fact: (key) => {
    const result = rejectFact(String(key));
    return result ? `Rejected fact '${key}'.` : `No pending fact found for '${key}'.`;
  },
  search_memory: (query) => {
    const results = searchHistory(String(query), 3);
    if (results.length === 0) return `No past conversations found matching '${query}'.`;
    return results.map(r => `[${r.timestamp}] ${r.role}: ${r.content.substring(0, 200)}`).join('\n');
  },
  // WhatsApp tools
  list_whatsapp_chats: (limit) => tools.listWhatsAppChats(limit ? Number(limit) : undefined),
  get_whatsapp_messages: (chat, limit) => tools.getWhatsAppMessages(String(chat), limit ? Number(limit) : undefined),
  send_whatsapp: (to, message) => tools.sendWhatsApp(String(to), String(message)),
  send_whatsapp_number: (phoneNumber, message) => tools.sendWhatsAppNumber(String(phoneNumber), String(message)),
  get_unread_whatsapp: () => tools.getUnreadWhatsApp(),
  whatsapp_status: () => tools.whatsAppStatus(),
  whatsapp_qr: async () => {
    const result = await tools.getWhatsAppQR();
    try {
      const data = JSON.parse(result);
      if (data.qrImage) {
        return `📱 Scan this QR code to link WhatsApp:\n\nOpen this link in your browser to scan:\nhttp://localhost:3001/api/whatsapp/qr\n\nThen scan with WhatsApp → Settings → Linked Devices → Link a Device`;
      }
      return `No QR code available. Status: ${data.connected ? 'Already connected' : 'Not connected yet. Try calling a WhatsApp tool first.'}`;
    } catch {
      return result;
    }
  },
  whatsapp_clear_session: () => tools.clearWhatsAppSession(),
  // Chat management
  whatsapp_block: (contact) => tools.blockWhatsAppContact(String(contact)),
  whatsapp_unblock: (contact) => tools.unblockWhatsAppContact(String(contact)),
  whatsapp_delete_chat: (contact) => tools.deleteWhatsAppChat(String(contact)),
  whatsapp_archive: (contact) => tools.archiveWhatsAppChat(String(contact)),
  whatsapp_unarchive: (contact) => tools.unarchiveWhatsAppChat(String(contact)),
  whatsapp_mute: (contact, duration) => tools.muteWhatsAppChat(String(contact), duration ? String(duration) : undefined),
  whatsapp_unmute: (contact) => tools.unmuteWhatsAppChat(String(contact)),
  whatsapp_pin: (contact) => tools.pinWhatsAppChat(String(contact)),
  whatsapp_unpin: (contact) => tools.unpinWhatsAppChat(String(contact)),
  whatsapp_mark_read: (contact) => tools.markWhatsAppRead(String(contact)),
  whatsapp_report: (contact) => tools.reportWhatsAppContact(String(contact)),
};

// Detailed mapping ensures correct arg order regardless of JSON key ordering
const TOOL_PARAM_KEYS: Record<string, string[]> = {
  set_volume: ['level'],
  notify: ['title', 'message'],
  run_command: ['command'],
  launch_app: ['name'],
  open_file: ['path'],
  open_in_vscode: ['path'],
  search_files: ['query', 'location'],
  find_file: ['filename'],
  get_file_info: ['path'],
  list_directory: ['path'],
  open_url: ['url'],
  search_web: ['query'],
  clipboard_copy: ['text'],
  play_youtube: ['query'],
  remember: ['key', 'value'],
  recall: ['key'],
  forget: ['key'],
  approve_fact: ['key'],
  reject_fact: ['key'],
  read_pdf: ['path'],
  search_memory: ['query'],
  lock_workstation: [],
  sleep: [],
  shutdown: [],
  hibernate: [],
  // WhatsApp tools
  list_whatsapp_chats: ['limit'],
  get_whatsapp_messages: ['chat', 'limit'],
  send_whatsapp: ['to', 'message'],
  send_whatsapp_number: ['phoneNumber', 'message'],
  get_unread_whatsapp: [],
  whatsapp_status: [],
  whatsapp_qr: [],
  whatsapp_clear_session: [],
  // Chat management
  whatsapp_block: ['contact'],
  whatsapp_unblock: ['contact'],
  whatsapp_delete_chat: ['contact'],
  whatsapp_archive: ['contact'],
  whatsapp_unarchive: ['contact'],
  whatsapp_mute: ['contact', 'duration'],
  whatsapp_unmute: ['contact'],
  whatsapp_pin: ['contact'],
  whatsapp_unpin: ['contact'],
  whatsapp_mark_read: ['contact'],
  whatsapp_report: ['contact'],
};

async function executeToolCall(call: { action: string; [key: string]: unknown }): Promise<string> {
  const { action, ...params } = call;
  const fn = toolRegistry[action];
  if (!fn) return `Unknown tool: ${action}`;

  try {
    // Map params by key order to ensure correct argument order
    const keys = TOOL_PARAM_KEYS[action] || Object.keys(params);
    const args = keys.map(k => params[k]);
    console.log(`Executing tool: ${action}`, params);
    return await Promise.resolve(fn(...args));
  } catch (e) {
    return `Failed: ${e instanceof Error ? e.message : 'Tool execution error'}`;
  }
}

export default function App() {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [activeView, setActiveView] = useState<AppView>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_CONVERSATIONS) || '[]');
    } catch { return []; }
  });
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const currentConvIdRef = useRef<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [groqApiKey, setGroqApiKey] = useState(() => loadSetting(LS_KEYS, ''));
  const [geminiApiKey, setGeminiApiKey] = useState(() => loadSetting(LS_GEMINI, ''));
  const [provider, setProvider] = useState(() => loadSetting(LS_PROVIDER, 'auto'));
  const [hotkey, setHotkey] = useState('F4');

  useEffect(() => { saveSetting(LS_KEYS, groqApiKey); }, [groqApiKey]);
  useEffect(() => { saveSetting(LS_GEMINI, geminiApiKey); }, [geminiApiKey]);
  useEffect(() => { saveSetting(LS_PROVIDER, provider); }, [provider]);

  const { isRecording, startRecording, stopRecording, onRecordingComplete } = useVoiceRecorder();

  useEffect(() => {
    if (status === 'error') {
      errorTimeoutRef.current = setTimeout(() => setStatus('idle'), 5000);
      return () => { if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current); };
    }
  }, [status]);

  // Generate a title from the first user message
  const generateTitle = useCallback((msgs: Message[]): string => {
    const firstUserMsg = msgs.find(m => m.role === 'user');
    if (!firstUserMsg) return 'New conversation';
    const text = firstUserMsg.content.trim();
    return text.length > 45 ? text.substring(0, 42) + '...' : text;
  }, []);

  // Keep current conversation in sync with messages
  useEffect(() => {
    if (messages.length === 0) return;
    const convId = currentConvIdRef.current;
    if (convId) {
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, messages, title: generateTitle(messages), updatedAt: Date.now() } : c
      ));
    } else {
      const id = generateId();
      currentConvIdRef.current = id;
      setActiveConversation(id);
      setConversations(prev => [...prev, {
        id,
        title: generateTitle(messages),
        messages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }]);
    }
  }, [messages, generateTitle]);

  // Persist conversations to localStorage
  useEffect(() => {
    try { localStorage.setItem(LS_CONVERSATIONS, JSON.stringify(conversations)); } catch { /* ignore */ }
  }, [conversations]);

  const processAIResponse = useCallback(async (userText: string, currentMessages: Message[]) => {
    // Build context from memory
    const facts = Object.entries(getRecentFacts(20))
      .map(([k, v]) => `  ${k}: ${v.value}`).join('\n');
    const history = searchHistory(userText, 3)
      .map(r => `${r.role === 'user' ? 'User' : 'Nexu'}: ${r.content.substring(0, 200)}`).join('\n');

    // Call AI
    const rawResponse = await getAIResponse(
      currentMessages,
      { groqApiKey, geminiApiKey, provider: provider === 'auto' ? 'auto' : provider },
      facts,
      history
    );

    // Parse tool calls
    const toolCalls = parseToolCalls(rawResponse);
    const text = rawResponse.split('---TOOL---')[0].trim();

    // Execute tools if any
    let toolResults: string[] = [];
    if (toolCalls.length > 0) {
      const toolMsgs: Message[] = [];
      for (const call of toolCalls) {
        const result = await executeToolCall(call);
        toolResults.push(result);
        toolMsgs.push({
          id: generateId(),
          role: 'tool',
          content: result,
          timestamp: Date.now(),
          toolName: call.action,
        });
      }
      // Add tool results as messages
      return { text: text || toolResults.join('. '), toolMessages: toolMsgs, toolCalls };
    }

    return { text, toolMessages: [] as Message[], toolCalls: [] as { action: string; [key: string]: unknown }[] };
  }, [groqApiKey, geminiApiKey, provider]);

  const handleSendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: generateId(), role: 'user', content: text, timestamp: Date.now(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setStatus('processing');
    addToHistory('user', text);

    try {
      // Strip filler so 'search recipes for me thanks' becomes clean intent
      const cleanText = stripFiller(text);
      const { text: responseText, toolMessages, toolCalls } = await processAIResponse(cleanText, updatedMessages);

      let finalContent = responseText;
      const allNew: Message[] = [];

      if (toolCalls.length > 0) {
        // Add tool result messages
        allNew.push(...toolMessages);

        // Second AI call: send tool results back for a proper response
        const toolResultsText = toolMessages.map(m =>
          `[${m.toolName}]: ${m.content}`
        ).join('\n');

        const followUp = [
          { role: 'user' as const, content: `Original request: "${text}"\n\nTool results:\n${toolResultsText}\n\nRespond to the user naturally based on these results. Be concise.` },
        ];

        try {
          const facts = Object.entries(getRecentFacts(20))
            .map(([k, v]) => `${k}: ${v.value}`).join('\n');
          const history = searchHistory(text, 3)
            .map(r => `${r.role === 'user' ? 'User' : 'Nexu'}: ${r.content.substring(0, 200)}`).join('\n');

          finalContent = await getAIResponse(
            followUp as unknown as Message[],
            { groqApiKey, geminiApiKey, provider },
            facts,
            history
          );
          // Strip any stray tool calls from the follow-up response
          finalContent = finalContent.split('---TOOL---')[0].trim();
        } catch {
          finalContent = responseText || `Done: ${toolCalls.map(t => t.action).join(', ')}`;
        }
      }

      const aiMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: finalContent,
        timestamp: Date.now(),
      };
      allNew.push(aiMsg);

      setMessages(prev => [...prev, ...allNew]);
      setStatus('idle');

      // Save to history
      addToHistory('assistant', finalContent);

      // Extract facts automatically (async, non-blocking)
      extractFacts(text, finalContent, groqApiKey);
    } catch (err) {
      const errorMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `⚠️ Error: ${err instanceof Error ? err.message : 'Failed to get AI response'}\n\nMake sure you've set your API keys in Settings and the backend server is running.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      setStatus('error');
    }
  }, [messages, processAIResponse, groqApiKey]);

  // STT: transcribe recorded audio and send as message (defined AFTER handleSendMessage)
  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    const apiKey = groqApiKey;
    if (!apiKey) {
      setMessages(prev => [...prev, {
        id: generateId(), role: 'assistant',
        content: '⚠️ Set your Groq API key in Settings to use voice input.',
        timestamp: Date.now(),
      }]);
      setStatus('idle');
      return;
    }

    setStatus('processing');
    try {
      const text = await transcribeAudio(blob, apiKey);
      if (text) {
        handleSendMessage(text);
      } else {
        setStatus('idle');
      }
    } catch {
      setStatus('idle');
    }
  }, [groqApiKey, handleSendMessage]);

  // Wire recording completion to STT + send
  useEffect(() => {
    onRecordingComplete((blob) => {
      handleRecordingComplete(blob);
    });
  }, [onRecordingComplete, handleRecordingComplete]);

  const handleStartRecording = useCallback(() => {
    startRecording();
    setStatus('listening');
  }, [startRecording]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveConversation(null);
    currentConvIdRef.current = null;
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      currentConvIdRef.current = id;
      setMessages(conv.messages);
      setActiveConversation(id);
    }
  }, [conversations]);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversation === id) {
      setMessages([]);
      setActiveConversation(null);
      currentConvIdRef.current = null;
    }
  }, [activeConversation]);

  // When active conversation changes, set the ref
  useEffect(() => {
    currentConvIdRef.current = activeConversation;
  }, [activeConversation]);

  return (
    <div className="h-screen flex flex-col bg-nexu-bg">
      <Header status={status} isRecording={isRecording} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          conversations={conversations}
          activeConversation={activeConversation}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
        />
        {activeView === 'chat' ? (
          <div className="flex-1 flex flex-col">
            <Chat messages={messages} status={status} />
            <ChatInput
              onSendMessage={handleSendMessage}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              isRecording={isRecording}
              disabled={status === 'processing'}
            />
          </div>
        ) : activeView === 'connections' ? (
          <Connections />
        ) : activeView === 'settings' ? (
          <Settings
            groqApiKey={groqApiKey}
            geminiApiKey={geminiApiKey}
            provider={provider}
            hotkey={hotkey}
            onGroqKeyChange={setGroqApiKey}
            onGeminiKeyChange={setGeminiApiKey}
            onProviderChange={setProvider}
            onHotkeyChange={setHotkey}
          />
        ) : (
          <MemoryView />
        )}
      </div>
    </div>
  );
}
