export default function ToolTrace({ steps }) {
  if (!steps?.length) return null;
  return (
    <div className="mb-2 space-y-1">
      {steps.map((s, i) => (
        <div
          key={i}
          className="text-xs rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/40 px-3 py-2"
        >
          <div className="font-mono text-indigo-700 dark:text-indigo-300">
            <span className="opacity-70">tool</span> {s.name}
            {s.args ? <span className="opacity-70">({s.args})</span> : null}
          </div>
          {s.result !== undefined && (
            <div className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] text-slate-700 dark:text-slate-300">
              → {typeof s.result === 'string' ? s.result : JSON.stringify(s.result)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
