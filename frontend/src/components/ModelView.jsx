import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, ShieldCheck, Cpu, ArrowRightLeft, Layers } from 'lucide-react';

export default function ModelView({ hasRun, reloadCount }) {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredCell, setHoveredCell] = useState(null);

  if (!hasRun) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', color: '#f3f4f6', fontFamily: 'Outfit', fontWeight: 700 }}>
            Model Structural Diagnostics
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: 4 }}>
            Explore the trained parameters, regime emission distributions, and state transition dynamics.
          </p>
        </div>
        <div className="glass-panel animate-fade-in" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 40px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)',
          borderStyle: 'dashed', borderWidth: '1px', borderColor: 'var(--border-glass)',
          borderRadius: 16, marginTop: 12
        }}>
          <div style={{
            background: 'rgba(99, 102, 241, 0.1)', padding: 20, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20
          }}>
            <Cpu size={36} color="var(--color-accent)" />
          </div>
          <h4 style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 700, marginBottom: 8, color: '#f3f4f6' }}>
            Model Diagnostics Locked
          </h4>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: 460, marginBottom: 0, lineHeight: 1.5 }}>
            No active HMM model instance exists. Please go to the Dashboard tab, adjust your settings in the TAA Sandbox Configuration, and click 'Run Dynamic Backtest' to train the HMM engine.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const fetchDiagnostics = async () => {
      try {
        const response = await fetch('/api/model/diagnostics');
        if (!response.ok) {
          throw new Error('Failed to load model diagnostics.');
        }
        const data = await response.json();
        setDiagnostics(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDiagnostics();
  }, [reloadCount]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: 400, alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        <RefreshCw size={24} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite', marginRight: 12 }} />
        Reading HMM structural parameters...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 24, borderColor: '#ef4444' }}>
        <AlertTriangle color="#ef4444" size={24} />
        <div>
          <h3 style={{ color: '#f3f4f6', fontWeight: 600 }}>Failed to load Model parameters</h3>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: 4 }}>{error}</p>
        </div>
      </div>
    );
  }

  const { transition_matrix, feature_profiles, regime_labels, feature_names } = diagnostics;

  // Colors aligned with DashboardView
  const REGIME_COLORS = {
    'inflationary_expansion': '#f59e0b',  // Gold
    'disinflationary_expansion': '#10b981',  // Emerald
    'stagflation': '#f43f5e',  // Rose
    'recession': '#3b82f6'  // Blue
  };

  const REGIME_NAMES = {
    'inflationary_expansion': 'Inflationary Expansion',
    'disinflationary_expansion': 'Disinflationary Growth',
    'stagflation': 'Stagflation',
    'recession': 'Recession'
  };

  const REGIME_TAGS = {
    'inflationary_expansion': 'INF EXP',
    'disinflationary_expansion': 'DIS EXP',
    'stagflation': 'STAGFL',
    'recession': 'RECES'
  };

  const FEATURE_NAMES_HUMAN = {
    'inflation_yoy': 'YoY Inflation Trend',
    'gdp_growth': 'Quarterly GDP Momentum',
    'unemployment_mom': 'Labor Market Slack',
    'curve_slope': 'Yield Curve Slope (10Y-2Y)',
    'curve_slope_chg': 'Yield Curve Change (6m)'
  };

  const getCellColor = (prob) => {
    // Premium translucent violet density layer
    return `rgba(99, 102, 241, ${0.05 + prob * 0.85})`;
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1.75rem', color: '#f3f4f6', fontFamily: 'Outfit', fontWeight: 700 }}>
          HMM Structural Diagnostics
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: 4 }}>
          Inspect state transition dynamics, feature emissions, and structural matrices estimated by the unsupervised machine learning engine.
        </p>
      </div>

      {/* Two-Column Side-by-Side Layout with Top Alignment */}
      <div className="diagnostics-grid">
        
        {/* Left Column: State Feature Profiles */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={18} color="var(--color-accent)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f3f4f6', margin: 0, fontFamily: 'Outfit' }}>
                Regime Feature Emissions (Gaussian Means)
              </h3>
            </div>
            <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginTop: 4, marginBottom: 0 }}>
              The average z-scored values of macroeconomic features within each latent state. The center line marks $0.0 \sigma$ (long-term average).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {regime_labels.map((regime) => (
              <div 
                key={regime} 
                className="glass-panel" 
                style={{ 
                  padding: 16, 
                  background: 'rgba(255, 255, 255, 0.01)',
                  borderLeft: `4px solid ${REGIME_COLORS[regime] || '#6b7280'}`,
                  borderRadius: '0 8px 8px 0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                }}
              >
                <h4 style={{ color: REGIME_COLORS[regime] || '#f3f4f6', fontSize: '0.9375rem', fontWeight: 700, marginBottom: 12, fontFamily: 'Outfit' }}>
                  {REGIME_NAMES[regime] || regime}
                </h4>
                
                {/* Progress bars representing feature means */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(feature_profiles[regime] || {}).map(([feat, stats]) => {
                    const zScore = stats.mean;
                    // Map Z-score from [-2.5, +2.5] to [0%, 100%] for display
                    const percentage = Math.min(Math.max(((zScore + 2.5) / 5) * 100, 0), 100);
                    
                    return (
                      <div key={feat} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: '#9ca3af' }}>{FEATURE_NAMES_HUMAN[feat] || feat}</span>
                          <span style={{ color: zScore >= 0 ? '#10b981' : '#ef4444', fontWeight: 700, fontFamily: 'monospace' }}>
                            {zScore >= 0 ? '+' : ''}{zScore.toFixed(2)} σ
                          </span>
                        </div>
                        <div style={{ 
                          width: '100%', 
                          height: 8, 
                          backgroundColor: 'rgba(0,0,0,0.4)', 
                          borderRadius: 4, 
                          position: 'relative', 
                          border: '1px solid rgba(255,255,255,0.05)',
                          overflow: 'hidden' 
                        }}>
                          {/* Centered zero line */}
                          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.25)', zIndex: 1 }} />
                          {/* Dynamic bar filled from center with premium glow shadow */}
                          <div style={{
                            position: 'absolute',
                            left: zScore >= 0 ? '50%' : `${percentage}%`,
                            right: zScore >= 0 ? `${100 - percentage}%` : '50%',
                            top: 0,
                            bottom: 0,
                            background: zScore >= 0 
                              ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)' 
                              : 'linear-gradient(90deg, #f43f5e 0%, #ef4444 100%)',
                            boxShadow: zScore >= 0 
                              ? '0 0 6px rgba(16, 185, 129, 0.4)' 
                              : '0 0 6px rgba(244, 63, 94, 0.4)',
                            borderRadius: 4
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Transition Matrix Heatmap & Legend */}
        <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ArrowRightLeft size={18} color="var(--color-accent)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f3f4f6', margin: 0, fontFamily: 'Outfit' }}>
                Transition Probability Matrix Heatmap
              </h3>
            </div>
            <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginTop: 4, marginBottom: 0 }}>
              The probability of moving from a row regime (from) to a column regime (to) next month. Sticky diagonals indicate persistent states.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 8 }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              
              {/* Perfectly Proportioned Floating Square Grid Heatmap */}
              <div style={{ overflowX: 'auto', width: '100%', display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
                <table style={{ 
                  borderCollapse: 'separate', 
                  borderSpacing: '6px', 
                  tableLayout: 'fixed', 
                  width: 'auto' 
                }}>
                  <thead>
                    <tr>
                      <th style={{ width: '85px', padding: 0 }}></th>
                      {regime_labels.map((lbl) => (
                        <th key={lbl} style={{
                          width: '72px',
                          padding: '0 0 8px 0', 
                          fontSize: '0.625rem', 
                          color: '#9ca3af', 
                          fontWeight: 700, 
                          letterSpacing: '0.06em', 
                          textAlign: 'center'
                        }}>
                          {REGIME_TAGS[lbl] || lbl.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regime_labels.map((row_lbl, row_idx) => (
                      <tr key={row_lbl}>
                        {/* Row Header */}
                        <td style={{
                          width: '85px',
                          padding: '0 10px 0 0', 
                          fontSize: '0.625rem', 
                          color: REGIME_COLORS[row_lbl] || '#9ca3af',
                          fontWeight: 700, 
                          letterSpacing: '0.04em', 
                          textTransform: 'uppercase',
                          textAlign: 'right'
                        }}>
                          {REGIME_TAGS[row_lbl] || row_lbl.toUpperCase()}
                        </td>
                        {/* Matrix Cells */}
                        {regime_labels.map((col_lbl, col_idx) => {
                          const prob = transition_matrix[row_idx][col_idx];
                          const cellBg = getCellColor(prob);
                          const isDiagonal = row_idx === col_idx;
                          const isHovered = hoveredCell && hoveredCell.row === row_idx && hoveredCell.col === col_idx;
                          
                          return (
                            <td 
                              key={col_lbl} 
                              onMouseEnter={() => setHoveredCell({ row: row_idx, col: col_idx })}
                              onMouseLeave={() => setHoveredCell(null)}
                              title={`Probability of transitioning from ${REGIME_NAMES[row_lbl]} to ${REGIME_NAMES[col_lbl]} is ${(prob * 100).toFixed(1)}%`}
                              style={{
                                width: '72px',
                                height: '72px',
                                backgroundColor: cellBg,
                                textAlign: 'center',
                                fontSize: '0.9375rem',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                color: prob >= 0.5 ? '#ffffff' : '#f3f4f6',
                                cursor: 'pointer',
                                borderRadius: '8px',
                                border: isDiagonal ? `2px solid ${REGIME_COLORS[row_lbl]}` : '1px solid rgba(255,255,255,0.03)',
                                boxShadow: isDiagonal ? `0 0 10px ${REGIME_COLORS[row_lbl]}20` : 'none',
                                transform: isHovered ? 'scale(1.08)' : 'none',
                                zIndex: isHovered ? 10 : 1,
                                position: 'relative',
                                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
                              }}
                            >
                              {(prob * 100).toFixed(0)}%
                              
                              {/* Sticky indicator on diagonal */}
                              {isDiagonal && (
                                <div style={{ 
                                  position: 'absolute', top: 5, right: 5, 
                                  width: 4, height: 4, borderRadius: '50%', 
                                  backgroundColor: REGIME_COLORS[row_lbl] 
                                }} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Heatmap Legend Bar (Matches table width) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: '0.6875rem', color: '#9ca3af', width: '100%', maxWidth: '373px' }}>
                <span>Transient (0%)</span>
                <div style={{ 
                  flex: 1, height: 6, margin: '0 12px', borderRadius: 3, 
                  background: 'linear-gradient(to right, rgba(99, 102, 241, 0.05), rgba(99, 102, 241, 0.85))',
                  border: '1px solid rgba(255,255,255,0.05)'
                }} />
                <span>Sticky (100%)</span>
              </div>
              
              {/* Dynamic explanations */}
              <div className="glass-panel" style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 12, marginTop: 24,
                borderColor: 'var(--color-accent)', background: 'rgba(99, 102, 241, 0.03)',
                width: '100%'
              }}>
                <ShieldCheck size={14} color="var(--color-accent)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: '#e5e7eb', lineHeight: 1.4 }}>
                  {hoveredCell ? (
                    <>
                      <strong>{(transition_matrix[hoveredCell.row][hoveredCell.col] * 100).toFixed(1)}% chance</strong> of transitioning from <strong>{REGIME_NAMES[regime_labels[hoveredCell.row]]}</strong> to <strong>{REGIME_NAMES[regime_labels[hoveredCell.col]]}</strong>.
                    </>
                  ) : (
                    "Hover over any matrix tile to check transition probabilities. High diagonal values confirm HMM regime structural stability."
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
