const FACTS_KEY = 'nexu:facts';
const HISTORY_KEY = 'nexu:history';

// --- Facts (key-value memory) ---

function getFactsStore(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FACTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveFactsStore(facts: Record<string, string>) {
  try {
    localStorage.setItem(FACTS_KEY, JSON.stringify(facts));
  } catch { /* ignore */ }
}

export function saveFact(key: string, value: string): string {
  const facts = getFactsStore();
  facts[key.toLowerCase()] = value;
  saveFactsStore(facts);
  return `Remembered: ${key} = ${value}`;
}

export function getFact(key: string): string | null {
  const facts = getFactsStore();
  return facts[key.toLowerCase()] || null;
}

export function getAllFacts(): Record<string, string> {
  return getFactsStore();
}

export function deleteFact(key: string): string {
  const facts = getFactsStore();
  delete facts[key.toLowerCase()];
  saveFactsStore(facts);
  return `Forgot '${key}'`;
}

export function listFacts(): string {
  const facts = getFactsStore();
  const entries = Object.entries(facts);
  if (entries.length === 0) return 'No saved facts yet.';
  return entries.map(([k, v]) => `${k}: ${v}`).join('\n');
}

export function getRecentFacts(n = 20): Record<string, string> {
  const facts = getFactsStore();
  const entries = Object.entries(facts).slice(0, n);
  return Object.fromEntries(entries);
}

// --- Conversation History ---

interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
}

export function addToHistory(role: 'user' | 'assistant', content: string) {
  const history = getHistory();
  history.push({ role, content, timestamp: new Date().toISOString() });
  // Keep last 100 entries
  if (history.length > 100) history.splice(0, history.length - 100);
  saveHistory(history);
}

export function searchHistory(query: string, n = 3): HistoryEntry[] {
  const history = getHistory();
  const q = query.toLowerCase();
  const results: HistoryEntry[] = [];
  for (let i = history.length - 1; i >= 0 && results.length < n; i--) {
    if (history[i].content.toLowerCase().includes(q)) {
      results.push(history[i]);
    }
  }
  return results;
}

export function getRecentHistory(n = 5): HistoryEntry[] {
  const history = getHistory();
  return history.slice(-n);
}
