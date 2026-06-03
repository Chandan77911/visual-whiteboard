const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { saveBoardState, loadBoardState } = require('../middleware/redis');

// Create a new board room
router.post('/create', (req, res) => {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  res.json({ roomId, url: `/board/${roomId}` });
});

// Get board state
router.get('/:roomId', async (req, res) => {
  try {
    const state = await loadBoardState(req.params.roomId);
    res.json(state || { objects: [], version: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save board state (REST fallback)
router.post('/:roomId/save', async (req, res) => {
  try {
    await saveBoardState(req.params.roomId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
