import { User, Bot, Wrench } from 'lucide-react';
import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isAssistant = message.role === 'assistant';

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
          <p className="text-xs text-nexu-text-muted mb-1 ml-1 font-medium flex items-center gap-1">
            <Wrench size={12} /> {message.toolName}
          </p>
        )}
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-nexu-primary text-white rounded-tr-sm'
            : isTool
              ? 'bg-nexu-surface-2 text-nexu-text-dim border border-nexu-border rounded-tl-sm font-mono text-xs'
              : 'bg-nexu-surface-2 text-nexu-text border border-nexu-border rounded-tl-sm'
        }`}>
          {message.content}
        </div>
        <p className="text-[10px] text-nexu-text-muted mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
