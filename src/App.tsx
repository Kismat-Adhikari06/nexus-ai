import { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import Settings from './components/Settings';
import ChatInput from './components/ChatInput';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import { getAIResponse } from './services/api';
import type { AppStatus, AppView, Message, Conversation } from './types';

const LS_KEYS = 'nexu:groqApiKey';
const LS_GEMINI = 'nexu:geminiApiKey';
const LS_PROVIDER = 'nexu:provider';

function generateId() {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadSetting(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch { /* ignore */ }
}

export default function App() {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [activeView, setActiveView] = useState<AppView>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings state (persisted to localStorage)
  const [groqApiKey, setGroqApiKey] = useState(() => loadSetting(LS_KEYS, ''));
  const [geminiApiKey, setGeminiApiKey] = useState(() => loadSetting(LS_GEMINI, ''));
  const [provider, setProvider] = useState(() => loadSetting(LS_PROVIDER, 'auto'));
  const [hotkey, setHotkey] = useState('F4');
  const [voiceInput, setVoiceInput] = useState(true);
  const [voiceOutput, setVoiceOutput] = useState(true);

  // Persist settings changes
  useEffect(() => { saveSetting(LS_KEYS, groqApiKey); }, [groqApiKey]);
  useEffect(() => { saveSetting(LS_GEMINI, geminiApiKey); }, [geminiApiKey]);
  useEffect(() => { saveSetting(LS_PROVIDER, provider); }, [provider]);

  const { isRecording, startRecording, stopRecording, onRecordingComplete } = useVoiceRecorder();

  // Handle recording completion
  useEffect(() => {
    onRecordingComplete((blob) => {
      setStatus('processing');
      // TODO: Send blob to STT API
      setTimeout(() => setStatus('idle'), 1000);
    });
  }, [onRecordingComplete]);

  // Auto-clear error status after 5 seconds
  useEffect(() => {
    if (status === 'error') {
      errorTimeoutRef.current = setTimeout(() => {
        setStatus('idle');
      }, 5000);
      return () => {
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      };
    }
  }, [status]);

  const handleSendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setStatus('processing');

    try {
      const activeProvider = provider === 'auto' ? 'auto' : provider;
      const response = await getAIResponse(updatedMessages, {
        groqApiKey,
        geminiApiKey,
        provider: activeProvider,
      });

      const aiMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setStatus('idle');
    } catch (err) {
      const errorMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `⚠️ Error: ${err instanceof Error ? err.message : 'Failed to get AI response'}\n\nMake sure you've set your API keys in Settings.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setStatus('error');
    }
  }, [messages, groqApiKey, geminiApiKey, provider]);

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
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setMessages(conv.messages);
      setActiveConversation(id);
    }
  }, [conversations]);

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
        ) : activeView === 'settings' ? (
          <Settings
            groqApiKey={groqApiKey}
            geminiApiKey={geminiApiKey}
            provider={provider}
            hotkey={hotkey}
            voiceInput={voiceInput}
            voiceOutput={voiceOutput}
            onGroqKeyChange={setGroqApiKey}
            onGeminiKeyChange={setGeminiApiKey}
            onProviderChange={setProvider}
            onHotkeyChange={setHotkey}
            onVoiceInputChange={setVoiceInput}
            onVoiceOutputChange={setVoiceOutput}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-nexu-text-dim">
            <p className="text-sm">Memory view coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
