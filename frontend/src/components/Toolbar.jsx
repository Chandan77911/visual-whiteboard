import React from 'react';
import useWhiteboardStore from '../store/whiteboardStore';

const TOOLS = [
  { id: 'select', icon: '↖', label: 'Select' },
  { id: 'pen', icon: '✏️', label: 'Pen' },
  { id: 'rect', icon: '▭', label: 'Rectangle' },
  { id: 'circle', icon: '○', label: 'Circle' },
  { id: 'arrow', icon: '→', label: 'Arrow' },
  { id: 'text', icon: 'T', label: 'Text' },
  { id: 'eraser', icon: '⌫', label: 'Eraser' },
];

const COLORS = ['#6c63ff', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#f0abfc', '#e8e8f0', '#ffffff'];

export default function Toolbar({ onAddShape, onDelete, onClear }) {
  const { activeTool, setActiveTool, strokeColor, setStrokeColor, strokeWidth, setStrokeWidth } =
    useWhiteboardStore();

  return (
    <div
      className="flex flex-col gap-1 p-3 border-r border-border"
      style={{ width: 64, background: '#1a1a24', height: '100%' }}
    >
      {/* Tool buttons */}
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          title={tool.label}
          onClick={() => {
            setActiveTool(tool.id);
            if (['rect', 'circle', 'arrow', 'text'].includes(tool.id)) {
              onAddShape?.(tool.id);
            }
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            border: activeTool === tool.id ? '2px solid #6c63ff' : '2px solid transparent',
            background: activeTool === tool.id ? 'rgba(108,99,255,0.2)' : 'transparent',
            color: activeTool === tool.id ? '#6c63ff' : '#7a7a9a',
            fontSize: tool.id === 'text' ? 16 : 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 600,
          }}
        >
          {tool.icon}
        </button>
      ))}

      <div style={{ height: 1, background: '#2e2e40', margin: '8px 0' }} />

      {/* Color palette */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {COLORS.map((color) => (
          <button
            key={color}
            title={color}
            onClick={() => setStrokeColor(color)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: color,
              border: strokeColor === color ? '2px solid white' : '2px solid transparent',
              cursor: 'pointer',
              alignSelf: 'center',
              transition: 'transform 0.1s',
              transform: strokeColor === color ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      <div style={{ height: 1, background: '#2e2e40', margin: '8px 0' }} />

      {/* Stroke width */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        {[1, 2, 4, 6].map((w) => (
          <button
            key={w}
            title={`Stroke: ${w}px`}
            onClick={() => setStrokeWidth(w)}
            style={{
              width: 36,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: strokeWidth === w ? 'rgba(108,99,255,0.2)' : 'transparent',
              border: strokeWidth === w ? '1px solid #6c63ff' : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            <div style={{ height: w, width: 20, background: '#e8e8f0', borderRadius: 1 }} />
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Delete + Clear */}
      <button
        title="Delete selected"
        onClick={onDelete}
        style={{
          width: 40, height: 40, borderRadius: 8, border: 'none',
          background: 'rgba(239,68,68,0.1)', color: '#ef4444',
          cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        🗑
      </button>
      <button
        title="Clear canvas"
        onClick={onClear}
        style={{
          width: 40, height: 40, borderRadius: 8, border: 'none',
          background: 'rgba(239,68,68,0.05)', color: '#7a7a9a',
          cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  );
}
