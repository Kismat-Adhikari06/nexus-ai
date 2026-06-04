import { useState, useEffect } from 'react';
import { Brain, Bookmark, Trash2, Search, Check, X, Edit2, AlertCircle, Plus } from 'lucide-react';
import type { Fact } from '../services/memory';
import { getAllFacts, deleteFact, getPendingFacts, approveFact, rejectFact, updateFact, saveFact, clearAllFacts, clearAllHistory } from '../services/memory';

const CATEGORY_COLORS: Record<string, string> = {
  identity: 'bg-nexu-accent-blue/10 text-nexu-accent-blue',
  preferences: 'bg-nexu-accent-green/10 text-nexu-accent-green',
  relationships: 'bg-nexu-accent-yellow/10 text-nexu-accent-yellow',
  important_dates: 'bg-nexu-accent-red/10 text-nexu-accent-red',
  other: 'bg-nexu-surface-2 text-nexu-text-dim',
};

const CATEGORY_LABELS: Record<string, string> = {
  identity: 'Identity',
  preferences: 'Preferences',
  relationships: 'Relationships',
  important_dates: 'Dates',
  other: 'Other',
};

function FactCard({ factKey, fact, onDelete, onRefresh }: { factKey: string; fact: Fact; onDelete: (k: string) => void; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(fact.value);

  const handleSave = async () => {
    if (editValue.trim() && editValue !== fact.value) {
      await updateFact(factKey, { value: editValue.trim() });
      onRefresh();
    }
    setEditing(false);
  };

  const confidenceColor = fact.confidence >= 90 ? 'bg-nexu-accent-green' :
    fact.confidence >= 75 ? 'bg-nexu-accent-blue' :
    fact.confidence >= 50 ? 'bg-nexu-accent-yellow' :
    'bg-nexu-accent-red';

  return (
    <div className="flex items-start justify-between p-3 rounded-lg bg-nexu-surface-2 border border-nexu-border group hover:border-nexu-primary/30 transition-colors">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-nexu-primary-hover uppercase tracking-wider">
            {factKey}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[fact.category] || CATEGORY_COLORS.other}`}>
            {CATEGORY_LABELS[fact.category] || fact.category}
          </span>
          <span className="text-[10px] text-nexu-text-muted">
            {fact.source.replace('_', ' ')}
          </span>
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 bg-nexu-bg border border-nexu-border rounded px-2 py-1 text-sm text-nexu-text outline-none focus:border-nexu-primary/50"
              autoFocus
            />
            <button onClick={handleSave} className="p-1 rounded text-nexu-accent-green hover:bg-nexu-accent-green/10 cursor-pointer">
              <Check size={14} />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 rounded text-nexu-text-muted hover:text-nexu-text cursor-pointer">
              <X size={14} />
            </button>
          </div>
        ) : (
          <p className="text-sm text-nexu-text truncate">{fact.value}</p>
        )}

        <div className="flex items-center gap-3 text-[10px] text-nexu-text-muted">
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 rounded-full bg-nexu-bg overflow-hidden">
              <div className={`h-full rounded-full ${confidenceColor}`} style={{ width: `${fact.confidence}%` }} />
            </div>
            <span>{fact.confidence}%</span>
          </div>
          <span>{new Date(fact.timestamp).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all ml-2">
        <button
          onClick={() => { setEditValue(fact.value); setEditing(true); }}
          className="p-1.5 rounded-lg text-nexu-text-muted hover:text-nexu-accent-blue hover:bg-nexu-accent-blue/10 cursor-pointer"
          title="Edit"
        >
          <Edit2 size={13} />
        </button>
        <button
          onClick={() => onDelete(factKey)}
          className="p-1.5 rounded-lg text-nexu-text-muted hover:text-nexu-accent-red hover:bg-nexu-accent-red/10 cursor-pointer"
          title="Forget this fact"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function MemoryView() {
  const [facts, setFacts] = useState<Record<string, Fact>>({});
  const [pending, setPending] = useState<[string, Fact][]>([]);
  const [activeTab, setActiveTab] = useState<'facts' | 'pending'>('facts');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<Fact['category']>('other');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const refresh = async () => {
    setFacts(await getAllFacts());
    setPending(await getPendingFacts());
  };

  useEffect(() => { refresh(); }, []);

  const handleDelete = async (key: string) => {
    await deleteFact(key);
    refresh();
  };

  const handleDeleteAll = async () => {
    await clearAllFacts();
    await clearAllHistory();
    try { localStorage.removeItem('nexu:conversations'); } catch { /* ignore */ }
    setShowDeleteConfirm(false);
    refresh();
  };

  const handleApprove = async (key: string) => {
    await approveFact(key);
    refresh();
  };

  const handleReject = async (key: string) => {
    await rejectFact(key);
    refresh();
  };

  const handleAddFact = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    await saveFact(newKey.trim(), newValue.trim(), { category: newCategory, confidence: 100, source: 'direct_statement' });
    setNewKey('');
    setNewValue('');
    setNewCategory('other');
    setShowAddForm(false);
    refresh();
  };

  const filteredFacts = Object.entries(facts)
    .filter(([, f]) => f.status === 'saved')
    .filter(([k, v]) =>
      k.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.value.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const filteredPending = pending.filter(([k, v]) =>
    k.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        {/* Add Fact Form */}
        {showAddForm && (
          <div className="p-4 rounded-lg bg-nexu-surface-2 border border-nexu-border space-y-3">
            <p className="text-sm font-medium text-nexu-text">Add a Fact</p>
            <input
              type="text"
              placeholder="Key (e.g. favorite_color)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full bg-nexu-bg border border-nexu-border rounded-lg px-3 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
            />
            <input
              type="text"
              placeholder="Value (e.g. blue)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full bg-nexu-bg border border-nexu-border rounded-lg px-3 py-2 text-sm text-nexu-text placeholder-nexu-text-muted outline-none focus:border-nexu-primary/50 transition-colors"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as Fact['category'])}
              className="w-full bg-nexu-bg border border-nexu-border rounded-lg px-3 py-2 text-sm text-nexu-text outline-none focus:border-nexu-primary/50 transition-colors"
            >
              <option value="identity">Identity</option>
              <option value="preferences">Preferences</option>
              <option value="relationships">Relationships</option>
              <option value="important_dates">Important Dates</option>
              <option value="other">Other</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAddForm(false); setNewKey(''); setNewValue(''); }}
                className="px-3 py-1.5 rounded-lg text-sm text-nexu-text-dim hover:text-nexu-text bg-nexu-bg border border-nexu-border cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFact}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-nexu-primary hover:bg-nexu-primary-hover cursor-pointer transition-colors"
              >
                Save Fact
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-nexu-surface-2 p-1">
            <button
              onClick={() => setActiveTab('facts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'facts'
                  ? 'bg-nexu-primary-dim text-nexu-primary-hover'
                  : 'text-nexu-text-dim hover:text-nexu-text'
              }`}
            >
              <Bookmark size={16} />
              Facts ({Object.values(facts).filter(f => f.status === 'saved').length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-nexu-primary-dim text-nexu-primary-hover'
                  : 'text-nexu-text-dim hover:text-nexu-text'
              } ${pending.length > 0 ? 'relative' : ''}`}
            >
              <AlertCircle size={16} />
              Pending
              {pending.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-nexu-accent-yellow text-[9px] font-bold text-black flex items-center justify-center">
                  {pending.length}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer border ${
              showAddForm
                ? 'bg-nexu-primary-dim border-nexu-primary/30 text-nexu-primary-hover'
                : 'bg-nexu-surface-2 border-nexu-border text-nexu-text-dim hover:text-nexu-text hover:border-nexu-border/50'
            }`}
          >
            <Plus size={16} />
            Add
          </button>
          {Object.values(facts).filter(f => f.status === 'saved').length > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer border bg-nexu-surface-2 border-nexu-border text-nexu-text-dim hover:text-nexu-accent-red hover:border-nexu-accent-red/30"
            >
              <Trash2 size={14} />
              Delete All
            </button>
          )}
        </div>

        {/* Delete All Confirmation */}
        {showDeleteConfirm && (
          <div className="p-4 rounded-lg border border-nexu-accent-red/30 bg-nexu-accent-red/5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-nexu-accent-red" />
              <p className="text-sm font-medium text-nexu-text">Delete all saved facts?</p>
            </div>
            <p className="text-xs text-nexu-text-dim">This cannot be undone. All facts, history, and conversations will be permanently removed.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-nexu-text-dim hover:text-nexu-text bg-nexu-bg border border-nexu-border cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-nexu-accent-red hover:bg-nexu-accent-red/80 cursor-pointer transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        )}

        {/* Facts Tab */}
        {activeTab === 'facts' && (
          <div className="space-y-2">
            {filteredFacts.length === 0 ? (
              <div className="text-center py-12">
                <Brain size={48} className="mx-auto text-nexu-text-muted mb-4" />
                <h3 className="text-lg font-medium text-nexu-text mb-1">No facts saved yet</h3>
                <p className="text-sm text-nexu-text-dim">
                  Tell Nexu things like "My name is Kishan" and they'll appear here.
                </p>
              </div>
            ) : (
              filteredFacts.map(([key, fact]) => (
                <FactCard key={key} factKey={key} fact={fact} onDelete={handleDelete} onRefresh={refresh} />
              ))
            )}
          </div>
        )}

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-2">
            {filteredPending.length === 0 ? (
              <div className="text-center py-12">
                <Check size={48} className="mx-auto text-nexu-text-muted mb-4" />
                <h3 className="text-lg font-medium text-nexu-text mb-1">No pending facts</h3>
                <p className="text-sm text-nexu-text-dim">
                  Low-confidence facts that need your approval will appear here.
                </p>
              </div>
            ) : (
              filteredPending.map(([key, fact]) => (
                <div key={key} className="p-3 rounded-lg bg-nexu-surface-2 border border-nexu-accent-yellow/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-nexu-primary-hover uppercase tracking-wider">{key}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[fact.category] || CATEGORY_COLORS.other}`}>
                          {CATEGORY_LABELS[fact.category] || fact.category}
                        </span>
                        <span className="text-[10px] text-nexu-text-muted">{fact.source.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm text-nexu-text">{fact.value}</p>
                      <div className="flex items-center gap-3 text-[10px] text-nexu-text-muted">
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-1.5 rounded-full bg-nexu-bg overflow-hidden">
                            <div className="h-full rounded-full bg-nexu-accent-yellow" style={{ width: `${fact.confidence}%` }} />
                          </div>
                          <span>{fact.confidence}% confidence</span>
                        </div>
                        <span>{new Date(fact.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleApprove(key)}
                        className="p-1.5 rounded-lg text-nexu-accent-green hover:bg-nexu-accent-green/10 cursor-pointer"
                        title="Approve"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => handleReject(key)}
                        className="p-1.5 rounded-lg text-nexu-accent-red hover:bg-nexu-accent-red/10 cursor-pointer"
                        title="Reject"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
