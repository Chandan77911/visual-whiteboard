import React, { useState, useEffect } from 'react';
import useWhiteboardStore from '../store/whiteboardStore';

export default function ContextPanel({ onSave }) {
  const { contextTarget, closeContextPanel, updateContextTarget } = useWhiteboardStore();
  const [activeTab, setActiveTab] = useState('notes');

  const context = contextTarget?.context || {};
  const [notes, setNotes] = useState(context.notes || '');
  const [links, setLinks] = useState(context.links || []);
  const [snippets, setSnippets] = useState(context.snippets || []);
  const [newLink, setNewLink] = useState('');
  const [newSnippet, setNewSnippet] = useState('');

  useEffect(() => {
    if (contextTarget?.context) {
      setNotes(contextTarget.context.notes || '');
      setLinks(contextTarget.context.links || []);
      setSnippets(contextTarget.context.snippets || []);
    }
  }, [contextTarget]);

  const handleSave = () => {
    const updatedContext = { notes, links, snippets };
    updateContextTarget(updatedContext);
    onSave?.(contextTarget?.objectId, updatedContext);
    closeContextPanel();
  };

  const addLink = () => {
    if (newLink.trim()) {
      setLinks([...links, newLink.trim()]);
      setNewLink('');
    }
  };

  const addSnippet = () => {
    if (newSnippet.trim()) {
      setSnippets([...snippets, newSnippet.trim()]);
      setNewSnippet('');
    }
  };

  const TABS = ['notes', 'links', 'code'];

  return (
    <div
      className="animate-slide-right"
      style={{
        position: 'fixed',
        right: 0,
        top: 48,
        bottom: 0,
        width: 320,
        background: '#1a1a24',
        borderLeft: '1px solid #2e2e40',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #2e2e40', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6c63ff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            📎 Context Layer
          </div>
          <div style={{ fontSize: 11, color: '#7a7a9a', marginTop: 2 }}>
            Element ID: {contextTarget?.objectId?.slice(0, 8)}
          </div>
        </div>
        <button
          onClick={closeContextPanel}
          style={{ background: 'none', border: 'none', color: '#7a7a9a', cursor: 'pointer', fontSize: 20 }}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2e2e40' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #6c63ff' : '2px solid transparent',
              color: activeTab === tab ? '#6c63ff' : '#7a7a9a',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'Space Grotesk, sans-serif',
              textTransform: 'capitalize',
              transition: 'all 0.15s',
            }}
          >
            {tab === 'notes' ? '📝 Notes' : tab === 'links' ? '🔗 Links' : '💻 Code'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'notes' && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this element..."
            style={{
              width: '100%',
              minHeight: 180,
              background: '#22222f',
              border: '1px solid #2e2e40',
              borderRadius: 8,
              color: '#e8e8f0',
              padding: '12px',
              fontSize: 13,
              fontFamily: 'Space Grotesk, sans-serif',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        )}

        {activeTab === 'links' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLink()}
                placeholder="https://..."
                style={{
                  flex: 1,
                  background: '#22222f',
                  border: '1px solid #2e2e40',
                  borderRadius: 6,
                  color: '#e8e8f0',
                  padding: '8px 12px',
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              />
              <button
                onClick={addLink}
                style={{
                  padding: '8px 14px',
                  background: '#6c63ff',
                  border: 'none',
                  borderRadius: 6,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                +
              </button>
            </div>
            {links.map((link, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#22222f', borderRadius: 6, padding: '8px 12px' }}>
                <span style={{ fontSize: 12 }}>🔗</span>
                <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: '#6c63ff', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                  {link}
                </a>
                <button onClick={() => setLinks(links.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#7a7a9a', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={newSnippet}
              onChange={(e) => setNewSnippet(e.target.value)}
              placeholder="// Paste code snippet here..."
              style={{
                width: '100%',
                minHeight: 120,
                background: '#0d0d14',
                border: '1px solid #2e2e40',
                borderRadius: 8,
                color: '#e8e8f0',
                padding: '12px',
                fontSize: 12,
                fontFamily: '"JetBrains Mono", monospace',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <button
              onClick={addSnippet}
              style={{
                padding: '8px',
                background: '#6c63ff',
                border: 'none',
                borderRadius: 6,
                color: 'white',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              + Add Snippet
            </button>
            {snippets.map((snippet, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <pre className="code-block">{snippet}</pre>
                <button
                  onClick={() => setSnippets(snippets.filter((_, j) => j !== i))}
                  style={{
                    position: 'absolute', top: 6, right: 8,
                    background: 'none', border: 'none', color: '#7a7a9a', cursor: 'pointer', fontSize: 14,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <div style={{ padding: 16, borderTop: '1px solid #2e2e40' }}>
        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(135deg, #6c63ff, #8b85ff)',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Save Context
        </button>
      </div>
    </div>
  );
}
