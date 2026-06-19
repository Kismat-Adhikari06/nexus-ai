export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolName?: string;
  sources?: string[];
}

export type AppStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export type AppView = 'chat' | 'settings' | 'memory' | 'connections' | 'gmail';

export interface Settings {
  groqApiKey: string;
  geminiApiKey: string;
  hotkey: string;
  voiceInput: boolean;
  voiceOutput: boolean;
  theme: 'dark' | 'light';
  provider: 'groq' | 'gemini' | 'openrouter' | 'local' | 'nvidia';
}

export interface User {
  id: string;
  username: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
