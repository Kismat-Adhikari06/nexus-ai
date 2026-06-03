import { useState, useEffect, useCallback } from 'react';
import { Save, Key, Mic, Volume2, Keyboard, MessageCircle, Link2, Unlink, ExternalLink, Loader2 } from 'lucide-react';
import { whatsAppStatus, clearWhatsAppSession } from '../services/tools';

const HOTKEY_OPTIONS = ['Caps Lock', 'F4', 'F3', 'M', 'Space'];
const PROVIDER_OPTIONS = ['auto', 'groq', 'gemini'] as const;
const QR_PAGE_URL = 'http://localhost:3001/api/whatsapp/qr';

interface SettingsProps {
  groqApiKey: string;
  geminiApiKey: string;
  provider: string;
  hotkey: string;
  voiceInput: boolean;
  voiceOutput: boolean;
  onGroqKeyChange: (key: string) => void;
  onGeminiKeyChange: (key: string) => void;
  onProviderChange: (provider: string) => void;
  onHotkeyChange: (hotkey: string) => void;
  onVoiceInputChange: (enabled: boolean) => void;
  onVoiceOutputChange: (enabled: boolean) => void;
}

export default function Settings({
  groqApiKey, geminiApiKey, provider, hotkey,
  voiceInput, voiceOutput,
  onGroqKeyChange, onGeminiKeyChange, onProviderChange, onHotkeyChange,
  onVoiceInputChange, onVoiceOutputChange,
}: SettingsProps) {

  const [waStatus, setWaStatus] = useState('Checking...');
  const [waConnected, setWaConnected] = useState(false);
  const [waClearing, setWaClearing] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    const result = await whatsAppStatus();
    setWaStatus(result);
    setWaConnected(result.includes('✅') || result.includes('Connected'));
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleDisconnect = async () => {
    setWaClearing(true);
    await clearWhatsAppSession();
    await checkStatus();
    setWaClearing(false);
  };

  const handleConnect = useCallback(async () => {
    setWaConnecting(true);
    try {
      await fetch('http://localhost:3001/api/whatsapp/connect', { method: 'POST' });
    } catch { /* ignore */ }
    // Open QR page in new tab
    const win = window.open(QR_PAGE_URL, '_blank');
    if (!win) {
      // Popup blocked — navigate directly
      window.location.href = QR_PAGE_URL;
    }
    // Refresh status after a short delay
    const timer = setTimeout(async () => {
      await checkStatus();
      setWaConnecting(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [checkStatus]);

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${
        enabled ? 'bg-nexu-primary' : 'bg-nexu-border'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'right-1' : 'left-1'
        }`}
      />
    </button>
  );

  const statusColor = waConnected ? 'text-nexu-accent-green' :
    waStatus.includes('⏳') ? 'text-nexu-accent-yellow' : 'text-nexu-accent-red';

  const statusBg = waConnected ? 'bg-nexu-accent-green/10 border-nexu-accent-green/30' :
    waStatus.includes('⏳') ? 'bg-nexu-accent-yellow/10 border-nexu-accent-yellow/30' : 'bg-nexu-accent-red/10 border-nexu-accent-red/30';

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-nexu-text mb-1">Settings</h2>
          <p className="text-sm text-nexu-text-dim">Configure your Nexu assistant</p>
        </div>

        {/* API Keys */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-nexu-text">
            <Key size={16} className="text-nexu-primary-hover" />
            API Keys
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-nexu-text-muted mb-1.5">Groq API Key</label>
              <input
                type="password"
                placeholder="gsk_..."
                value={groqApiKey}
                onChange={(e) => onGroqKeyChange(e.target.value)}
                className="w-full bg-nexu-bg border border-nexu-border rounded-lg px-3 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-nexu-text-muted mb-1.5">Gemini API Key</label>
              <input
                type="password"
                placeholder="AIza..."
                value={geminiApiKey}
                onChange={(e) => onGeminiKeyChange(e.target.value)}
                className="w-full bg-nexu-bg border border-nexu-border rounded-lg px-3 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
              />
            </div>
          </div>
        </section>

        {/* AI Provider */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-nexu-text">
            <Mic size={16} className="text-nexu-primary-hover" />
            AI Provider
          </div>
          <div className="flex gap-2">
            {PROVIDER_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => onProviderChange(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize border transition-colors cursor-pointer ${
                  provider === p
                    ? 'bg-nexu-primary-dim border-nexu-primary/30 text-nexu-primary-hover'
                    : 'bg-nexu-surface-2 border-nexu-border text-nexu-text-dim hover:border-nexu-border/50'
                }`}
              >
                {p === 'auto' ? 'Auto (Groq→Gemini)' : p}
              </button>
            ))}
          </div>
        </section>

        {/* Hotkey */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-nexu-text">
            <Keyboard size={16} className="text-nexu-primary-hover" />
            Hotkey
          </div>
          <div className="flex flex-wrap gap-2">
            {HOTKEY_OPTIONS.map((key) => (
              <button
                key={key}
                onClick={() => onHotkeyChange(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                  hotkey === key
                    ? 'bg-nexu-primary-dim border-nexu-primary/30 text-nexu-primary-hover'
                    : 'bg-nexu-surface-2 border-nexu-border text-nexu-text-dim hover:border-nexu-border/50'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </section>

        {/* WhatsApp */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-nexu-text">
            <MessageCircle size={16} className="text-nexu-primary-hover" />
            WhatsApp
          </div>

          {/* Status card */}
          <div className={`p-4 rounded-lg border ${statusBg} transition-colors`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${statusColor}`}>
                  {waConnected ? 'Connected' : waStatus.includes('⏳') ? 'Connecting' : 'Disconnected'}
                </span>
              </div>
              {waConnected && (
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-nexu-accent-green/20 text-nexu-accent-green text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-nexu-accent-green animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-nexu-text-dim mb-3 leading-relaxed">
              {waStatus}
            </p>
            <div className="flex gap-2">
              {!waConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={waConnecting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexu-primary hover:bg-nexu-primary-hover disabled:bg-nexu-border disabled:text-nexu-text-muted text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {waConnecting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                  {waConnecting ? 'Connecting...' : 'Connect WhatsApp'}
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  disabled={waClearing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexu-accent-red/20 hover:bg-nexu-accent-red/30 text-nexu-accent-red text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Unlink size={14} />
                  {waClearing ? 'Disconnecting...' : 'Disconnect'}
                </button>
              )}
              <a
                href={QR_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexu-surface-2 hover:bg-nexu-border border border-nexu-border text-nexu-text-dim hover:text-nexu-text text-sm font-medium transition-colors cursor-pointer no-underline"
              >
                <ExternalLink size={14} />
                Open QR Page
              </a>
            </div>
          </div>

          <p className="text-xs text-nexu-text-muted">
            WhatsApp uses Baileys (unofficial API). On first connection, scan the QR code displayed in the QR page.
            Session is saved so you only need to scan once.
          </p>
        </section>

        {/* Voice Toggles */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-nexu-text">
            <Volume2 size={16} className="text-nexu-primary-hover" />
            Voice
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg bg-nexu-surface-2 border border-nexu-border cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-nexu-text-dim"><Mic size={14} /></span>
                <div>
                  <p className="text-sm font-medium text-nexu-text">Voice Input</p>
                  <p className="text-xs text-nexu-text-muted">Enable microphone for speech-to-text</p>
                </div>
              </div>
              <Toggle enabled={voiceInput} onChange={() => onVoiceInputChange(!voiceInput)} />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg bg-nexu-surface-2 border border-nexu-border cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-nexu-text-dim"><Volume2 size={14} /></span>
                <div>
                  <p className="text-sm font-medium text-nexu-text">Voice Output</p>
                  <p className="text-xs text-nexu-text-muted">Enable text-to-speech for AI responses</p>
                </div>
              </div>
              <Toggle enabled={voiceOutput} onChange={() => onVoiceOutputChange(!voiceOutput)} />
            </label>
          </div>
        </section>

        <p className="text-xs text-nexu-text-muted">
          API keys are stored in your browser's localStorage and sent directly to the AI provider.
        </p>
      </div>
    </div>
  );
}
