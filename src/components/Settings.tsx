import { Key, Keyboard, Cpu } from 'lucide-react';

const HOTKEY_OPTIONS = ['Caps Lock', 'F4', 'F3', 'M', 'Space'];
const PROVIDER_OPTIONS = ['auto', 'groq', 'gemini'] as const;

interface SettingsProps {
  groqApiKey: string;
  geminiApiKey: string;
  provider: string;
  hotkey: string;
  onGroqKeyChange: (key: string) => void;
  onGeminiKeyChange: (key: string) => void;
  onProviderChange: (provider: string) => void;
  onHotkeyChange: (hotkey: string) => void;
}

export default function Settings({
  groqApiKey, geminiApiKey, provider, hotkey,
  onGroqKeyChange, onGeminiKeyChange, onProviderChange, onHotkeyChange,
}: SettingsProps) {

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
            <Cpu size={16} className="text-nexu-primary-hover" />
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

        <p className="text-xs text-nexu-text-muted">
          API keys are stored in your browser's localStorage and sent directly to the AI provider.
        </p>
      </div>
    </div>
  );
}
