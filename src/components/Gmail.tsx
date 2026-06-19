import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Inbox, Send, Reply, RefreshCw, Loader2, ChevronLeft, Calendar, AlertCircle, X, ExternalLink, CheckCircle, Search, Sparkles } from 'lucide-react';

const API_BASE = 'http://localhost:3001';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('nexu:auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch { /* ignore */ }
  return headers;
}

async function apiFetch<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
  const opts: RequestInit = {
    method: body ? 'POST' : 'GET',
    headers: getAuthHeaders(),
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  const data = await res.json();
  return data.result as T;
}

interface EmailSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  labelIds: string[];
}

interface EmailDetail extends EmailSummary {
  body: string;
  htmlBody?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Gmail-style avatar colors
const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#4f46e5', '#9333ea', '#c026d3', '#e11d48',
  '#15803d', '#0d9488', '#6366f1', '#a21caf', '#b45309',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const cleaned = name.replace(/['"]/g, '').trim();
  // Try to get first letter of first and last name
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return cleaned.substring(0, 2).toUpperCase();
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();

    const dYear = d.getFullYear();
    const dMonth = d.getMonth();
    const dDay = d.getDate();

    if (dYear === now.getFullYear() && dMonth === now.getMonth() && dDay === now.getDate()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dYear === yesterday.getFullYear() && dMonth === yesterday.getMonth() && dDay === yesterday.getDate()) {
      return 'Yesterday';
    }

    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });

    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return dateStr.substring(0, 10);
  }
}

function extractEmailName(from: string): string {
  const match = from.match(/^"?([^"<]*)"?\s*</);
  return match ? match[1].trim() || from : from.split('@')[0];
}

function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

// ─── Compose Form ───────────────────────────────────────────────────────────

interface ComposeFormProps {
  initialTo?: string;
  initialSubject?: string;
  emailContent?: string;
  onSend: (to: string, subject: string, body: string) => Promise<void>;
  onCancel: () => void;
  sending: boolean;
}

