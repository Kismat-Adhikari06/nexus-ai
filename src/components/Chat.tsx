import { useRef, useEffect } from 'react';
import { Bot } from 'lucide-react';
import MessageBubble from './MessageBubble';
import type { AppStatus, Message } from '../types';

interface ChatProps {
  messages: Message[];
  status: AppStatus;
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-nexu-surface-2 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full border-2 border-nexu-primary border-t-transparent animate-spin" />
      </div>
      <div className="bg-nexu-surface-2 border border-nexu-border rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5">
          <span className="think-dot w-2 h-2 rounded-full bg-nexu-text-dim inline-block" />
          <span className="think-dot w-2 h-2 rounded-full bg-nexu-text-dim inline-block" />
          <span className="think-dot w-2 h-2 rounded-full bg-nexu-text-dim inline-block" />
        </div>
      </div>
    </div>
  );
}

export default function Chat({ messages, status }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-nexu-primary-dim flex items-center justify-center mx-auto mb-6">
            <Bot size={32} className="text-nexu-primary-hover" />
          </div>
          <h2 className="text-xl font-semibold text-nexu-text mb-2">How can I help you?</h2>
          <p className="text-sm text-nexu-text-dim leading-relaxed">
            Ask me anything — I can search the web, manage files, check system info, and more.
            Press the mic button or type your message below.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-6">
            {['What\'s my battery at?', 'Open Chrome', 'Search for invoices'].map((suggestion) => (
              <span key={suggestion} className="px-3 py-1.5 text-xs rounded-full bg-nexu-surface-2 text-nexu-text-dim border border-nexu-border">
                {suggestion}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {(status === 'processing' || status === 'speaking') && (
          <ThinkingIndicator />
        )}

        {status === 'listening' && (
          <div className="flex items-center gap-2 text-sm text-nexu-accent-green ml-2">
            <span className="w-2 h-2 rounded-full bg-nexu-accent-green animate-pulse" />
            Listening...
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
