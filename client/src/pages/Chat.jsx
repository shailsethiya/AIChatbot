import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar.jsx';
import MessageList from '../components/MessageList.jsx';
import MessageInput from '../components/MessageInput.jsx';
import { api, streamMessage, streamAgent } from '../api/client.js';

export default function Chat() {
  const { id } = useParams();
  const nav = useNavigate();

  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(null);
  const [agentMode, setAgentMode] = useState(false);
  const abortRef = useRef(null);

  const refreshChats = useCallback(async () => {
    try {
      const d = await api.listChats();
      setChats(d.chats);
    } catch (e) {
      toast.error(e.message);
    }
  }, []);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  useEffect(() => {
    let cancelled = false;
    setStreaming(null);
    if (!id) {
      setMessages([]);
      return;
    }
    api
      .getChat(id)
      .then((d) => {
        if (!cancelled) setMessages(d.chat.messages || []);
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e.message);
          nav('/');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, nav]);

  const onNew = () => {
    setMessages([]);
    setStreaming(null);
    nav('/');
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleSendChat = async (text) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setStreaming({ content: '' });

    const controller = new AbortController();
    abortRef.current = controller;

    let createdChatId = id || null;

    await streamMessage({
      chatId: id,
      message: text,
      signal: controller.signal,
      onMeta: ({ chatId }) => {
        if (!id && chatId) createdChatId = chatId;
      },
      onDelta: ({ content }) => {
        setStreaming((s) => ({ content: (s?.content || '') + content }));
      },
      onDone: ({ reply }) => {
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        setStreaming(null);
        refreshChats();
        if (!id && createdChatId) nav(`/c/${createdChatId}`, { replace: true });
      },
      onError: (err) => {
        setStreaming(null);
        if (err.name !== 'AbortError') toast.error(err.message);
      },
    }).catch((err) => {
      setStreaming(null);
      if (err.name !== 'AbortError') toast.error(err.message);
    });

    abortRef.current = null;
  };

  const handleSendAgent = async (text) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setStreaming({ content: '', toolSteps: [] });

    const controller = new AbortController();
    abortRef.current = controller;

    const pending = new Map();

    await streamAgent({
      message: text,
      signal: controller.signal,
      onToolCalls: ({ calls }) => {
        setStreaming((s) => {
          const steps = [...(s?.toolSteps || [])];
          for (const c of calls) {
            const step = { id: c.id, name: c.name, args: c.arguments };
            steps.push(step);
            pending.set(c.id, steps.length - 1);
          }
          return { ...(s || {}), toolSteps: steps };
        });
      },
      onToolResult: ({ id: cid, result }) => {
        setStreaming((s) => {
          const steps = [...(s?.toolSteps || [])];
          const idx = pending.get(cid);
          if (idx != null && steps[idx]) steps[idx] = { ...steps[idx], result };
          return { ...(s || {}), toolSteps: steps };
        });
      },
      onDone: ({ reply }) => {
        setMessages((prev) => {
          const steps = (streamingRef.current || {}).toolSteps || [];
          return [
            ...prev,
            { role: 'assistant', content: reply, toolSteps: steps },
          ];
        });
        setStreaming(null);
      },
      onError: (err) => {
        setStreaming(null);
        if (err.name !== 'AbortError') toast.error(err.message);
      },
    }).catch((err) => {
      setStreaming(null);
      if (err.name !== 'AbortError') toast.error(err.message);
    });

    abortRef.current = null;
  };

  // Keep a ref of the live streaming state so onDone can read the final tool steps.
  const streamingRef = useRef(streaming);
  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  const handleSend = (text) => (agentMode ? handleSendAgent(text) : handleSendChat(text));

  const activeTitle = useMemo(() => {
    if (!id) return agentMode ? 'Agent (new)' : 'New chat';
    return chats.find((c) => c._id === id)?.title || 'Chat';
  }, [chats, id, agentMode]);

  return (
    <div className="h-full flex">
      <Sidebar chats={chats} refresh={refreshChats} onNew={onNew} />
      <main className="flex-1 h-full flex flex-col">
        <header className="h-12 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur">
          <div className="font-medium truncate">{activeTitle}</div>
          <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
            <span className={agentMode ? 'text-indigo-500 font-medium' : 'text-slate-500'}>
              Agent mode
            </span>
            <input
              type="checkbox"
              className="sr-only peer"
              checked={agentMode}
              onChange={(e) => setAgentMode(e.target.checked)}
            />
            <span className="w-9 h-5 rounded-full bg-slate-300 dark:bg-slate-700 relative transition-colors peer-checked:bg-indigo-600">
              <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
        </header>
        <MessageList messages={messages} streaming={streaming} />
        <MessageInput
          onSend={handleSend}
          disabled={!!streaming}
          onStop={handleStop}
        />
      </main>
    </div>
  );
}
