import { useState, useCallback, type ReactNode } from 'react';
import { Key, Keyboard, Cpu, Eye, EyeOff, Server, Cpu as NvidiaIcon, RefreshCw } from 'lucide-react';

const HOTKEY_OPTIONS = ['Caps Lock', 'F4', 'F3', 'M', 'Space'];
const PROVIDER_OPTIONS = ['auto', 'groq', 'gemini', 'openrouter', 'nvidia', 'local'] as const;

const GROQ_MODEL_OPTIONS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', desc: 'Versatile general purpose' },
  { value: 'llama-3.2-90b-vision-preview', label: 'Llama 3.2 90B Vision', desc: 'Vision + text' },
  { value: 'llama-3.2-11b-vision-preview', label: 'Llama 3.2 11B Vision', desc: 'Vision + text (fast)' },
  { value: 'llama-3.2-3b-preview', label: 'Llama 3.2 3B', desc: 'Fast, lightweight' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', desc: '32K context, strong' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B', desc: 'Google, instruction tuned' },
  { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B', desc: 'Deep reasoning' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', desc: 'Fast, low latency' },
];

const GEMINI_MODEL_OPTIONS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: 'Fast & capable' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', desc: 'Lightweight & fast' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', desc: 'Legacy fast model' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', desc: 'Strong reasoning' },
  { value: 'gemini-2.5-pro-exp-03-25', label: 'Gemini 2.5 Pro Exp', desc: 'Experimental pro' },
];

