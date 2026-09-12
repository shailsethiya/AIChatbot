const OpenAI = require('openai');
const { fetch: undiciFetch } = require('undici');
const Chat = require('../models/Chat');

const SYSTEM_PROMPT =
  'You are a helpful, concise assistant. Answer clearly and use markdown (including fenced code blocks) when it improves readability.';

const MAX_CONTEXT_MESSAGES = 30;

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
    // Use undici fetch so requests honor the global ProxyAgent set in server.js
    // and avoid node-fetch's HTTPS-agent-carryover bug on http:// redirects.
    fetch: undiciFetch,
  });
}

function describeError(err) {
  const parts = [err?.message || 'Unknown error'];
  if (err?.status) parts.push(`status=${err.status}`);
  if (err?.code) parts.push(`code=${err.code}`);
  const causeMsg = err?.cause?.message || err?.cause?.code;
  if (causeMsg) parts.push(`cause=${causeMsg}`);
  return parts.join(' | ');
}

function buildMessages(chat) {
  const recent = chat.messages.slice(-MAX_CONTEXT_MESSAGES);
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...recent.map((m) => ({ role: m.role, content: m.content })),
  ];
}

exports.listChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({ user: req.userId })
      .select('title createdAt updatedAt')
      .sort({ updatedAt: -1 });
    res.json({ chats });
  } catch (err) {
    next(err);
  }
};

exports.getChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, user: req.userId });
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    res.json({ chat });
  } catch (err) {
    next(err);
  }
};

exports.createChat = async (req, res, next) => {
  try {
    const chat = await Chat.create({ user: req.userId, title: 'New chat', messages: [] });
    res.status(201).json({ chat });
  } catch (err) {
    next(err);
  }
};

exports.deleteChat = async (req, res, next) => {
  try {
    const result = await Chat.deleteOne({ _id: req.params.id, user: req.userId });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Chat not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.renameChat = async (req, res, next) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: { title: req.body.title } },
      { new: true }
    );
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    res.json({ chat });
  } catch (err) {
    next(err);
  }
};

async function resolveChat(req) {
  if (req.params.id) {
    const chat = await Chat.findOne({ _id: req.params.id, user: req.userId });
    return chat;
  }
  return Chat.create({
    user: req.userId,
    title: (req.body.message || 'New chat').slice(0, 40),
    messages: [],
  });
}

exports.sendMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    const chat = await resolveChat(req);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    chat.messages.push({ role: 'user', content: message });

    const client = getClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const completion = await client.chat.completions.create({
      model,
      messages: buildMessages(chat),
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || '(no response)';
    chat.messages.push({ role: 'assistant', content: reply });

    if (chat.title === 'New chat') chat.title = message.slice(0, 40);

    await chat.save();
    res.json({ chat, reply });
  } catch (err) {
    next(err);
  }
};

exports.streamMessage = async (req, res, next) => {
  const { message } = req.body;
  let chat;
  try {
    chat = await resolveChat(req);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    chat.messages.push({ role: 'user', content: message });
    if (chat.title === 'New chat') chat.title = message.slice(0, 40);
    await chat.save();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send('meta', { chatId: chat._id, title: chat.title });

    const client = getClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const stream = await client.chat.completions.create({
      model,
      stream: true,
      messages: buildMessages(chat),
    });

    let full = '';
    req.on('close', () => {
      try { stream.controller?.abort?.(); } catch (_) { /* ignore */ }
    });

    for await (const part of stream) {
      const delta = part.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        send('delta', { content: delta });
      }
    }

    chat.messages.push({ role: 'assistant', content: full || '(no response)' });
    await chat.save();

    send('done', { reply: full });
    res.end();
  } catch (err) {
    console.error('[stream] OpenAI error:', err);
    if (err?.cause) console.error('[stream] cause:', err.cause);
    const detail = describeError(err);
    try {
      if (!res.headersSent) return next(err);
      res.write(`event: error\ndata: ${JSON.stringify({ message: detail })}\n\n`);
      res.end();
    } catch (_) {
      next(err);
    }
  }
};
