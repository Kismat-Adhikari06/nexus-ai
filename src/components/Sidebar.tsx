import { MessageSquare, Settings, Database, Plus } from 'lucide-react';
import type { AppView, Conversation } from '../types';

interface SidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
  conversations: Conversation[];
  activeConversation: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
}

const navItems: { view: AppView; label: string; icon: React.ReactNode }[] = [
  { view: 'chat', label: 'Chat', icon: <MessageSquare size={18} /> },
  { view: 'memory', label: 'Memory', icon: <Database size={18} /> },
  { view: 'settings', label: 'Settings', icon: <Settings size={18} /> },
];

export default function Sidebar({ activeView, onViewChange, conversations, activeConversation, onNewChat, onSelectConversation }: SidebarProps) {
  return (
    <aside className="w-64 border-r border-nexu-border bg-nexu-surface flex flex-col h-full">
      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-nexu-primary hover:bg-nexu-primary-hover text-white font-medium text-sm transition-colors cursor-pointer"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Navigation */}
      <nav className="px-3 mb-3">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 cursor-pointer ${
              activeView === item.view
                ? 'bg-nexu-primary-dim text-nexu-primary-hover'
                : 'text-nexu-text-dim hover:bg-nexu-border hover:text-nexu-text'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Divider */}
      <div className="border-t border-nexu-border mx-3" />

      {/* Conversation History */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <p className="text-xs font-medium text-nexu-text-muted uppercase tracking-wider px-2 pb-2">
          Conversations
        </p>
        {conversations.length === 0 ? (
          <p className="text-xs text-nexu-text-muted px-2">No conversations yet</p>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate cursor-pointer ${
                activeConversation === conv.id
                  ? 'bg-nexu-primary-dim text-nexu-primary-hover'
                  : 'text-nexu-text-dim hover:bg-nexu-border hover:text-nexu-text'
              }`}
            >
              {conv.title || 'New conversation'}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
