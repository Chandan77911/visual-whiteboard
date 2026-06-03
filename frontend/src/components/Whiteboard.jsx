import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useFabric } from '../hooks/useFabric';
import { useSocket } from '../hooks/useSocket';
import useWhiteboardStore from '../store/whiteboardStore';
import { massCleanup } from '../utils/cleanup';
import { getCanvasSummary, assignId, findObjectById } from '../utils/fabricHelpers';
import Toolbar from './Toolbar';
import ContextPanel from './ContextPanel';
import ArchitectAssist from './ArchitectAssist';
import CollabCursors from './CollabCursors';

const ROOM_ID = window.location.pathname.split('/').pop() || 'default-room';

export default function Whiteboard() {
  const canvasRef = useRef(null);
  const {
    fabricCanvas,
    contextPanelOpen,
    assistPanelOpen,
    openContextPanel,
    openAssistPanel,
    closeAssistPanel,
    setAssistSuggestions,
    setAssistLoading,
    setCleanupInProgress,
    cleanupInProgress,
    roomUsers,
    setRoomUsers,
    roomId,
    setRoomId,
    user,
    setUser,
  } = useWhiteboardStore();

  const [collabCursors, setCollabCursors] = useState([]);

  const { addRect, addCircle, addText, addArrow, deleteSelected, clearCanvas, getJSON, loadJSON } =
    useFabric(canvasRef);

  const { joinRoom, emitObjectAdded, emitObjectModified, emitObjectRemoved, emitBoardSync, emitCursorMove, emitContextUpdate, getSocket } =
    useSocket();

  // Init user + join room
  useEffect(() => {
    const savedUser = { name: `User-${Math.floor(Math.random() * 999)}`, id: Math.random().toString(36).slice(2, 9) };
    setUser(savedUser);
    setRoomId(ROOM_ID);
    joinRoom(ROOM_ID, savedUser);
  }, []);

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('room-users', setRoomUsers);

    socket.on('board-state', (state) => {
      if (state && state.objects?.length > 0) {
        loadJSON(state);
      }
    });

    socket.on('board-sync', ({ boardState }) => {
      loadJSON(boardState);
    });

    socket.on('object-added', ({ object }) => {
      // Remote objects are synced via board-sync
    });

    socket.on('cursor-move', ({ userId, user: cursorUser, x, y }) => {
      setCollabCursors((prev) => {
        const existing = prev.filter((c) => c.userId !== userId);
        return [...existing, { userId, user: cursorUser, x, y }];
      });
    });

    socket.on('user-left', ({ userId }) => {
      setCollabCursors((prev) => prev.filter((c) => c.userId !== userId));
    });

    return () => {
      socket.off('room-users');
      socket.off('board-state');
      socket.off('board-sync');
      socket.off('object-added');
      socket.off('cursor-move');
      socket.off('user-left');
    };
  }, [getSocket()]);

  // Mouse move -> emit cursor
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (roomId) emitCursorMove(roomId, e.clientX, e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [roomId]);

  // Canvas object events -> emit to room
  useEffect(() => {
    if (!fabricCanvas || !roomId) return;

    const onAdded = (e) => {
      const obj = e.target;
      if (!obj) return;
      assignId(obj);
      const state = getJSON();
      emitObjectAdded(roomId, obj.toJSON(['id']), state);
    };

    const onModified = (e) => {
      const obj = e.target;
      if (!obj) return;
      const state = getJSON();
      emitObjectModified(roomId, obj.toJSON(['id']), state);
    };

    const onRemoved = (e) => {
      const obj = e.target;
      if (!obj) return;
      const state = getJSON();
      emitObjectRemoved(roomId, obj.id, state);
    };

    fabricCanvas.on('object:added', onAdded);
    fabricCanvas.on('object:modified', onModified);
    fabricCanvas.on('object:removed', onRemoved);

    // Right-click -> context panel
    fabricCanvas.on('mouse:down', (e) => {
      if (e.e.button === 2 && e.target) {
        e.e.preventDefault();
        assignId(e.target);
        openContextPanel(e.target.id, e.target.contextData || {});
      }
    });

    fabricCanvas.wrapperEl.addEventListener('contextmenu', (e) => e.preventDefault());

    return () => {
      fabricCanvas.off('object:added', onAdded);
      fabricCanvas.off('object:modified', onModified);
      fabricCanvas.off('object:removed', onRemoved);
    };
  }, [fabricCanvas, roomId]);

  // Handlers
  const handleAddShape = useCallback((type) => {
    if (type === 'rect') addRect();
    else if (type === 'circle') addCircle();
    else if (type === 'arrow') addArrow();
    else if (type === 'text') addText();
  }, [addRect, addCircle, addArrow, addText]);

  const handleMassCleanup = useCallback(() => {
    if (!fabricCanvas || cleanupInProgress) return;
    setCleanupInProgress(true);
    massCleanup(fabricCanvas);
    setTimeout(() => {
      const state = getJSON();
      emitBoardSync(roomId, state);
      setCleanupInProgress(false);
    }, 500);
  }, [fabricCanvas, roomId, cleanupInProgress]);

  const handleArchitectAssist = useCallback(async () => {
    openAssistPanel();
    setAssistLoading(true);

    const summary = getCanvasSummary(fabricCanvas);
    try {
      const response = await fetch('/api/assist/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagramDescription: summary, objects: fabricCanvas?.getObjects() || [] }),
      });
      const data = await response.json();
      setAssistSuggestions(data.suggestions);
    } catch (err) {
      console.error('Assist error:', err);
    } finally {
      setAssistLoading(false);
    }
  }, [fabricCanvas]);

  const handleContextSave = useCallback((objectId, context) => {
    const obj = findObjectById(fabricCanvas, objectId);
    if (obj) {
      obj.contextData = context;
      const state = getJSON();
      emitContextUpdate(roomId, objectId, context, state);
    }
  }, [fabricCanvas, roomId]);

  const handleClear = useCallback(() => {
    if (window.confirm('Clear the entire canvas?')) {
      clearCanvas();
      emitBoardSync(roomId, { objects: [], version: 0 });
    }
  }, [clearCanvas, roomId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header style={{
        height: 48,
        background: '#1a1a24',
        borderBottom: '1px solid #2e2e40',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        zIndex: 30,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#e8e8f0', letterSpacing: '-0.02em' }}>
          ⬡ Visual Whiteboard
        </div>

        <div style={{ fontSize: 11, color: '#7a7a9a', background: '#22222f', padding: '3px 10px', borderRadius: 20, border: '1px solid #2e2e40' }}>
          Room: <span style={{ color: '#6c63ff', fontWeight: 600 }}>{ROOM_ID}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Feature buttons */}
        <button
          onClick={handleMassCleanup}
          disabled={cleanupInProgress}
          style={{
            padding: '6px 14px',
            background: cleanupInProgress ? '#22222f' : 'rgba(108,99,255,0.15)',
            border: '1px solid rgba(108,99,255,0.4)',
            borderRadius: 8,
            color: '#8b85ff',
            cursor: cleanupInProgress ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'Space Grotesk, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          🧹 {cleanupInProgress ? 'Cleaning...' : 'Mass Cleanup'}
        </button>

        <button
          onClick={handleArchitectAssist}
          style={{
            padding: '6px 14px',
            background: 'rgba(56,189,248,0.1)',
            border: '1px solid rgba(56,189,248,0.4)',
            borderRadius: 8,
            color: '#38bdf8',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'Space Grotesk, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          🤖 Arch Assist
        </button>

        {/* Room users */}
        <div style={{ display: 'flex', alignItems: 'center', gap: -4 }}>
          {roomUsers.slice(0, 5).map((u, i) => (
            <div
              key={u.id || i}
              title={u.name}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: `hsl(${i * 60}, 70%, 50%)`,
                border: '2px solid #1a1a24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: 'white',
                marginLeft: i > 0 ? -8 : 0,
              }}
            >
              {(u.name || '?')[0].toUpperCase()}
            </div>
          ))}
          <div style={{ marginLeft: 8, fontSize: 11, color: '#7a7a9a' }}>
            {roomUsers.length} online
          </div>
        </div>

        <div style={{ fontSize: 11, color: '#7a7a9a' }}>
          Right-click element for Context Layer
        </div>
      </header>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Toolbar onAddShape={handleAddShape} onDelete={deleteSelected} onClear={handleClear} />

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        {/* Context Panel */}
        {contextPanelOpen && <ContextPanel onSave={handleContextSave} />}
      </div>

      {/* Architecture Assist Modal */}
      {assistPanelOpen && <ArchitectAssist />}

      {/* Collab cursors */}
      <CollabCursors cursors={collabCursors} />
    </div>
  );
}
