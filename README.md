# AI Chatbot

A full‑stack, production‑minded chatbot built with **MongoDB, Express, React (Vite), Node.js**, JWT authentication and the OpenAI API — with **real‑time SSE streaming**, markdown + code highlighting, dark mode, and a hardened backend.

## Structure

```
mern-chatbot/
├── server/   # Express + MongoDB + JWT + OpenAI (SSE streaming)
└── client/   # React (Vite) + Tailwind + React Router
```

## Prerequisites

- Node.js 18+
- MongoDB running locally (or a MongoDB Atlas connection string)
- An OpenAI API key

## Setup

### 1. Backend

```powershell
cd server
copy .env.example .env
# edit .env and fill in MONGO_URI, JWT_SECRET, OPENAI_API_KEY
npm install
npm run dev
```

Server runs on http://localhost:5000

### 2. Frontend

```powershell
cd client
npm install
npm run dev
```

Frontend runs on http://localhost:5173 and proxies `/api` to the backend.

## Features

### Backend
- JWT auth (register / login / me) with strict per‑IP rate limiting on `/api/auth`
- Global rate limiting, `helmet`, `compression`, `morgan` logs, `express-mongo-sanitize`
- CORS origin allowlist via `CORS_ORIGIN` (comma‑separated)
- Request validation with `express-validator`
- Persistent chat history per user (MongoDB)
- **Streaming chat completions over Server‑Sent Events** (`POST /api/chat/:id/stream`)
- Non‑streaming completion endpoint (`POST /api/chat/:id/message`)
- Rename / delete / list chats; sliding context window (last 30 msgs)
- Configurable model via `OPENAI_MODEL` (defaults to `gpt-4o-mini`)

### Frontend
- React 18 + Vite + Tailwind + React Router v6
- Auth context with token persistence and protected routes
- Chat sidebar: new / switch / rename (inline) / delete
- **Live streaming assistant replies** with typing indicator + **Stop** button (AbortController)
- Markdown rendering with GFM tables and `rehype-highlight` code blocks
- Dark / light theme toggle (persisted, respects OS preference)
- Toast notifications, auto‑resizing composer, auto‑scroll

## API Overview

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Login, returns JWT |
| GET  | `/api/auth/me` | Current user (auth) |
| GET  | `/api/chat` | List user chats |
| POST | `/api/chat` | Create empty chat |
| GET  | `/api/chat/:id` | Get chat with messages |
| PATCH | `/api/chat/:id` | Rename chat (`{ title }`) |
| DELETE | `/api/chat/:id` | Delete chat |
| POST | `/api/chat/message` or `/api/chat/:id/message` | Non‑streaming reply |
| POST | `/api/chat/stream` or `/api/chat/:id/stream` | **SSE streaming reply** |

SSE events: `meta` (chatId/title), `delta` (token chunks), `done` (final reply), `error`.

