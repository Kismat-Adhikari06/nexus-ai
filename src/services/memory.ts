import { apiRequest } from './apiClient';

export interface Fact {
  value: string;
  category: 'identity' | 'preferences' | 'relationships' | 'important_dates' | 'other';
  confidence: number;
  source: 'user_chat' | 'whatsapp' | 'telegram' | 'direct_statement' | 'account' | 'other';
  timestamp: string;
  status: 'saved' | 'pending' | 'rejected';
}

// ─── Facts ───────────────────────────────────────────────────────────────────

export async function getAllFacts(): Promise<Record<string, Fact>> {
  try {
    const data = await apiRequest<{ result: Record<string, Fact> }>('/api/storage/facts');
    return data.result || {};
  } catch { return {}; }
}

export async function saveFact(
  key: string,
  value: string,
  options?: {
    category?: Fact['category'];
    confidence?: number;
    source?: Fact['source'];
    status?: Fact['status'];
  }
): Promise<string> {
  try {
    const data = await apiRequest<{ result: string }>('/api/storage/facts/save', {
      method: 'POST',
      body: JSON.stringify({
        key,
        value,
        category: options?.category || 'other',
        confidence: options?.confidence ?? 100,
        source: options?.source || 'direct_statement',
        status: options?.status || 'saved',
      }),
    });
    return data.result;
  } catch { return 'Failed to save fact'; }
}

export async function getFact(key: string): Promise<Fact | null> {
  const facts = await getAllFacts();
  return facts[key.toLowerCase()] || null;
}

export async function getFactValue(key: string): Promise<string | null> {
  const fact = await getFact(key);
  return fact ? fact.value : null;
}

export async function deleteFact(key: string): Promise<string> {
  try {
    const data = await apiRequest<{ result: string }>(`/api/storage/facts/${encodeURIComponent(key.toLowerCase())}`, { method: 'DELETE' });
    return data.result;
  } catch { return 'Failed to delete fact'; }
}

export async function clearAllFacts(): Promise<void> {
  try { await apiRequest('/api/storage/facts', { method: 'DELETE' }); } catch { /* ignore */ }
}

export async function updateFact(key: string, updates: Partial<Omit<Fact, 'timestamp'>>): Promise<boolean> {
  try {
    await apiRequest(`/api/storage/facts/${encodeURIComponent(key.toLowerCase())}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return true;
  } catch { return false; }
}

export async function listFacts(): Promise<string> {
  const facts = await getAllFacts();
  const entries = Object.entries(facts).filter(([, f]) => f.status === 'saved');
  if (entries.length === 0) return 'No saved facts yet.';
  return entries.map(([k, f]) => `${k}: ${f.value}`).join('\n');
}

export async function getRecentFacts(n = 20): Promise<Record<string, Fact>> {
  const facts = await getAllFacts();
  const entries = Object.entries(facts).filter(([, f]) => f.status === 'saved').slice(0, n);
  return Object.fromEntries(entries);
}

export async function getPendingFacts(): Promise<[string, Fact][]> {
  const facts = await getAllFacts();
  return Object.entries(facts).filter(([, f]) => f.status === 'pending');
}

export async function approveFact(key: string): Promise<boolean> {
  return updateFact(key, { status: 'saved' });
}

export async function rejectFact(key: string): Promise<boolean> {
  return updateFact(key, { status: 'rejected' });
}

// ─── Conversation History ───────────────────────────────────────────────────

export async function addToHistory(role: 'user' | 'assistant', content: string): Promise<void> {
  try {
    await apiRequest('/api/storage/history', {
      method: 'POST',
      body: JSON.stringify({ role, content }),
    });
  } catch { /* ignore */ }
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  try { await apiRequest(`/api/storage/history/${id}`, { method: 'DELETE' }); } catch { /* ignore */ }
}

export async function searchHistory(query: string, n = 3): Promise<{ id: string; role: string; content: string; timestamp: string }[]> {
  try {
    const data = await apiRequest<{ result: { id: string; role: string; content: string; timestamp: string }[] }>(
      `/api/storage/history/search?q=${encodeURIComponent(query)}&limit=${n}`
    );
    return data.result || [];
  } catch { return []; }
}

export async function getRecentHistory(n = 5): Promise<{ id: string; role: string; content: string; timestamp: string }[]> {
  try {
    const data = await apiRequest<{ result: { id: string; role: string; content: string; timestamp: string }[] }>(
      `/api/storage/history?limit=${n}`
    );
    return data.result || [];
  } catch { return []; }
}

export async function clearAllHistory(): Promise<void> {
  try { await apiRequest('/api/storage/history', { method: 'DELETE' }); } catch { /* ignore */ }
}
