import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import Settings from './components/Settings';
import ChatInput from './components/ChatInput';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import type { AppStatus, AppView, Message, Conversation } from './types';

function generateId() {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function App() {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [activeView, setActiveView] = useState<AppView>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const { isRecording, startRecording, stopRecording, onRecordingComplete, error: micError } = useVoiceRecorder();

  // Handle recording completion via callback to avoid stale closure
  useEffect(() => {
    onRecordingComplete((blob) => {
      setStatus('processing');
      // TODO: Send blob to STT API
      setTimeout(() => setStatus('idle'), 1000);
    });
  }, [onRecordingComplete]);

  const handleSendMessage = useCallback((text: string) => {
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStatus('processing');

    // Simulate AI response (placeholder until API integration)
    setTimeout(() => {
      const aiMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `I received your message: "${text}". The AI integration will be connected in the next step.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setStatus('idle');
    }, 1500);
  }, []);

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
          <>
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
          </>
        ) : activeView === 'settings' ? (
          <Settings />
        ) : (
          <div className="flex-1 flex items-center justify-center text-nexu-text-dim">
            <p className="text-sm">Memory view coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
