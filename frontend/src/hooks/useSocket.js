import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useWhiteboardStore from '../store/whiteboardStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socketInstance = null;

export function useSocket() {
  const socketRef = useRef(null);
  const { setRoomUsers, fabricCanvas } = useWhiteboardStore();

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, { transports: ['websocket'] });
    }
    socketRef.current = socketInstance;

    return () => {
      // Don't disconnect on unmount — keep persistent
    };
  }, []);

  const joinRoom = useCallback((roomId, user) => {
    socketRef.current?.emit('join-room', { roomId, user });
  }, []);

  const emitObjectAdded = useCallback((roomId, object, boardState) => {
    socketRef.current?.emit('object-added', { roomId, object, boardState });
  }, []);

  const emitObjectModified = useCallback((roomId, object, boardState) => {
    socketRef.current?.emit('object-modified', { roomId, object, boardState });
  }, []);

  const emitObjectRemoved = useCallback((roomId, objectId, boardState) => {
    socketRef.current?.emit('object-removed', { roomId, objectId, boardState });
  }, []);

  const emitBoardSync = useCallback((roomId, boardState) => {
    socketRef.current?.emit('board-sync', { roomId, boardState });
  }, []);

  const emitCursorMove = useCallback((roomId, x, y) => {
    socketRef.current?.emit('cursor-move', { roomId, x, y });
  }, []);

  const emitContextUpdate = useCallback((roomId, objectId, context, boardState) => {
    socketRef.current?.emit('context-update', { roomId, objectId, context, boardState });
  }, []);

  const onRoomUsers = useCallback((cb) => {
    socketRef.current?.on('room-users', cb);
    return () => socketRef.current?.off('room-users', cb);
  }, []);

  const getSocket = () => socketRef.current;

  return {
    socket: socketRef.current,
    getSocket,
    joinRoom,
    emitObjectAdded,
    emitObjectModified,
    emitObjectRemoved,
    emitBoardSync,
    emitCursorMove,
    emitContextUpdate,
    onRoomUsers,
  };
}
