import { Mic, Loader2, Volume2, AlertCircle, Sun, Moon } from 'lucide-react';
import type { AppStatus } from '../types';

interface HeaderProps {
  status: AppStatus;
  onToggleMic?: () => void;
  isRecording?: boolean;
  theme?: string;
  onThemeChange?: (theme: string) => void;
}

const statusConfig: Record<AppStatus, { label: string; color: string; icon: React.ReactNode }> = {
  idle: { label: 'Ready', color: 'text-nexu-text-dim', icon: null },
  listening: { label: 'Listening...', color: 'text-nexu-accent-green', icon: <Mic size={14} className="animate-pulse" /> },
  processing: { label: 'Thinking...', color: 'text-nexu-accent-yellow', icon: <Loader2 size={14} className="animate-spin" /> },
  speaking: { label: 'Speaking...', color: 'text-nexu-accent-blue', icon: <Volume2 size={14} className="animate-pulse" /> },
  error: { label: 'Error', color: 'text-nexu-accent-red', icon: <AlertCircle size={14} /> },
};

export default function Header({ status, isRecording, theme, onThemeChange }: HeaderProps) {
  const config = statusConfig[status];
  const isDark = theme !== 'light';

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-nexu-border bg-nexu-surface/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-nexu-accent-red recording-pulse' : status === 'idle' ? 'bg-nexu-accent-green' : 'bg-nexu-accent-yellow'}`} />
          <span className="font-semibold text-lg tracking-tight text-nexu-text">Nexu</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={() => onThemeChange?.(isDark ? 'light' : 'dark')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexu-surface-2 border border-nexu-border text-nexu-text-dim hover:text-nexu-text hover:border-nexu-border/50 transition-colors cursor-pointer text-xs"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          <span className="font-medium">{isDark ? 'Light' : 'Dark'}</span>
        </button>

        {/* Status badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-nexu-surface-2 text-xs">
          {config.icon}
          <span className={`font-medium ${config.color}`}>{config.label}</span>
        </div>
      </div>
    </header>
  );
}
