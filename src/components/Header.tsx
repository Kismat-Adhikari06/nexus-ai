import { Mic, Loader2, Volume2, AlertCircle } from 'lucide-react';
import type { AppStatus } from '../types';

interface HeaderProps {
  status: AppStatus;
  onToggleMic?: () => void;
  isRecording?: boolean;
}

const statusConfig: Record<AppStatus, { label: string; color: string; icon: React.ReactNode }> = {
  idle: { label: 'Ready', color: 'text-nexu-text-dim', icon: null },
  listening: { label: 'Listening...', color: 'text-nexu-accent-green', icon: <Mic size={14} className="animate-pulse" /> },
  processing: { label: 'Thinking...', color: 'text-nexu-accent-yellow', icon: <Loader2 size={14} className="animate-spin" /> },
  speaking: { label: 'Speaking...', color: 'text-nexu-accent-blue', icon: <Volume2 size={14} className="animate-pulse" /> },
  error: { label: 'Error', color: 'text-nexu-accent-red', icon: <AlertCircle size={14} /> },
};

export default function Header({ status, isRecording }: HeaderProps) {
  const config = statusConfig[status];

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-nexu-border bg-nexu-surface/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-nexu-accent-red recording-pulse' : status === 'idle' ? 'bg-nexu-accent-green' : 'bg-nexu-accent-yellow'}`} />
          <span className="font-semibold text-lg tracking-tight text-nexu-text">Nexu</span>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-nexu-surface-2 text-xs">
        {config.icon}
        <span className={`font-medium ${config.color}`}>{config.label}</span>
      </div>
    </header>
  );
}
