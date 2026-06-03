require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { initRedis } = require('./middleware/redis');
const boardRoutes = require('./routes/board');
const assistRoutes = require('./routes/assist');
const { registerSocketHandlers } = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/board', boardRoutes);
app.use('/api/assist', assistRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// WebSocket
io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);
  registerSocketHandlers(io, socket);
  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

async function start() {
  await initRedis();
  server.listen(PORT, () => {
    console.log(`🚀 Visual Whiteboard backend running on port ${PORT}`);
  });
}

start().catch(console.error);
