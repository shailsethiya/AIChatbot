const OpenAI = require('openai');
const { toolSpecs, runTool } = require('../agent/tools');

const SYSTEM_PROMPT =
  'You are an assistant that can call tools when helpful. ' +
  'Prefer tools for anything that requires the current time, arithmetic, or the user\u2019s chat data. ' +
  'When you have enough information, respond directly in markdown.';

const MAX_STEPS = 5;

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === 'sk-your-openai-key') {
    throw new Error('OPENAI_API_KEY is not set (check server/.env)');
  }
  return new OpenAI({
    apiKey: key,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: 60_000,
    maxRetries: 1,
  });
}

function sse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

exports.streamAgent = async (req, res, next) => {
  const { message } = req.body;
  const userId = req.userId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  try {
    const client = getClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ];

    for (let step = 0; step < MAX_STEPS; step++) {
      sse(res, 'step', { step: step + 1 });

      const resp = await client.chat.completions.create({
        model,
        messages,
        tools: toolSpecs(),
        tool_choice: 'auto',
      });

      const choice = resp.choices?.[0];
      const msg = choice?.message;
      if (!msg) throw new Error('No response from model');

      // The assistant's message (possibly containing tool_calls) must be added
      // BEFORE the corresponding tool result messages.
      messages.push(msg);

      const calls = msg.tool_calls || [];
      if (calls.length === 0) {
        sse(res, 'done', { reply: msg.content || '(no response)' });
        return res.end();
      }

      sse(res, 'tool_calls', {
        calls: calls.map((c) => ({
          id: c.id,
          name: c.function?.name,
          arguments: c.function?.arguments,
        })),
      });

      for (const call of calls) {
        let args = {};
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (e) {
          args = {};
        }
        const result = await runTool(call.function?.name, args, { userId });
        sse(res, 'tool_result', {
          id: call.id,
          name: call.function?.name,
          result,
        });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    sse(res, 'done', {
      reply: '(agent stopped: exceeded maximum tool-calling steps)',
    });
    res.end();
  } catch (err) {
    console.error('[agent] error:', err);
    if (!res.headersSent) return next(err);
    sse(res, 'error', { message: err.message || 'Agent error' });
    res.end();
  }
};
