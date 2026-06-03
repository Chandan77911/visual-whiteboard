const {
  saveBoardState,
  loadBoardState,
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
} = require('../middleware/redis');

function registerSocketHandlers(io, socket) {
  let currentRoom = null;
  let currentUser = null;

  // Join a whiteboard room
  socket.on('join-room', async ({ roomId, user }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      await removeUserFromRoom(currentRoom, socket.id);
    }

    currentRoom = roomId;
    currentUser = { ...user, socketId: socket.id };

    socket.join(roomId);
    await addUserToRoom(roomId, socket.id, currentUser);

    // Send existing board state to the joining user
    const boardState = await loadBoardState(roomId);
    socket.emit('board-state', boardState || { objects: [], version: 0 });

    // Notify others in the room
    const users = await getRoomUsers(roomId);
    io.to(roomId).emit('room-users', users);

    console.log(`[Room ${roomId}] ${user.name} joined`);
  });

  // Canvas object added
  socket.on('object-added', async ({ roomId, object, boardState }) => {
    socket.to(roomId).emit('object-added', { object, senderId: socket.id });
    if (boardState) await saveBoardState(roomId, boardState);
  });

  // Canvas object modified
  socket.on('object-modified', async ({ roomId, object, boardState }) => {
    socket.to(roomId).emit('object-modified', { object, senderId: socket.id });
    if (boardState) await saveBoardState(roomId, boardState);
  });

  // Canvas object removed
  socket.on('object-removed', async ({ roomId, objectId, boardState }) => {
    socket.to(roomId).emit('object-removed', { objectId, senderId: socket.id });
    if (boardState) await saveBoardState(roomId, boardState);
  });

  // Full board sync (after cleanup, etc.)
  socket.on('board-sync', async ({ roomId, boardState }) => {
    await saveBoardState(roomId, boardState);
    socket.to(roomId).emit('board-sync', { boardState, senderId: socket.id });
  });

  // Cursor movement for live collaboration
  socket.on('cursor-move', ({ roomId, x, y }) => {
    socket.to(roomId).emit('cursor-move', {
      userId: socket.id,
      user: currentUser,
      x,
      y,
    });
  });

  // Context layer update (notes, links, snippets)
  socket.on('context-update', async ({ roomId, objectId, context, boardState }) => {
    socket.to(roomId).emit('context-update', { objectId, context });
    if (boardState) await saveBoardState(roomId, boardState);
  });

  // Disconnect
  socket.on('disconnect', async () => {
    if (currentRoom) {
      await removeUserFromRoom(currentRoom, socket.id);
      const users = await getRoomUsers(currentRoom);
      io.to(currentRoom).emit('room-users', users);
      socket.to(currentRoom).emit('user-left', { userId: socket.id });
    }
  });
}

module.exports = { registerSocketHandlers };
