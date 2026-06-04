import { useState } from 'react';
import { User, Bot, Wrench, Volume2, Square, ChevronDown, ChevronRight } from 'lucide-react';
import { speak, stopSpeaking } from '../services/tts';
import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showToolContent, setShowToolContent] = useState(false);
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isAssistant = message.role === 'assistant';

  const toggleSpeak = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      speak(message.content, () => setIsPlaying(false));
    }
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-nexu-primary' : isTool ? 'bg-nexu-accent-yellow/20' : 'bg-nexu-surface-2'
      }`}>
        {isUser ? <User size={16} className="text-white" /> : isTool ? <Wrench size={16} className="text-nexu-accent-yellow" /> : <Bot size={16} className="text-nexu-primary-hover" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {isTool && message.toolName && (
          <button
            onClick={() => setShowToolContent(!showToolContent)}
            className="text-xs text-nexu-text-muted mb-1 ml-1 font-medium flex items-center gap-1 hover:text-nexu-text transition-colors cursor-pointer"
          >
            {showToolContent ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Wrench size={12} /> {message.toolName}
          </button>
        )}
        {(!isTool || showToolContent) && (
          <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-nexu-primary text-white rounded-tr-sm'
              : isTool
                ? 'bg-nexu-surface-2 text-nexu-text-dim border border-nexu-border rounded-tl-sm font-mono text-xs'
                : 'bg-nexu-surface-2 text-nexu-text border border-nexu-border rounded-tl-sm'
          }`}>
            {message.content}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1 px-1">
          <p className="text-[10px] text-nexu-text-muted">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {isAssistant && (
            <button
              onClick={toggleSpeak}
              className={`transition-colors ${isPlaying ? 'text-nexu-accent-green' : 'text-nexu-text-muted hover:text-nexu-primary-hover'}`}
              title={isPlaying ? 'Stop' : 'Read aloud'}
            >
              {isPlaying ? <Square size={14} /> : <Volume2 size={14} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
