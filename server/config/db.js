const mongoose = require('mongoose');

let memoryServer = null;

async function startMemoryServer() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri('mern-chatbot');
  console.warn('[db] Using in-memory MongoDB (data will be lost on restart).');
  return uri;
}

async function connect(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
}

async function connectDB() {
  const isProd = process.env.NODE_ENV === 'production';
  const configured = process.env.MONGO_URI;

  if (configured) {
    try {
      await connect(configured);
      console.log('MongoDB connected');
      return;
    } catch (err) {
      if (isProd) throw err;
      console.warn(`[db] Could not reach ${configured}: ${err.message}`);
      console.warn('[db] Falling back to in-memory MongoDB.');
    }
  } else if (isProd) {
    throw new Error('MONGO_URI is not set');
  }

  const uri = await startMemoryServer();
  await connect(uri);
  console.log('MongoDB connected (in-memory)');
}

async function stopMemoryServer() {
  if (memoryServer) {
    await mongoose.disconnect().catch(() => {});
    await memoryServer.stop().catch(() => {});
    memoryServer = null;
  }
}

process.on('SIGINT', async () => {
  await stopMemoryServer();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await stopMemoryServer();
  process.exit(0);
});

module.exports = connectDB;
