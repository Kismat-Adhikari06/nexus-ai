import { saveFact, getRecentFacts } from './memory';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

let _lastExtracted = '';
let _extracting = false;

// Skip extraction for messages that can't possibly contain user facts
const FIRST_PERSON_PATTERN = /\b(I|me|my|mine|I'm|I've|I'd|I'll)\b/i;
const QUESTION_PATTERN = /\?\s*$|^(what|why|how|when|where|who|which|whose|can|could|will|would|shall|should|do|does|did|is|are|was|were|have|has|had)\b/i;

function shouldSkip(userText: string): boolean {
  const trimmed = userText.trim();
  const words = trimmed.split(/\s+/);
  // Must have at least 3 words
  if (words.length < 3) return true;
  // Must contain first-person pronoun
  if (!FIRST_PERSON_PATTERN.test(trimmed)) return true;
  // Skip questions — user is asking, not stating a fact
  if (QUESTION_PATTERN.test(trimmed)) return true;
  return false;
}

const EXTRACT_SYSTEM_PROMPT = `You extract ONLY personal facts the user shares about THEMSELVES.

RULES:
- ONLY extract when the user uses first-person (I, me, my, mine).
- NEVER extract names/details about other people.
- NEVER extract from greetings, numbers, or random text.
- Return nothing if there's nothing factual to extract.

Valid patterns: "My name is X", "I am X years old", "I live in X", "I work as X", "I like/love/hate X", "My favorite X is Y", "My wife/husband/girlfriend/boyfriend is X", "My birthday is X", "I was born on X".

Return ONLY valid JSON lines, one per fact:
{"key": "snake_case_key", "value": "fact_value", "category": "identity|preferences|relationships|important_dates|other", "confidence": 85, "source": "direct_statement"}

Confidence: 90-100 if explicitly stated, 75-89 if implied, 50-74 if uncertain, below 50 = don't return.

If nothing to extract, return absolutely nothing — no text at all.`;

export async function extractFacts(
  userText: string,
  _assistantText: string,
  groqApiKey: string
): Promise<void> {
  if (_extracting) return;
  if (!groqApiKey) return;
  if (shouldSkip(userText)) return;

  // Dedup check using just user text (never re-process the same user message)
  if (userText === _lastExtracted) return;
  _lastExtracted = userText;
  _extracting = true;

  try {
    const recentFacts = await getRecentFacts(30);
    const existingFacts = Object.entries(recentFacts)
      .map(([k, v]) => `${k}: ${v.value}`).join('\n');

    const extractPrompt = `Existing facts (don't duplicate):
${existingFacts || 'None yet'}

User message to analyze: "${userText}"`;

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
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
          const category = fact.category || 'other';
          const confidence = typeof fact.confidence === 'number' ? fact.confidence : 100;
          const source = fact.source || 'direct_statement';

          if (key && value) {
            const status = confidence >= 75 ? 'saved' : 'pending';
            await saveFact(key, value, { category, confidence, source, status });
            console.log(`Extracted fact: ${key} = ${value} (confidence: ${confidence}, status: ${status})`);
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
