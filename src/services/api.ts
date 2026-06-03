import type { Message } from '../types';

const SYSTEM_PROMPT = `You are Nexu, an AI desktop assistant. You are helpful, concise, and direct.
You can perform various tasks like answering questions, providing information, and executing commands.
Always respond in a natural, conversational tone. Be brief but thorough.

When you need to use a tool, mention it naturally in your response.
Available capabilities: web search, file operations, system info, clipboard, screenshots.`;

interface AIProvider {
  name: string;
  call: (messages: { role: string; content: string }[], apiKey: string) => Promise<string>;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const groqProvider: AIProvider = {
  name: 'groq',
  call: async (messages, apiKey) => {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  },
};

const geminiProvider: AIProvider = {
  name: 'gemini',
  call: async (messages, apiKey) => {
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMsg = messages[messages.length - 1];

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...history,
          {
            role: lastMsg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: lastMsg.content }],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  },
};

const providers: Record<string, AIProvider> = {
  groq: groqProvider,
  gemini: geminiProvider,
};

const PROVIDER_ORDER = ['groq', 'gemini'] as const;

export async function getAIResponse(
  messages: Message[],
  settings: { groqApiKey: string; geminiApiKey: string; provider: string }
): Promise<string> {
  const conversation = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  let lastError: Error | null = null;

  if (settings.provider !== 'auto') {
    const provider = providers[settings.provider];
    if (!provider) throw new Error(`Unknown provider: ${settings.provider}`);
    const key = settings.provider === 'groq' ? settings.groqApiKey : settings.geminiApiKey;
    if (!key) throw new Error(`No API key set for ${settings.provider}`);
    return await provider.call(conversation, key);
  }

  // Auto mode: try Groq first, fallback to Gemini
  for (const name of PROVIDER_ORDER) {
    const provider = providers[name];
    const key = name === 'groq' ? settings.groqApiKey : settings.geminiApiKey;
    if (!key) continue;

    try {
      return await provider.call(conversation, key);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`${name} failed, trying next provider:`, err);
    }
  }

  throw lastError || new Error('No AI providers available');
}
