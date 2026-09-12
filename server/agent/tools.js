// Tools exposed to the LLM. Each tool has:
//   spec:    the JSON schema sent to the model (OpenAI "tools" format)
//   handler: async (args, ctx) => any JSON-serialisable result
// ctx = { userId } so tools can act on behalf of the caller.
const Chat = require('../models/Chat');

function safeEvalMath(expression) {
  if (typeof expression !== 'string') throw new Error('expression must be a string');
  if (!/^[\d+\-*/().\s]+$/.test(expression)) {
    throw new Error('only digits, whitespace, and + - * / ( ) . are allowed');
  }
  if (expression.length > 200) throw new Error('expression too long');
  // eslint-disable-next-line no-new-func
  const value = Function(`"use strict"; return (${expression});`)();
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('expression did not evaluate to a finite number');
  }
  return value;
}

const tools = {
  get_current_time: {
    spec: {
      type: 'function',
      function: {
        name: 'get_current_time',
        description: 'Return the current server time in ISO 8601 format.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    },
    handler: async () => ({ now: new Date().toISOString() }),
  },

  calculator: {
    spec: {
      type: 'function',
      function: {
        name: 'calculator',
        description:
          'Evaluate a basic arithmetic expression. Supports + - * / and parentheses. Example: "12 * (3 + 4)".',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Arithmetic expression, e.g. "2 + 2" or "(10/4)*3".',
            },
          },
          required: ['expression'],
          additionalProperties: false,
        },
      },
    },
    handler: async ({ expression }) => ({ result: safeEvalMath(expression) }),
  },

  list_my_chats: {
    spec: {
      type: 'function',
      function: {
        name: 'list_my_chats',
        description: 'List the current user\u2019s most recent chat titles.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
          },
          additionalProperties: false,
        },
      },
    },
    handler: async ({ limit = 5 }, { userId }) => {
      const rows = await Chat.find({ user: userId })
        .select('title updatedAt')
        .sort({ updatedAt: -1 })
        .limit(Math.min(limit, 20));
      return {
        chats: rows.map((r) => ({ title: r.title, updatedAt: r.updatedAt })),
      };
    },
  },
};

function toolSpecs() {
  return Object.values(tools).map((t) => t.spec);
}

async function runTool(name, args, ctx) {
  const t = tools[name];
  if (!t) return { error: `Unknown tool: ${name}` };
  try {
    return await t.handler(args || {}, ctx);
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { toolSpecs, runTool };
