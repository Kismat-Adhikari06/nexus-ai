const FACTS_KEY = 'nexu:facts';
const HISTORY_KEY = 'nexu:history';

export interface Fact {
  value: string;
  category: 'identity' | 'preferences' | 'relationships' | 'important_dates' | 'other';
  confidence: number;
  source: 'user_chat' | 'whatsapp' | 'telegram' | 'direct_statement' | 'other';
  timestamp: string;
  status: 'saved' | 'pending' | 'rejected';
}

// --- Facts (key-value memory) ---

function getFactsStore(): Record<string, Fact> {
  try {
    const raw = localStorage.getItem(FACTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const values = Object.values(parsed);
    if (values.length > 0 && typeof values[0] === 'string') {
      // Migrate from old format (key → string) to new (key → Fact)
      const migrated: Record<string, Fact> = {};
      for (const [key, value] of Object.entries(parsed)) {
        migrated[key] = {
          value: value as string,
          category: 'other',
          confidence: 100,
          source: 'direct_statement',
          timestamp: new Date().toISOString(),
          status: 'saved',
        };
      }
      saveFactsStore(migrated);
      return migrated;
    }
    return parsed as Record<string, Fact>;
  } catch {
    return {};
  }
}

function saveFactsStore(facts: Record<string, Fact>) {
  try {
    localStorage.setItem(FACTS_KEY, JSON.stringify(facts));
  } catch { /* ignore */ }
}

export function saveFact(
  key: string,
  value: string,
  options?: {
    category?: Fact['category'];
    confidence?: number;
    source?: Fact['source'];
    status?: Fact['status'];
  }
): string {
  const facts = getFactsStore();
  facts[key.toLowerCase()] = {
    value,
    category: options?.category || 'other',
    confidence: options?.confidence ?? 100,
    source: options?.source || 'direct_statement',
    timestamp: new Date().toISOString(),
    status: options?.status || 'saved',
  };
  saveFactsStore(facts);
  return `Remembered: ${key} = ${value}`;
}

export function getFact(key: string): Fact | null {
  const facts = getFactsStore();
  return facts[key.toLowerCase()] || null;
}

export function getFactValue(key: string): string | null {
  const fact = getFact(key);
  return fact ? fact.value : null;
}

export function getAllFacts(): Record<string, Fact> {
  return getFactsStore();
}

export function deleteFact(key: string): string {
  const facts = getFactsStore();
  delete facts[key.toLowerCase()];
  saveFactsStore(facts);
  return `Forgot '${key}'`;
}

export function clearAllFacts(): void {
  saveFactsStore({});
}

export function updateFact(key: string, updates: Partial<Omit<Fact, 'timestamp'>>): boolean {
  const facts = getFactsStore();
  const k = key.toLowerCase();
  if (!facts[k]) return false;
  facts[k] = { ...facts[k], ...updates, timestamp: new Date().toISOString() };
  saveFactsStore(facts);
  return true;
}

export function listFacts(): string {
  const facts = getFactsStore();
  const entries = Object.entries(facts);
  if (entries.length === 0) return 'No saved facts yet.';
  return entries
    .filter(([, f]) => f.status === 'saved')
    .map(([k, f]) => `${k}: ${f.value}`)
    .join('\n');
}

export function getRecentFacts(n = 20): Record<string, Fact> {
  const facts = getFactsStore();
  const entries = Object.entries(facts)
    .filter(([, f]) => f.status === 'saved')
    .slice(0, n);
  return Object.fromEntries(entries);
}

export function getPendingFacts(): [string, Fact][] {
  const facts = getFactsStore();
  return Object.entries(facts).filter(([, f]) => f.status === 'pending');
}

export function approveFact(key: string): boolean {
  return updateFact(key, { status: 'saved' });
}

export function rejectFact(key: string): boolean {
  return updateFact(key, { status: 'rejected' });
}

// --- Conversation History ---

interface HistoryEntry {
  id: string;
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
  history.push({ id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2), role, content, timestamp: new Date().toISOString() });
  if (history.length > 100) history.splice(0, history.length - 100);
  saveHistory(history);
}

export function deleteHistoryEntry(id: string): void {
  const history = getHistory();
  const idx = history.findIndex(e => e.id === id);
  if (idx !== -1) {
    history.splice(idx, 1);
    saveHistory(history);
  }
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

export function clearAllHistory(): void {
  saveHistory([]);
}
