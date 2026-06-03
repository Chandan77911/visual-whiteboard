import React from 'react';
import useWhiteboardStore from '../store/whiteboardStore';

export default function ArchitectAssist() {
  const { assistSuggestions, assistLoading, closeAssistPanel } = useWhiteboardStore();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closeAssistPanel(); }}
    >
      <div
        className="animate-fade-up"
        style={{
          background: '#1a1a24',
          border: '1px solid #2e2e40',
          borderRadius: 16,
          width: '90%',
          maxWidth: 720,
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #2e2e40', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f0' }}>🤖 Architecture Assist</div>
            <div style={{ fontSize: 12, color: '#7a7a9a', marginTop: 4 }}>AI-powered suggestions for your diagram</div>
          </div>
          <button onClick={closeAssistPanel} style={{ background: 'none', border: 'none', color: '#7a7a9a', cursor: 'pointer', fontSize: 24 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {assistLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#7a7a9a' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚙️</div>
              <div style={{ fontSize: 14 }}>Analyzing your architecture...</div>
              <div style={{ width: 200, height: 3, background: '#2e2e40', borderRadius: 2, margin: '16px auto', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '60%', background: '#6c63ff', borderRadius: 2, animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            </div>
          ) : assistSuggestions ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Summary */}
              {assistSuggestions.summary && (
                <SectionCard title="📋 Summary" color="#6c63ff">
                  <p style={{ color: '#c0c0d8', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{assistSuggestions.summary}</p>
                </SectionCard>
              )}

              {/* APIs */}
              {assistSuggestions.apis?.length > 0 && (
                <SectionCard title="🔌 Recommended APIs & Services" color="#38bdf8">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {assistSuggestions.apis.map((api, i) => (
                      <div key={i} style={{ background: '#22222f', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: 13 }}>{api.name}</div>
                        <div style={{ color: '#7a7a9a', fontSize: 12, marginTop: 2 }}>{api.reason}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* DBMS */}
              {assistSuggestions.dbms && (
                <SectionCard title="🗄️ Database Recommendation" color="#22c55e">
                  <p style={{ color: '#c0c0d8', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{assistSuggestions.dbms}</p>
                </SectionCard>
              )}

              {/* Missing */}
              {assistSuggestions.missing?.length > 0 && (
                <SectionCard title="⚠️ Missing Components" color="#f59e0b">
                  <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {assistSuggestions.missing.map((item, i) => (
                      <li key={i} style={{ color: '#c0c0d8', fontSize: 13 }}>{item}</li>
                    ))}
                  </ul>
                </SectionCard>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Scalability */}
                {assistSuggestions.scalability?.length > 0 && (
                  <SectionCard title="📈 Scalability" color="#f0abfc">
                    <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {assistSuggestions.scalability.map((tip, i) => (
                        <li key={i} style={{ color: '#c0c0d8', fontSize: 12 }}>{tip}</li>
                      ))}
                    </ul>
                  </SectionCard>
                )}

                {/* Performance */}
                {assistSuggestions.performance?.length > 0 && (
                  <SectionCard title="⚡ Performance" color="#fbbf24">
                    <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {assistSuggestions.performance.map((tip, i) => (
                        <li key={i} style={{ color: '#c0c0d8', fontSize: 12 }}>{tip}</li>
                      ))}
                    </ul>
                  </SectionCard>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#7a7a9a' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
              <div>No suggestions yet. Add some elements to the board first.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, color, children }) {
  return (
    <div style={{ border: `1px solid ${color}30`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: `${color}15`, padding: '10px 14px', borderBottom: `1px solid ${color}20` }}>
        <div style={{ fontWeight: 700, fontSize: 13, color }}>{title}</div>
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  );
}