function ComposeForm({ initialTo = '', initialSubject = '', emailContent = '', onSend, onCancel, sending }: ComposeFormProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) return;
    await onSend(to.trim(), subject.trim(), body);
  };

  const handleAiGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    setBody('AI is writing...');
    try {
      const emailContext = `To: ${to}\nSubject: ${subject}\n\n${emailContent ? `Original email:\n---\n${emailContent.substring(0, 2000)}\n---` : ''}`;
      const provider = localStorage.getItem('nexu:provider') || 'groq';
      let apiKey = '';
      let model = '';
      if (provider === 'groq') {
        apiKey = localStorage.getItem('nexu:groqApiKey') || '';
        model = localStorage.getItem('nexu:groqModel') || 'llama-3.3-70b-versatile';
      } else if (provider === 'gemini') {
        apiKey = localStorage.getItem('nexu:geminiApiKey') || '';
        model = localStorage.getItem('nexu:geminiModel') || 'gemini-2.0-flash';
      } else if (provider === 'openrouter') {
        apiKey = localStorage.getItem('nexu:openRouterApiKey') || '';
        model = localStorage.getItem('nexu:openRouterModel') || 'deepseek/deepseek-chat';
      } else {
        apiKey = localStorage.getItem('nexu:groqApiKey') || '';
        model = localStorage.getItem('nexu:groqModel') || 'llama-3.3-70b-versatile';
      }

      if (!apiKey) {
        setGenError('No API key found. Set one in Settings.');
        return;
      }

      const res = await fetch('http://localhost:3001/api/gmail/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailContent: emailContext, provider, apiKey, model }),
      });
      const data = await res.json();
      const result = data.result;

      if (typeof result === 'object' && result?.error) {
        setGenError(result.error);
      } else if (typeof result === 'string') {
        setBody(result);
        setTimeout(() => {
          bodyRef.current?.focus();
        }, 100);
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }, [to, subject, emailContent]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-nexu-surface rounded-xl border border-nexu-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-nexu-border">
          <h3 className="text-sm font-semibold text-nexu-text">New Message</h3>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-nexu-text-dim hover:text-nexu-text hover:bg-nexu-border transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-nexu-text-dim mb-1.5">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              required
              className="w-full px-3 py-2 rounded-lg bg-nexu-surface-2 border border-nexu-border text-sm text-nexu-text placeholder:text-nexu-text-muted focus:outline-none focus:ring-2 focus:ring-nexu-primary/50 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-nexu-text-dim mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full px-3 py-2 rounded-lg bg-nexu-surface-2 border border-nexu-border text-sm text-nexu-text placeholder:text-nexu-text-muted focus:outline-none focus:ring-2 focus:ring-nexu-primary/50 transition-shadow"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-nexu-text-dim">Message</label>
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-nexu-primary-hover hover:bg-nexu-primary-dim transition-colors cursor-pointer disabled:opacity-50"
                title="Generate reply with AI"
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generating ? 'Generating...' : 'AI Reply'}
              </button>
            </div>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={8}
              className="w-full px-3 py-2 rounded-lg bg-nexu-surface-2 border border-nexu-border text-sm text-nexu-text placeholder:text-nexu-text-muted focus:outline-none focus:ring-2 focus:ring-nexu-primary/50 transition-shadow resize-none"
            />
            {genError && (
              <p className="mt-1 text-xs text-nexu-accent-red">{genError}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-nexu-text-dim hover:text-nexu-text bg-nexu-surface-2 hover:bg-nexu-border border border-nexu-border transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !to.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-nexu-primary hover:bg-nexu-primary-hover disabled:bg-nexu-border disabled:text-nexu-text-muted text-white text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Search Bar ─────────────────────────────────────────────────────────────

interface SearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  searching: boolean;
  hasQuery: boolean;
}

function SearchBar({ onSearch, onClear, searching, hasQuery }: SearchBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };

  const handleClear = () => {
    setValue('');
    onClear();
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="px-4 py-2 border-b border-nexu-border">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexu-text-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search emails..."
          className="w-full pl-9 pr-16 py-2 rounded-lg bg-nexu-surface-2 border border-nexu-border text-sm text-nexu-text placeholder:text-nexu-text-muted focus:outline-none focus:ring-2 focus:ring-nexu-primary/50 transition-shadow"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {hasQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded text-nexu-text-muted hover:text-nexu-text hover:bg-nexu-border transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
          <button
            type="submit"
            disabled={searching || !value.trim()}
            className="px-2 py-0.5 rounded-md bg-nexu-primary hover:bg-nexu-primary-hover disabled:bg-nexu-border disabled:text-nexu-text-muted text-white text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {searching ? <Loader2 size={12} className="animate-spin" /> : 'Go'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Main Gmail Component ───────────────────────────────────────────────────

export default function Gmail() {
  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState<{ email: string; totalMessages: number; totalThreads: number } | null>(null);
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composePrefill, setComposePrefill] = useState<{ to: string; subject: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── Search state ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // ─── Pagination state ───────────────────────────────────────────────────
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  interface InboxResponse {
    emails: EmailSummary[];
    nextPageToken: string | null;
  }

  // ─── Data fetching ──────────────────────────────────────────────────────

  const fetchInbox = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    setSearchQuery(null);
    setNextPageToken(null);
    try {
      const data = await apiFetch<InboxResponse | { error: string }>('/api/gmail/inbox?max=30');
      if (data && typeof data === 'object' && 'emails' in data) {
        setEmails(data.emails);
        setNextPageToken(data.nextPageToken);
      } else if (data && typeof data === 'object' && 'error' in data) {
        setError(data.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch inbox');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<InboxResponse | { error: string }>(
        `/api/gmail/inbox?max=30&pageToken=${encodeURIComponent(nextPageToken)}`
      );
      if (data && typeof data === 'object' && 'emails' in data) {
        setEmails(prev => [...prev, ...data.emails]);
        setNextPageToken(data.nextPageToken);
      } else if (data && typeof data === 'object' && 'error' in data) {
        setError(data.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [nextPageToken, loadingMore]);

  const handleSearch = useCallback(async (query: string) => {
    setSearching(true);
    setError(null);
    setSearchQuery(query);
    setSelectedEmail(null);
    try {
      const data = await apiFetch<EmailSummary[] | { error: string }>('/api/gmail/search-json', {
        query,
        maxResults: 20,
      });
      if (Array.isArray(data)) {
        setEmails(data);
      } else if (data && typeof data === 'object' && 'error' in data) {
        setError(data.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
      setLoading(false);
    }
  }, []);

  const handleClearSearch = useCallback(async () => {
    setLoading(true);
    await fetchInbox(false);
  }, [fetchInbox]);

  const checkConnection = useCallback(async () => {
    try {
      const status = await apiFetch<string>('/api/gmail/status');
      const isConnected = status.includes('✅') || status.includes('Connected');
      setConnected(isConnected);
      if (isConnected) {
        const prof = await apiFetch<{ email: string; totalMessages: number; totalThreads: number }>('/api/gmail/profile');
        setProfile(prof);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  // Initial load: check connection, then fetch inbox once
  useEffect(() => {
    checkConnection().then(() => {
      // Only fetch inbox on initial mount, not on re-renders
      fetchInbox(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll connection status every 10s (only when not connected)
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, [connected, checkConnection]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (searchQuery) {
      await handleSearch(searchQuery);
    } else {
      await fetchInbox(false);
    }
    setRefreshing(false);
  }, [fetchInbox, handleSearch, searchQuery]);

  const handleSelectEmail = useCallback(async (id: string) => {
    setLoadingEmail(true);
    setError(null);
    try {
      const data = await apiFetch<EmailDetail | { error: string }>('/api/gmail/email-detail', { id });
      if (data && typeof data === 'object' && 'error' in data) {
        setError(data.error);
        setSelectedEmail(null);
      } else {
        setSelectedEmail(data as EmailDetail);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load email');
      setSelectedEmail(null);
    } finally {
      setLoadingEmail(false);
    }
  }, []);

  const handleSend = useCallback(async (to: string, subject: string, body: string) => {
    setSending(true);
    setError(null);
    try {
      await apiFetch<string>('/api/gmail/send', { to, subject, body });
      setSendSuccess(`✅ Email sent to ${to}`);
      setShowCompose(false);
      setComposePrefill(null);
      setTimeout(() => { fetchInbox(false); setSendSuccess(null); }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }, [fetchInbox]);

  const handleReply = useCallback(() => {
    if (!selectedEmail) return;
    const replySubject = selectedEmail.subject.startsWith('Re:')
      ? selectedEmail.subject
      : `Re: ${selectedEmail.subject}`;
    setComposePrefill({
      to: extractEmailAddress(selectedEmail.from),
      subject: replySubject,
    });
    setShowCompose(true);
  }, [selectedEmail]);

  const handleNewEmail = useCallback(() => {
    setComposePrefill(null);
    setShowCompose(true);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedEmail(null);
  }, []);

  // ─── Not connected state ────────────────────────────────────────────────

  if (!connected && loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-nexu-text-dim">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Checking Gmail connection...</span>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-nexu-primary-dim flex items-center justify-center mx-auto mb-5">
            <Mail size={32} className="text-nexu-primary-hover" />
          </div>
          <h2 className="text-lg font-semibold text-nexu-text mb-2">Not connected to Gmail</h2>
          <p className="text-sm text-nexu-text-dim mb-6 leading-relaxed">
            Connect your Gmail account in the Connections page to see your inbox here.
          </p>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'connections' })); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nexu-primary hover:bg-nexu-primary-hover text-white text-sm font-medium transition-colors no-underline"
          >
            <ExternalLink size={14} />
            Go to Connections
          </a>
        </div>
      </div>
    );
  }

  // ─── Main split view ──────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-nexu-border bg-nexu-surface/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-nexu-primary-hover" />
            <h1 className="text-sm font-semibold text-nexu-text">Gmail</h1>
          </div>
          {profile && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-nexu-accent-green/10 border border-nexu-accent-green/20 text-nexu-accent-green text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-nexu-accent-green animate-pulse" />
              {profile.email}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sendSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-nexu-accent-green px-2 py-1 rounded-lg bg-nexu-accent-green/10">
              <CheckCircle size={12} />
              {sendSuccess}
            </span>
          )}
          <button
            onClick={handleNewEmail}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexu-primary hover:bg-nexu-primary-hover text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Send size={12} />
            Compose
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-nexu-text-dim hover:text-nexu-text hover:bg-nexu-border transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Email list (left panel) */}
        <div className={`${selectedEmail ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r border-nexu-border bg-nexu-surface/30 shrink-0`}>
          {/* Search bar */}
          <SearchBar onSearch={handleSearch} onClear={handleClearSearch} searching={searching} hasQuery={!!searchQuery} />

          {/* List header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-nexu-border">
            {searchQuery ? (
              <>
                <Search size={14} className="text-nexu-primary-hover" />
                <span className="text-xs font-medium text-nexu-text-dim uppercase tracking-wider">
                  Search: "{searchQuery}" {emails.length > 0 && `(${emails.length})`}
                </span>
              </>
            ) : (
              <>
                <Inbox size={14} className="text-nexu-primary-hover" />
                <span className="text-xs font-medium text-nexu-text-dim uppercase tracking-wider">
                  Inbox {emails.length > 0 && `(${emails.length})`}
                </span>
              </>
            )}
          </div>

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            {loading || (searching) ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} className="animate-spin text-nexu-text-dim" />
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Inbox size={32} className="text-nexu-text-muted mb-3" />
                <p className="text-sm text-nexu-text-dim">
                  {searchQuery ? `No emails found matching "${searchQuery}"` : 'Inbox is empty'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-nexu-border">
                {emails.map((email) => {
                  const senderName = extractEmailName(email.from);
                  const avatarColor = getAvatarColor(senderName);
                  const initials = getInitials(senderName);
                  return (
                  <button
                    key={email.id}
                    onClick={() => handleSelectEmail(email.id)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-nexu-surface-2 transition-colors cursor-pointer group ${
                      selectedEmail?.id === email.id ? 'bg-nexu-primary-dim' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar circle */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-sm truncate ${selectedEmail?.id === email.id ? 'font-semibold text-nexu-text' : 'font-medium text-nexu-text'}`}>
                            {senderName}
                          </span>
                          <span className="text-[11px] text-nexu-text-muted whitespace-nowrap shrink-0 pt-0.5">
                            {formatDate(email.date)}
                          </span>
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${
                          selectedEmail?.id === email.id ? 'text-nexu-text' : 'text-nexu-text-dim'
                        }`}>
                          {email.subject}
                        </p>
                        <p className="text-xs text-nexu-text-muted truncate leading-relaxed mt-0.5">
                          {email.snippet}
                        </p>
                      </div>
                    </div>
                  </button>
                  );
                })}
                {/* Load more button */}
                {!searchQuery && nextPageToken && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-nexu-primary-hover hover:bg-nexu-surface-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Mail size={14} />
                    )}
                    {loadingMore ? 'Loading...' : `Load more (${profile?.totalMessages ? Math.min(profile.totalMessages - emails.length, 30) : 30}+ more)`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Email detail (right panel) */}
        <div className={`${selectedEmail ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-nexu-surface`}>
          {loadingEmail ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-nexu-text-dim" />
            </div>
          ) : selectedEmail ? (
            <>
              {/* Mobile back button */}
              <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-nexu-border">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-nexu-text-dim hover:text-nexu-text transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
              </div>

              {/* Email header */}
              <div className="px-5 py-4 border-b border-nexu-border">
                <h2 className="text-base font-semibold text-nexu-text mb-3 leading-snug">
                  {selectedEmail.subject}
                </h2>
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold text-white"
                    style={{ backgroundColor: getAvatarColor(extractEmailName(selectedEmail.from)) }}
                  >
                    {getInitials(extractEmailName(selectedEmail.from))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-nexu-text">
                      {extractEmailName(selectedEmail.from)}
                    </p>
                    <p className="text-xs text-nexu-text-muted mt-0.5">
                      {selectedEmail.from}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1.5 text-xs text-nexu-text-muted">
                        <Calendar size={11} />
                        {selectedEmail.date}
                      </span>
                      {selectedEmail.to && (
                        <>
                          <span className="text-nexu-border">to</span>
                          <span className="text-xs text-nexu-text-muted truncate">
                            {selectedEmail.to}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Email body - render HTML if available, fall back to plain text */}
              <div className="flex-1 px-5 py-4 overflow-hidden">
                {selectedEmail.htmlBody ? (
                  <iframe
                    srcDoc={selectedEmail.htmlBody}
                    className="w-full h-full border-0 rounded-lg"
                    title="Email content"
                    sandbox="allow-popups"
                    style={{
                      background: 'transparent',
                      colorScheme: 'normal',
                    }}
                  />
                ) : (
                  <div className="h-full overflow-y-auto text-sm text-nexu-text leading-relaxed whitespace-pre-wrap font-sans">
                    {selectedEmail.body}
                  </div>
                )}
              </div>

              {/* Email actions */}
              <div className="flex items-center gap-2 px-5 py-3 border-t border-nexu-border bg-nexu-surface/50">
                <button
                  onClick={handleReply}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-nexu-primary hover:bg-nexu-primary-hover text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  <Reply size={13} />
                  Reply
                </button>
                <button
                  onClick={handleNewEmail}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-nexu-surface-2 hover:bg-nexu-border border border-nexu-border text-nexu-text-dim hover:text-nexu-text text-xs font-medium transition-colors cursor-pointer"
                >
                  <Send size={13} />
                  New
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-8">
                <div className="w-12 h-12 rounded-xl bg-nexu-primary-dim flex items-center justify-center mx-auto mb-4">
                  <Mail size={24} className="text-nexu-primary-hover" />
                </div>
                <p className="text-sm text-nexu-text-dim">
                  Select an email to read it
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-6 right-6 max-w-sm bg-nexu-accent-red/10 border border-nexu-accent-red/30 rounded-xl p-4 shadow-xl z-50">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-nexu-accent-red shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-nexu-accent-red mb-0.5">Error</p>
              <p className="text-xs text-nexu-text-dim">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-0.5 rounded text-nexu-text-muted hover:text-nexu-text transition-colors cursor-pointer shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Compose modal */}
      {showCompose && (
        <ComposeForm
          initialTo={composePrefill?.to || ''}
          initialSubject={composePrefill?.subject || ''}
          emailContent={selectedEmail?.body || ''}
          onSend={handleSend}
          onCancel={() => { setShowCompose(false); setComposePrefill(null); }}
          sending={sending}
        />
      )}
    </div>
  );
}
