/**
 * Storage layer — works in two modes:
 *
 *  1. REDIS MODE   — set REDIS_URL in your .env (production / Linux / Mac)
 *  2. MEMORY MODE  — default on Windows with no Redis installed (local dev)
 *
 * Everything falls back automatically — no configuration needed on Windows.
 */

// ─── In-Memory Store (Windows / no-Redis fallback) ───────────────────────────
const memStore = {
  boards: {},   // roomId  -> boardState
  users: {},    // roomId  -> { userId -> userInfo }
};

let redis = null;
let usingRedis = false;

async function initRedis() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('[Storage] No REDIS_URL found — using in-memory store (Windows/local mode)');
    console.log('[Storage] ✅ App will work fine! Data resets when server restarts.');
    return;
  }

  try {
    const Redis = require('ioredis');
    redis = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 3000 });

    await redis.connect();
    usingRedis = true;
    console.log('[Storage] ✅ Connected to Redis');

    redis.on('error', (err) => {
      console.warn('[Storage] Redis error — falling back to memory:', err.message);
      usingRedis = false;
    });
  } catch (err) {
    console.warn('[Storage] Could not connect to Redis — using in-memory store:', err.message);
    usingRedis = false;
  }
}

// ─── Board State ──────────────────────────────────────────────────────────────

async function saveBoardState(roomId, state) {
  if (usingRedis) {
    await redis.set(`board:${roomId}`, JSON.stringify(state), 'EX', 86400);
  } else {
    memStore.boards[roomId] = state;
  }
}

async function loadBoardState(roomId) {
  if (usingRedis) {
    const data = await redis.get(`board:${roomId}`);
    return data ? JSON.parse(data) : null;
  }
  return memStore.boards[roomId] || null;
}

// ─── Room Users ───────────────────────────────────────────────────────────────

async function addUserToRoom(roomId, userId, userInfo) {
  if (usingRedis) {
    await redis.hset(`room:${roomId}:users`, userId, JSON.stringify(userInfo));
    await redis.expire(`room:${roomId}:users`, 86400);
  } else {
    if (!memStore.users[roomId]) memStore.users[roomId] = {};
    memStore.users[roomId][userId] = userInfo;
  }
}

async function removeUserFromRoom(roomId, userId) {
  if (usingRedis) {
    await redis.hdel(`room:${roomId}:users`, userId);
  } else {
    if (memStore.users[roomId]) {
      delete memStore.users[roomId][userId];
    }
  }
}

async function getRoomUsers(roomId) {
  if (usingRedis) {
    const users = await redis.hgetall(`room:${roomId}:users`);
    if (!users) return [];
    return Object.entries(users).map(([id, info]) => ({ id, ...JSON.parse(info) }));
  }
  const room = memStore.users[roomId] || {};
  return Object.entries(room).map(([id, info]) => ({ id, ...info }));
}

module.exports = {
  initRedis,
  saveBoardState,
  loadBoardState,
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
};
