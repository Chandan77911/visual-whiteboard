import React from 'react';

const CURSOR_COLORS = ['#6c63ff', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#f0abfc'];

export default function CollabCursors({ cursors }) {
  return (
    <>
      {cursors.map((cursor, i) => (
        <div
          key={cursor.userId}
          style={{
            position: 'fixed',
            left: cursor.x,
            top: cursor.y,
            pointerEvents: 'none',
            zIndex: 50,
            transform: 'translate(-2px, -2px)',
            transition: 'left 0.05s linear, top 0.05s linear',
          }}
        >
          {/* Cursor SVG */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 2L17 9L10 11L7 18L4 2Z"
              fill={CURSOR_COLORS[i % CURSOR_COLORS.length]}
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>
          {/* Name label */}
          <div
            style={{
              marginLeft: 14,
              marginTop: -4,
              background: CURSOR_COLORS[i % CURSOR_COLORS.length],
              color: 'white',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 10,
              whiteSpace: 'nowrap',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            {cursor.user?.name || 'User'}
          </div>
        </div>
      ))}
    </>
  );
}