const OPENROUTER_MODEL_OPTIONS = [
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3', desc: 'Strong general purpose' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1', desc: 'Deep reasoning' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', desc: 'Top-tier reasoning' },
  { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (free)', desc: 'Free tier' },
  { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', desc: 'General purpose' },
  { value: 'mistralai/mistral-large', label: 'Mistral Large', desc: 'Strong general' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Fast & cheap' },
  { value: 'openai/o3-mini', label: 'o3 Mini', desc: 'OpenAI reasoning' },
  { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', desc: 'Strong open model' },
];

const NVIDIA_MODEL_OPTIONS = [
  { value: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash', desc: 'Fast coding' },
  { value: 'deepseek-ai/deepseek-r1', label: 'DeepSeek R1', desc: 'Deep reasoning' },
  { value: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Nemotron 70B', desc: 'Strong reasoning' },
  { value: 'z-ai/glm-5.1', label: 'GLM-5.1', desc: 'Strong reasoning (Zhipu AI)' },
  { value: 'minimaxai/minimax-m2.7', label: 'MiniMax M2.7', desc: 'Strong reasoning (MiniMax)' },
  { value: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', desc: 'General purpose' },
  { value: 'mistralai/mistral-large-2411', label: 'Mistral Large', desc: 'Strong general' },
  { value: 'google/gemma-2-27b-it', label: 'Gemma 2 27B', desc: 'Instruction following' },
];

interface SettingsProps {
  groqApiKey: string;
  geminiApiKey: string;
  nvidiaApiKey: string;
  groqModel: string;
  geminiModel: string;
  openRouterModel: string;
  nvidiaModel: string;
  openRouterApiKey: string;
  provider: string;
  hotkey: string;
  localEndpoint: string;
  localModel: string;
  localApiKey: string;
  onGroqKeyChange: (key: string) => void;
  onGeminiKeyChange: (key: string) => void;
  onNvidiaKeyChange: (key: string) => void;
  onGroqModelChange: (model: string) => void;
  onGeminiModelChange: (model: string) => void;
  onOpenRouterModelChange: (model: string) => void;
  onNvidiaModelChange: (model: string) => void;
  onOpenRouterKeyChange: (key: string) => void;
  onProviderChange: (provider: string) => void;
  onHotkeyChange: (hotkey: string) => void;
  onLocalEndpointChange: (url: string) => void;
  onLocalModelChange: (model: string) => void;
  onLocalApiKeyChange: (key: string) => void;
}

// ─── Model fetching helpers ─────────────────────────────────────────────────

interface ModelOption {
  id: string;
  name: string;
}

async function fetchGroqModels(apiKey: string): Promise<ModelOption[]> {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Groq API error (${res.status})`);
  const data = await res.json();
  return (data.data || []).map((m: { id: string }) => ({ id: m.id, name: m.id }));
}

async function fetchGeminiModels(apiKey: string): Promise<ModelOption[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!res.ok) throw new Error(`Gemini API error (${res.status})`);
  const data = await res.json();
  return (data.models || [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: { name: string }) => ({
      id: m.name.replace('models/', ''),
      name: m.name.replace('models/', ''),
    }));
}

async function fetchOpenRouterModels(): Promise<ModelOption[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error(`OpenRouter API error (${res.status})`);
  const data = await res.json();
  return (data.data || []).map((m: { id: string }) => ({ id: m.id, name: m.id }));
}

async function fetchNvidiaModels(apiKey: string): Promise<ModelOption[]> {
  const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`NVIDIA API error (${res.status})`);
  const data = await res.json();
  return (data.data || []).map((m: { id: string }) => ({ id: m.id, name: m.id }));
}

// ─── Model Picker sub-component ─────────────────────────────────────────────

interface ModelPickerProps {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (model: string) => void;
  predefinedOptions: { value: string; label: string; desc: string }[];
  fetchModels: () => Promise<ModelOption[]>;
  providerName: string;
}

function ModelPicker({ label, icon, value, onChange, predefinedOptions, fetchModels, providerName }: ModelPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [fetchedModels, setFetchedModels] = useState<ModelOption[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const isCustomSelected = !predefinedOptions.some(o => o.value === value) &&
    !(fetchedModels?.some(m => m.id === value));

  const handleFetch = useCallback(async () => {
    setFetching(true);
    setFetchError('');
    try {
      const models = await fetchModels();
      setFetchedModels(models);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch models');
    }
    setFetching(false);
  }, [fetchModels]);

  return (
    <div className="mt-4 p-4 rounded-xl bg-nexu-surface-2 border border-nexu-border space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-nexu-text">
        {icon}
        {label}
      </div>

      {/* Fetch button */}
      <button
        onClick={handleFetch}
        disabled={fetching}
        className="flex items-center gap-1.5 text-xs text-nexu-primary-hover hover:underline disabled:opacity-50 cursor-pointer"
      >
        <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
        {fetching ? 'Fetching...' : `Fetch available models from ${providerName}`}
      </button>

      {fetchError && (
        <p className="text-xs text-red-400">{fetchError}</p>
      )}

      {/* Pre-defined model cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {predefinedOptions.map((model) => (
          <button
            key={model.value}
            onClick={() => {
              onChange(model.value);
              setShowCustom(false);
            }}
            className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors cursor-pointer ${
              value === model.value && !fetchedModels?.some(m => m.id === model.value)
                ? 'bg-nexu-primary-dim border-nexu-primary/30 text-nexu-primary-hover'
                : 'bg-nexu-bg border-nexu-border text-nexu-text-dim hover:border-nexu-border/50'
            }`}
          >
            <div className="font-medium text-nexu-text">{model.label}</div>
            <div className="text-xs text-nexu-text-muted mt-0.5">{model.desc}</div>
            <div className="text-[10px] text-nexu-text-muted mt-0.5 font-mono truncate">{model.value}</div>
          </button>
        ))}
      </div>

      {/* Fetched models from API */}
      {fetchedModels && fetchedModels.length > 0 && (
        <div>
          <p className="text-xs text-nexu-text-muted mb-2">
            Fetched from API ({fetchedModels.length} models):
          </p>
          <select
            value={fetchedModels.some(m => m.id === value) ? value : ''}
            onChange={(e) => { onChange(e.target.value); setShowCustom(false); }}
            className="w-full bg-nexu-bg border border-nexu-border rounded-lg px-3 py-2 text-sm text-nexu-text outline-none focus:border-nexu-primary/50 transition-colors"
          >
            <option value="">— Select from fetched models —</option>
            {fetchedModels.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Custom model toggle */}
      <div>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs text-nexu-primary-hover hover:underline cursor-pointer"
        >
          {showCustom ? 'Hide custom model' : 'Or enter a custom model name...'}
        </button>
        {showCustom && (
          <div className="mt-2">
            <input
              type="text"
              placeholder="e.g. provider/model-name"
              value={isCustomSelected ? value : customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                if (e.target.value.trim()) onChange(e.target.value.trim());
              }}
              className="w-full bg-nexu-bg border border-nexu-border rounded-lg px-3 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Settings({
  groqApiKey, geminiApiKey, nvidiaApiKey,
  groqModel, geminiModel, openRouterModel, nvidiaModel,
  openRouterApiKey, provider, hotkey,
  localEndpoint, localModel, localApiKey,
  onGroqKeyChange, onGeminiKeyChange, onNvidiaKeyChange,
  onGroqModelChange, onGeminiModelChange, onOpenRouterModelChange, onNvidiaModelChange,
  onOpenRouterKeyChange, onProviderChange, onHotkeyChange,
  onLocalEndpointChange, onLocalModelChange, onLocalApiKeyChange,
}: SettingsProps) {
  const [showGroq, setShowGroq] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showNvidia, setShowNvidia] = useState(false);
  const [showOpenRouter, setShowOpenRouter] = useState(false);
  const [showLocalKey, setShowLocalKey] = useState(false);

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
            Remote API Keys
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-nexu-text-muted mb-1.5">Groq API Key</label>
              <div className="relative">
                <input
                  type={showGroq ? 'text' : 'password'}
                  placeholder="gsk_..."
                  value={groqApiKey}
                  onChange={(e) => onGroqKeyChange(e.target.value)}
                  className="w-full bg-nexu-bg border border-nexu-border rounded-lg pl-3 pr-10 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowGroq(!showGroq)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-nexu-surface-2 border border-nexu-border text-nexu-text-dim hover:text-nexu-text hover:border-nexu-text-muted transition-colors cursor-pointer"
                  title={showGroq ? 'Hide key' : 'Show key'}
                >
                  {showGroq ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-nexu-text-muted mb-1.5">Gemini API Key</label>
              <div className="relative">
                <input
                  type={showGemini ? 'text' : 'password'}
                  placeholder="AIza..."
                  value={geminiApiKey}
                  onChange={(e) => onGeminiKeyChange(e.target.value)}
                  className="w-full bg-nexu-bg border border-nexu-border rounded-lg pl-3 pr-10 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowGemini(!showGemini)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-nexu-surface-2 border border-nexu-border text-nexu-text-dim hover:text-nexu-text hover:border-nexu-text-muted transition-colors cursor-pointer"
                >
                  {showGemini ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {/* NVIDIA API Key */}
            <div>
              <label className="block text-xs text-nexu-text-muted mb-1.5">NVIDIA NIM API Key</label>
              <div className="relative">
                <input
                  type={showNvidia ? 'text' : 'password'}
                  placeholder="nvapi-..."
                  value={nvidiaApiKey}
                  onChange={(e) => onNvidiaKeyChange(e.target.value)}
                  className="w-full bg-nexu-bg border border-nexu-border rounded-lg pl-3 pr-10 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNvidia(!showNvidia)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-nexu-surface-2 border border-nexu-border text-nexu-text-dim hover:text-nexu-text hover:border-nexu-text-muted transition-colors cursor-pointer"
                  title={showNvidia ? 'Hide key' : 'Show key'}
                >
                  {showNvidia ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {/* OpenRouter API Key */}
            <div>
              <label className="block text-xs text-nexu-text-muted mb-1.5">OpenRouter API Key</label>
              <div className="relative">
                <input
                  type={showOpenRouter ? 'text' : 'password'}
                  placeholder="sk-or-..."
                  value={openRouterApiKey}
                  onChange={(e) => onOpenRouterKeyChange(e.target.value)}
                  className="w-full bg-nexu-bg border border-nexu-border rounded-lg pl-3 pr-10 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenRouter(!showOpenRouter)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-nexu-surface-2 border border-nexu-border text-nexu-text-dim hover:text-nexu-text hover:border-nexu-text-muted transition-colors cursor-pointer"
                  title={showOpenRouter ? 'Hide key' : 'Show key'}
                >
                  {showOpenRouter ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-nexu-text-muted mt-1">
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-nexu-primary-hover hover:underline"
                >Get your API key</a>
              </p>
            </div>
          </div>
        </section>

        {/* AI Provider */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-nexu-text">
            <Cpu size={16} className="text-nexu-primary-hover" />
            AI Provider
          </div>
          <div className="flex gap-2 flex-wrap">
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
                {p === 'auto' ? 'Auto' : p}
              </button>
            ))}
          </div>

          {/* Groq model selector */}
          {(provider === 'groq' || (provider === 'auto' && groqApiKey)) && groqApiKey && (
            <ModelPicker
              label="Groq Model"
              icon={<NvidiaIcon size={16} className="text-orange-400" />}
              value={groqModel}
              onChange={onGroqModelChange}
              predefinedOptions={GROQ_MODEL_OPTIONS}
              fetchModels={() => fetchGroqModels(groqApiKey)}
              providerName="Groq"
            />
          )}

          {/* Gemini model selector */}
          {(provider === 'gemini' || (provider === 'auto' && geminiApiKey)) && geminiApiKey && (
            <ModelPicker
              label="Gemini Model"
              icon={<NvidiaIcon size={16} className="text-blue-400" />}
              value={geminiModel}
              onChange={onGeminiModelChange}
              predefinedOptions={GEMINI_MODEL_OPTIONS}
              fetchModels={() => fetchGeminiModels(geminiApiKey)}
              providerName="Gemini"
            />
          )}

          {/* OpenRouter model selector */}
          {(provider === 'openrouter' || (provider === 'auto' && openRouterApiKey)) && openRouterApiKey && (
            <ModelPicker
              label="OpenRouter Model"
              icon={<NvidiaIcon size={16} className="text-yellow-400" />}
              value={openRouterModel}
              onChange={onOpenRouterModelChange}
              predefinedOptions={OPENROUTER_MODEL_OPTIONS}
              fetchModels={fetchOpenRouterModels}
              providerName="OpenRouter"
            />
          )}

          {/* NVIDIA model selector */}
          {(provider === 'nvidia' || (provider === 'auto' && nvidiaApiKey)) && nvidiaApiKey && (
            <ModelPicker
              label="NVIDIA NIM Model"
              icon={<NvidiaIcon size={16} className="text-green-400" />}
              value={nvidiaModel}
              onChange={onNvidiaModelChange}
              predefinedOptions={NVIDIA_MODEL_OPTIONS}
              fetchModels={() => fetchNvidiaModels(nvidiaApiKey)}
              providerName="NVIDIA"
            />
          )}

          {/* Local AI settings — shown when local is selected or auto */}
          {(provider === 'local' || provider === 'auto') && (
            <div className="mt-4 p-4 rounded-xl bg-nexu-surface-2 border border-nexu-border space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-nexu-text">
                <Server size={16} className="text-nexu-primary-hover" />
                Local AI (OpenAI-compatible)
              </div>
              <div>
                <label className="block text-xs text-nexu-text-muted mb-1.5">Endpoint URL</label>
                <input
                  type="text"
                  placeholder="http://localhost:1234/v1/chat/completions"
                  value={localEndpoint}
                  onChange={(e) => onLocalEndpointChange(e.target.value)}
                  className="w-full bg-nexu-bg border border-nexu-border rounded-lg px-3 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors font-mono"
                />
                <p className="text-xs text-nexu-text-muted mt-1">
                  LM Studio: <code className="text-nexu-text-dim">http://localhost:1234/v1/chat/completions</code>
                  &nbsp;· Ollama: <code className="text-nexu-text-dim">http://localhost:11434/v1/chat/completions</code>
                </p>
              </div>
              <div>
                <label className="block text-xs text-nexu-text-muted mb-1.5">Model Name</label>
                <input
                  type="text"
                  placeholder="local-model"
                  value={localModel}
                  onChange={(e) => onLocalModelChange(e.target.value)}
                  className="w-full bg-nexu-bg border border-nexu-border rounded-lg px-3 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
                />
                <p className="text-xs text-nexu-text-muted mt-1">
                  The model name your local server expects (e.g. <code className="text-nexu-text-dim">llama-3.2-3b-instruct</code>)
                </p>
              </div>
              <div>
                <label className="block text-xs text-nexu-text-muted mb-1.5">API Key (optional)</label>
                <div className="relative">
                  <input
                    type={showLocalKey ? 'text' : 'password'}
                    placeholder="sk-... or leave empty"
                    value={localApiKey}
                    onChange={(e) => onLocalApiKeyChange(e.target.value)}
                    className="w-full bg-nexu-bg border border-nexu-border rounded-lg pl-3 pr-10 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLocalKey(!showLocalKey)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-nexu-surface-2 border border-nexu-border text-nexu-text-dim hover:text-nexu-text hover:border-nexu-text-muted transition-colors cursor-pointer"
                  >
                    {showLocalKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          )}
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
          Local AI settings are also sent to the Nexu backend server so the autonomous agent loop can use them.
        </p>
      </div>
    </div>
  );
}
