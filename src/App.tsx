import { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import MemoryView from './components/MemoryView';
import Settings from './components/Settings';
import Connections from './components/Connections';
import Gmail from './components/Gmail';
import ChatInput from './components/ChatInput';
import LoginPage from './components/LoginPage';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { stripFiller, buildSystemPrompt } from './services/api';
import * as memory from './services/memory';
import { transcribeAudio } from './services/stt';

import { verifyToken, apiRequest } from './services/apiClient';
import type { AppStatus, AppView, Message, Conversation, User } from './types';

const LS_KEYS = 'nexu:groqApiKey';
const LS_GEMINI = 'nexu:geminiApiKey';
const LS_PROVIDER = 'nexu:provider';
const LS_LOCAL_ENDPOINT = 'nexu:localEndpoint';
const LS_LOCAL_MODEL = 'nexu:localModel';
const LS_LOCAL_API_KEY = 'nexu:localApiKey';
const LS_NVIDIA_KEY = 'nexu:nvidiaApiKey';
const LS_NVIDIA_MODEL = 'nexu:nvidiaModel';
const LS_OPENROUTER_KEY = 'nexu:openRouterApiKey';
const LS_GROQ_MODEL = 'nexu:groqModel';
const LS_GEMINI_MODEL = 'nexu:geminiModel';
const LS_OPENROUTER_MODEL = 'nexu:openRouterModel';
const LS_THEME = 'nexu:theme';
const LS_GOOGLE_CLIENT_ID = 'nexu:googleClientId';
const LS_GOOGLE_CLIENT_SECRET = 'nexu:googleClientSecret';

function generateId() {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadSetting(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function saveSetting(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

interface ToolCallResult {
  action: string;
  params: Record<string, unknown>;
  result: string;
}

function extractSources(calls: ToolCallResult[]): string[] {
  const urls: string[] = [];
  for (const call of calls) {
    const p = call.params || {};
    if (call.action === 'open_url' && p.url) {
      urls.push(String(p.url));
    } else if (call.action === 'search_web' && p.query) {
      urls.push(`https://duckduckgo.com/?q=${encodeURIComponent(String(p.query))}`);
    } else if (call.action === 'browser_navigate' && p.url) {
      urls.push(String(p.url));
    }
  }
  return urls;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [activeView, setActiveView] = useState<AppView>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const currentConvIdRef = useRef<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [groqApiKey, setGroqApiKey] = useState(() => loadSetting(LS_KEYS, ''));
  const [geminiApiKey, setGeminiApiKey] = useState(() => loadSetting(LS_GEMINI, ''));
  const [provider, setProvider] = useState(() => loadSetting(LS_PROVIDER, 'auto'));
  const [localEndpoint, setLocalEndpoint] = useState(() => loadSetting(LS_LOCAL_ENDPOINT, 'http://localhost:1234/v1/chat/completions'));
  const [localModel, setLocalModel] = useState(() => loadSetting(LS_LOCAL_MODEL, 'local-model'));
  const [localApiKey, setLocalApiKey] = useState(() => loadSetting(LS_LOCAL_API_KEY, ''));
  const [nvidiaApiKey, setNvidiaApiKey] = useState(() => loadSetting(LS_NVIDIA_KEY, ''));
  const [nvidiaModel, setNvidiaModel] = useState(() => loadSetting(LS_NVIDIA_MODEL, 'deepseek-ai/deepseek-v4-flash'));
  const [openRouterApiKey, setOpenRouterApiKey] = useState(() => loadSetting(LS_OPENROUTER_KEY, ''));
  const [groqModel, setGroqModel] = useState(() => loadSetting(LS_GROQ_MODEL, 'llama-3.3-70b-versatile'));
  const [geminiModel, setGeminiModel] = useState(() => loadSetting(LS_GEMINI_MODEL, 'gemini-2.0-flash'));
  const [openRouterModel, setOpenRouterModel] = useState(() => loadSetting(LS_OPENROUTER_MODEL, 'deepseek/deepseek-chat'));
  const [theme, setTheme] = useState<string>(() => loadSetting(LS_THEME, 'dark'));
  const [googleClientId, setGoogleClientId] = useState(() => loadSetting(LS_GOOGLE_CLIENT_ID, ''));
  const [googleClientSecret, setGoogleClientSecret] = useState(() => loadSetting(LS_GOOGLE_CLIENT_SECRET, ''));
  const [hotkey, setHotkey] = useState('F4');

  // ─── Auth ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    verifyToken().then(u => {
      if (u) setUser(u);
      setAuthLoading(false);
    });
  }, []);

  const handleAuth = (u: User) => {
    setUser(u);
    loadConversations();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setConversations([]);
    setActiveConversation(null);
  };

  // ─── Conversation persistence ─────────────────────────────────────────────

  async function loadConversations() {
    try {
      const data = await apiRequest<{ result: Conversation[] }>('/api/storage/conversations');
      setConversations(data.result || []);
    } catch { /* server not ready yet */ }
  }

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  async function syncConversations(convs: Conversation[]) {
    try {
      for (const conv of convs) {
        if (conv.id && conv.messages.length > 0) {
          await apiRequest(`/api/storage/conversations/${conv.id}`, {
            method: 'PUT',
            body: JSON.stringify({ title: conv.title, messages: conv.messages }),
          });
        }
      }
    } catch { /* ignore sync errors */ }
  }

  // Save conversations to server when they change
  const saveConversationsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user || conversations.length === 0) return;
    if (saveConversationsTimeoutRef.current) clearTimeout(saveConversationsTimeoutRef.current);
    saveConversationsTimeoutRef.current = setTimeout(() => syncConversations(conversations), 2000);
    return () => { if (saveConversationsTimeoutRef.current) clearTimeout(saveConversationsTimeoutRef.current); };
  }, [conversations, user]);

  useEffect(() => { saveSetting(LS_KEYS, groqApiKey); }, [groqApiKey]);
  useEffect(() => { saveSetting(LS_GEMINI, geminiApiKey); }, [geminiApiKey]);
  useEffect(() => { saveSetting(LS_PROVIDER, provider); }, [provider]);
  useEffect(() => { saveSetting(LS_LOCAL_ENDPOINT, localEndpoint); }, [localEndpoint]);
  useEffect(() => { saveSetting(LS_LOCAL_MODEL, localModel); }, [localModel]);
  useEffect(() => { saveSetting(LS_LOCAL_API_KEY, localApiKey); }, [localApiKey]);
  useEffect(() => { saveSetting(LS_NVIDIA_KEY, nvidiaApiKey); }, [nvidiaApiKey]);
  useEffect(() => { saveSetting(LS_NVIDIA_MODEL, nvidiaModel); }, [nvidiaModel]);
  useEffect(() => { saveSetting(LS_OPENROUTER_KEY, openRouterApiKey); }, [openRouterApiKey]);
  useEffect(() => { saveSetting(LS_GROQ_MODEL, groqModel); }, [groqModel]);
  useEffect(() => { saveSetting(LS_GEMINI_MODEL, geminiModel); }, [geminiModel]);
  useEffect(() => { saveSetting(LS_OPENROUTER_MODEL, openRouterModel); }, [openRouterModel]);
  useEffect(() => { saveSetting(LS_THEME, theme); }, [theme]);
  useEffect(() => { saveSetting(LS_GOOGLE_CLIENT_ID, googleClientId); }, [googleClientId]);
  useEffect(() => { saveSetting(LS_GOOGLE_CLIENT_SECRET, googleClientSecret); }, [googleClientSecret]);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Listen for navigate custom events (from Gmail page "Go to Connections" link)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail === 'connections') setActiveView('connections');
    };
    window.addEventListener('navigate', handler as EventListener);
    return () => window.removeEventListener('navigate', handler as EventListener);
  }, []);

  const { isRecording, startRecording, stopRecording, onRecordingComplete } = useVoiceRecorder();

  useEffect(() => {
    if (status === 'error') {
      errorTimeoutRef.current = setTimeout(() => setStatus('idle'), 5000);
      return () => { if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current); };
    }
  }, [status]);

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
      // Persist immediately so AI replies survive page refresh
      if (user && messages.length > 0) {
        apiRequest(`/api/storage/conversations/${convId}`, {
          method: 'PUT',
          body: JSON.stringify({ title: generateTitle(messages), messages }),
        }).catch(() => {});
      }
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
      // Save new conversation to server
      if (user) {
        apiRequest('/api/storage/conversations', {
          method: 'POST',
          body: JSON.stringify({ id, title: generateTitle(messages), messages }),
        }).catch(() => {});
      }
    }
  }, [messages, generateTitle, user]);

  const processAIResponse = useCallback(async (userText: string, currentMessages: Message[]) => {
    const recentFacts = await memory.getRecentFacts(20);
    let facts = Object.entries(recentFacts)
      .map(([k, v]) => `  ${k}: ${v.value}`).join('\n');
    // Always include the account username so Nexu knows how to address the user
    if (user && !recentFacts['name']) {
      facts = `  name: ${user.username}\n${facts}`;
    }
    const histEntries = await memory.searchHistory(userText, 3);
    const history = histEntries
      .map(r => `${r.role === 'user' ? 'User' : 'Nexu'}: ${r.content.substring(0, 200)}`).join('\n');

    // Build the system prompt with facts and history
    const systemPrompt = buildSystemPrompt(facts, history);

    // The server-side /api/chat endpoint handles the full autonomous loop:
    // LLM call → parse tool calls → execute tools → loop back to LLM → repeat
    // until the LLM returns pure conversational text (no tool calls).
    const data = await apiRequest<{
      result: { content: string; toolCalls: ToolCallResult[] };
    }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...currentMessages.map(m => ({ role: m.role, content: m.content })),
        ],
        groqApiKey,
        geminiApiKey,
        nvidiaApiKey,
        nvidiaModel,
        openRouterApiKey,
        groqModel,
        geminiModel,
        openRouterModel,
        provider: provider === 'auto' ? 'auto' : provider,
        localEndpoint,
        localModel,
        localApiKey,
      }),
    });

    const { content, toolCalls } = data.result;

    // Build tool messages for the UI (collapsible cards)
    const toolMessages: Message[] = (toolCalls || []).map(tc => ({
      id: generateId(),
      role: 'tool' as const,
      content: tc.result,
      timestamp: Date.now(),
      toolName: tc.action,
    }));

    return {
      text: content,
      toolMessages,
      toolCalls: (toolCalls || []) as unknown as { action: string; [key: string]: unknown }[],
    };
  }, [groqApiKey, geminiApiKey, nvidiaApiKey, nvidiaModel, openRouterApiKey, groqModel, geminiModel, openRouterModel, provider, user, localEndpoint, localModel, localApiKey]);

  const handleSendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: generateId(), role: 'user', content: text, timestamp: Date.now(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setStatus('processing');
    await memory.addToHistory('user', text);

    try {
      const cleanText = stripFiller(text);
      const { text: responseText, toolMessages, toolCalls } = await processAIResponse(cleanText, updatedMessages);

      // The server already looped through all tool executions autonomously
      // and returned the final natural-language response. No second AI call needed.
      const sources = extractSources(toolCalls as ToolCallResult[]);
      const allNew: Message[] = [
        ...toolMessages,
        {
          id: generateId(),
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
          sources: sources.length > 0 ? sources : undefined,
        },
      ];

      setMessages(prev => [...prev, ...allNew]);
      setStatus('idle');
      await memory.addToHistory('assistant', responseText);

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
  }, [messages, processAIResponse, user]);

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

  const handleDeleteConversation = useCallback(async (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversation === id) {
      setMessages([]);
      setActiveConversation(null);
      currentConvIdRef.current = null;
    }
    try { await apiRequest(`/api/storage/conversations/${id}`, { method: 'DELETE' }); } catch { /* ignore */ }
  }, [activeConversation]);

  useEffect(() => {
    currentConvIdRef.current = activeConversation;
  }, [activeConversation]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="h-screen bg-nexu-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-nexu-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onAuth={handleAuth} />;
  }

  return (
    <div className="h-screen flex flex-col bg-nexu-bg">
      <Header status={status} isRecording={isRecording} theme={theme} onThemeChange={setTheme} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          conversations={conversations}
          activeConversation={activeConversation}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onLogout={handleLogout}
        />
        {activeView === 'gmail' ? (
          <Gmail />
        ) : activeView === 'chat' ? (
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
            nvidiaApiKey={nvidiaApiKey}
            groqModel={groqModel}
            geminiModel={geminiModel}
            openRouterModel={openRouterModel}
            nvidiaModel={nvidiaModel}
            openRouterApiKey={openRouterApiKey}
            provider={provider}
            hotkey={hotkey}
            localEndpoint={localEndpoint}
            localModel={localModel}
            localApiKey={localApiKey}
            googleClientId={googleClientId}
            googleClientSecret={googleClientSecret}
            onGroqKeyChange={setGroqApiKey}
            onGeminiKeyChange={setGeminiApiKey}
            onNvidiaKeyChange={setNvidiaApiKey}
            onGroqModelChange={setGroqModel}
            onGeminiModelChange={setGeminiModel}
            onOpenRouterModelChange={setOpenRouterModel}
            onNvidiaModelChange={setNvidiaModel}
            onOpenRouterKeyChange={setOpenRouterApiKey}
            onGoogleClientIdChange={setGoogleClientId}
            onGoogleClientSecretChange={setGoogleClientSecret}
            onProviderChange={setProvider}
            onHotkeyChange={setHotkey}
            onLocalEndpointChange={setLocalEndpoint}
            onLocalModelChange={setLocalModel}
            onLocalApiKeyChange={setLocalApiKey}
          />
        ) : (
          <MemoryView />
        )}
      </div>
    </div>
  );
}
