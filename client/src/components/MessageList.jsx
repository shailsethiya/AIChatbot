import { useEffect, useRef } from 'react';
import Markdown from './Markdown.jsx';
import ToolTrace from './ToolTrace.jsx';

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}

export default function MessageList({ messages, streaming }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  if (!messages.length && !streaming) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="text-2xl font-semibold mb-2">How can I help today?</div>
          <div className="text-sm">Ask a question, request code, brainstorm ideas…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} toolSteps={m.toolSteps} />
        ))}
        {streaming && (
          <MessageBubble
            role="assistant"
            content={streaming.content || ''}
            toolSteps={streaming.toolSteps}
            trailing={!streaming.content ? <TypingDots /> : null}
          />
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function MessageBubble({ role, content, toolSteps, trailing }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[85%] rounded-2xl px-4 py-2 bg-indigo-600 text-white shadow'
            : 'max-w-[95%] rounded-2xl px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm'
        }
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{content}</div>
        ) : (
          <>
            <ToolTrace steps={toolSteps} />
            <Markdown>{content}</Markdown>
            {trailing}
          </>
        )}
      </div>
    </div>
  );
}
