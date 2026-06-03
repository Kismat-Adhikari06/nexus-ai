import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import VoiceButton from './VoiceButton';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  disabled?: boolean;
}

export default function ChatInput({ onSendMessage, onStartRecording, onStopRecording, isRecording, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  return (
    <div className="border-t border-nexu-border bg-nexu-surface p-4">
      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        {/* Voice Button */}
        <VoiceButton
          isRecording={isRecording}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          disabled={disabled}
        />

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or use the mic..."
            rows={1}
            disabled={disabled}
            className="w-full resize-none bg-nexu-bg border border-nexu-border rounded-xl px-4 py-3 pr-12 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 focus:ring-1 focus:ring-nexu-primary/30 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="w-12 h-12 rounded-xl bg-nexu-primary hover:bg-nexu-primary-hover disabled:bg-nexu-border disabled:text-nexu-text-muted text-white flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
