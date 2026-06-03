import { Mic, Square } from 'lucide-react';


interface VoiceButtonProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
}

export default function VoiceButton({ isRecording, onStartRecording, onStopRecording, disabled }: VoiceButtonProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse ring when recording */}
      {isRecording && (
        <div className="absolute inset-0 rounded-full bg-nexu-accent-red/20 recording-pulse" />
      )}

      <button
        onClick={isRecording ? onStopRecording : onStartRecording}
        disabled={disabled}
        className={`group relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
          isRecording
            ? 'bg-nexu-accent-red hover:bg-red-600 shadow-lg shadow-nexu-accent-red/30'
            : 'bg-nexu-surface-2 hover:bg-nexu-border border border-nexu-border hover:border-nexu-primary/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <Square size={16} className="text-white fill-white" />
        ) : (
          <Mic size={18} className="text-nexu-text-dim group-hover:text-nexu-primary-hover" />
        )}
      </button>
    </div>
  );
}
