import { useState, useEffect } from 'react';
import { Brain, Bookmark, Trash2, Search, Clock, MessageSquare } from 'lucide-react';
import { getAllFacts, deleteFact, getRecentHistory } from '../services/memory';

export default function MemoryView() {
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<{ role: string; content: string; timestamp: string }[]>([]);
  const [activeTab, setActiveTab] = useState<'facts' | 'history'>('facts');
  const [searchTerm, setSearchTerm] = useState('');

  const refresh = () => {
    setFacts(getAllFacts());
    setHistory(getRecentHistory(50));
  };

  useEffect(() => { refresh(); }, []);

  const handleDelete = (key: string) => {
    deleteFact(key);
    refresh();
  };

  const filteredFacts = Object.entries(facts).filter(([k, v]) =>
    k.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHistory = history.filter(h =>
    h.content.toLowerCase().includes(searchTerm.toLowerCase())
  ).reverse();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-nexu-text mb-1">Memory</h2>
          <p className="text-sm text-nexu-text-dim">
            Everything Nexu remembers about you and your conversations
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexu-text-muted" />
          <input
            type="text"
            placeholder="Search memory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-nexu-bg border border-nexu-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-nexu-surface-2 p-1 w-fit">
          <button
            onClick={() => setActiveTab('facts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'facts'
                ? 'bg-nexu-primary-dim text-nexu-primary-hover'
                : 'text-nexu-text-dim hover:text-nexu-text'
            }`}
          >
            <Bookmark size={16} />
            Facts ({Object.keys(facts).length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-nexu-primary-dim text-nexu-primary-hover'
                : 'text-nexu-text-dim hover:text-nexu-text'
            }`}
          >
            <MessageSquare size={16} />
            History ({history.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'facts' ? (
          <div className="space-y-2">
            {filteredFacts.length === 0 ? (
              <div className="text-center py-12">
                <Brain size={48} className="mx-auto text-nexu-text-muted mb-4" />
                <h3 className="text-lg font-medium text-nexu-text mb-1">No facts saved yet</h3>
                <p className="text-sm text-nexu-text-dim">
                  Tell Nexu things like "Remember my name is Kishan" and they'll appear here.
                </p>
              </div>
            ) : (
              filteredFacts.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-nexu-surface-2 border border-nexu-border group hover:border-nexu-primary/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-nexu-primary-hover uppercase tracking-wider mb-0.5">{key}</p>
                    <p className="text-sm text-nexu-text truncate">{value}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(key)}
                    className="p-2 rounded-lg text-nexu-text-muted hover:text-nexu-accent-red hover:bg-nexu-accent-red/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Forget this fact"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12">
                <Clock size={48} className="mx-auto text-nexu-text-muted mb-4" />
                <h3 className="text-lg font-medium text-nexu-text mb-1">No conversation history yet</h3>
                <p className="text-sm text-nexu-text-dim">
                  Start chatting with Nexu and your conversation history will show here.
                </p>
              </div>
            ) : (
              filteredHistory.map((entry, i) => (
                <div key={i} className={`p-3 rounded-lg border transition-colors ${
                  entry.role === 'user'
                    ? 'bg-nexu-surface-2 border-nexu-border'
                    : 'bg-nexu-surface-2/50 border-nexu-border/50'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      entry.role === 'user'
                        ? 'bg-nexu-primary-dim text-nexu-primary-hover'
                        : 'bg-nexu-accent-green/10 text-nexu-accent-green'
                    }`}>
                      {entry.role === 'user' ? 'You' : 'Nexu'}
                    </span>
                    <span className="text-[10px] text-nexu-text-muted">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-nexu-text-dim">{entry.content.substring(0, 300)}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
