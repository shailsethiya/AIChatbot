import { useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Sidebar({ chats, refresh, onNew }) {
  const { id: activeId } = useParams();
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const startRename = (chat) => {
    setEditingId(chat._id);
    setEditValue(chat.title);
  };

  const commitRename = async (id) => {
    const title = editValue.trim();
    setEditingId(null);
    if (!title) return;
    try {
      await api.renameChat(id, title);
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this chat?')) return;
    try {
      await api.deleteChat(id);
      if (id === activeId) nav('/');
      refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <aside className="w-72 shrink-0 h-full flex flex-col bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium"
        >
          + New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {chats.length === 0 && (
          <div className="text-xs text-slate-500 px-2 py-4 text-center">No chats yet</div>
        )}
        {chats.map((c) => (
          <div
            key={c._id}
            className={`group rounded-lg text-sm ${
              activeId === c._id
                ? 'bg-white dark:bg-slate-800 shadow-sm'
                : 'hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            {editingId === c._id ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitRename(c._id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(c._id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="w-full bg-transparent px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <div className="flex items-center">
                <NavLink
                  to={`/c/${c._id}`}
                  className="flex-1 truncate px-3 py-2"
                  title={c.title}
                >
                  {c.title}
                </NavLink>
                <div className="opacity-0 group-hover:opacity-100 flex pr-2 gap-1">
                  <button
                    onClick={() => startRename(c)}
                    className="text-xs px-1 py-0.5 hover:text-indigo-500"
                    title="Rename"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => remove(c._id)}
                    className="text-xs px-1 py-0.5 hover:text-red-500"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="truncate">
            <div className="font-medium">{user?.name}</div>
            <div className="text-slate-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={toggle}
            className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
        <button
          onClick={logout}
          className="w-full px-3 py-1.5 rounded-lg text-sm border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
