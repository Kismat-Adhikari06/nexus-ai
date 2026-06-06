import { useState } from 'react';
import { User, Bot, Wrench, Volume2, Square, ChevronDown, ChevronRight, Copy, Check, ExternalLink } from 'lucide-react';
import { speak, stopSpeaking } from '../services/tts';
import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showToolContent, setShowToolContent] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isAssistant = message.role === 'assistant';
  const hasSources = isAssistant && message.sources && message.sources.length > 0;

  const toggleSpeak = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      speak(message.content, () => setIsPlaying(false));
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <>
              <button
                onClick={handleCopy}
                className="transition-colors text-nexu-text-muted hover:text-nexu-primary-hover"
                title={copied ? 'Copied' : 'Copy'}
              >
                {copied ? <Check size={14} className="text-nexu-accent-green" /> : <Copy size={14} />}
              </button>
              <button
                onClick={toggleSpeak}
                className={`transition-colors ${isPlaying ? 'text-nexu-accent-green' : 'text-nexu-text-muted hover:text-nexu-primary-hover'}`}
                title={isPlaying ? 'Stop' : 'Read aloud'}
              >
                {isPlaying ? <Square size={14} /> : <Volume2 size={14} />}
              </button>
              {hasSources && (
                <div className="relative" onMouseEnter={() => setShowSources(true)} onMouseLeave={() => setShowSources(false)}>
                  <button
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-nexu-surface-2 border border-nexu-border text-nexu-accent-green hover:text-nexu-accent-green/80 transition-colors cursor-pointer"
                    title={`${message.sources!.length} source${message.sources!.length > 1 ? 's' : ''}`}
                  >
                    <ExternalLink size={10} />
                    {message.sources!.length}
                  </button>
                  {showSources && (
                    <div
                      className="absolute bottom-full mb-2 left-0 min-w-[260px] max-w-[320px] bg-nexu-surface-2 border border-nexu-border rounded-xl shadow-xl p-2 z-50"
                    >
                      <p className="text-[10px] text-nexu-text-muted px-2 py-1 font-medium uppercase tracking-wider">Sources</p>
                      <div className="space-y-0.5">
                        {message.sources!.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs text-nexu-text-dim hover:text-nexu-text hover:bg-nexu-surface-1 transition-colors group"
                          >
                            <span className="text-nexu-accent-green/60 font-mono text-[10px] mt-0.5 shrink-0">{i + 1}.</span>
                            <span className="break-all leading-tight">{url}</span>
                            <ExternalLink size={10} className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-nexu-accent-green" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
