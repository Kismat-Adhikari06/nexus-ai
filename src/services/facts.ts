import { saveFact, getRecentFacts } from './memory';
import type { Message } from '../types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

let _lastExtracted = '';
let _extracting = false;

export async function extractFacts(
  userText: string,
  assistantText: string,
  groqApiKey: string
): Promise<void> {
  if (_extracting) return;
  if (!groqApiKey) return;

  const combined = (userText + '|' + assistantText).trim();
  if (combined === _lastExtracted) return;
  if (userText.split(' ').length < 2 && assistantText.split(' ').length < 3) return;

  _lastExtracted = combined;
  _extracting = true;

  try {
    const existingFacts = Object.entries(getRecentFacts(30))
      .map(([k, v]) => `${k}: ${v}`).join('\n');

    const extractPrompt = `Extract factual information the user shared. Return ONLY valid JSON lines, one per fact:
{"key": "snake_case_key", "value": "fact_value"}
Example: {"key": "favorite_color", "value": "blue"}
If nothing to extract, return nothing.

Existing facts (don't duplicate):
${existingFacts || 'None yet'}

User: ${userText}
Assistant: ${assistantText}`;

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You extract user facts from conversations. Return ONLY JSON lines.' },
          { role: 'user', content: extractPrompt },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
    });

    if (!res.ok) return;

    const data = await res.json();
    const result = data.choices[0]?.message?.content || '';

    for (const line of result.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.includes('}')) {
        try {
          const fact = JSON.parse(trimmed);
          const key = fact.key?.trim();
          const value = fact.value?.trim();
          if (key && value) {
            saveFact(key, value);
            console.log(`Extracted fact: ${key} = ${value}`);
          }
        } catch { /* skip invalid JSON */ }
      }
    }
  } catch {
    // Silently fail - this is optional
  } finally {
    _extracting = false;
  }
}
