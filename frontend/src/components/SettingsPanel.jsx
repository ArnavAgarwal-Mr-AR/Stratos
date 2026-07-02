import React, { useState } from 'react';
import { Sliders, X, Play, Info, Check } from 'lucide-react';

export default function SettingsPanel({ isOpen, onClose, onRunBacktest, isRunning }) {
  const [startDate, setStartDate] = useState('1990-01-01');
  const [endDate, setEndDate] = useState('2026-06-01');
  const [nRegimes, setNRegimes] = useState(4);
  
  // Tickers Selection (pre-defined list)
  const ALL_TICKERS = ['SPY', 'TLT', 'IEF', 'TIP', 'GLD', 'DBC', 'SHY'];
  const [selectedTickers, setSelectedTickers] = useState([...ALL_TICKERS]);

  // Target allocations state
  const [allocationMap, setAllocationMap] = useState({
    'inflationary_expansion': { 'SPY': 45, 'DBC': 20, 'TIP': 15, 'TLT': 10, 'SHY': 10, 'IEF': 0, 'GLD': 0 },
    'disinflationary_expansion': { 'SPY': 60, 'DBC': 5, 'TIP': 5, 'TLT': 20, 'SHY': 10, 'IEF': 0, 'GLD': 0 },
    'stagflation': { 'SPY': 20, 'DBC': 25, 'TIP': 20, 'TLT': 10, 'SHY': 25, 'IEF': 0, 'GLD': 0 },
    'recession': { 'SPY': 15, 'DBC': 5, 'TIP': 10, 'TLT': 45, 'SHY': 25, 'IEF': 0, 'GLD': 0 }
  });

  const handleTickerToggle = (ticker) => {
    if (selectedTickers.includes(ticker)) {
      if (selectedTickers.length > 2) {
        setSelectedTickers(selectedTickers.filter(t => t !== ticker));
      }
    } else {
      setSelectedTickers([...selectedTickers, ticker]);
    }
  };

  const handleWeightChange = (regime, asset, val) => {
    const numericVal = parseInt(val) || 0;
    const clampedVal = Math.min(Math.max(numericVal, 0), 100);
    
    setAllocationMap({
      ...allocationMap,
      [regime]: {
        ...allocationMap[regime],
        [asset]: clampedVal
      }
    });
  };

  // Calculate row sums (must equal 100%)
  const getRowSum = (regime) => {
    return selectedTickers.reduce((sum, ticker) => sum + (allocationMap[regime][ticker] || 0), 0);
  };

  const isConfigValid = () => {
    // 1. Row sums must equal 100% for the active tickers
    const allRegimesSum100 = Object.keys(allocationMap).every(regime => getRowSum(regime) === 100);
    
    // 2. Date checks
    const datesOk = startDate && endDate && (new Date(startDate) < new Date(endDate));
    
    return allRegimesSum100 && datesOk;
  };

  const handleRunSubmit = () => {
    if (!isConfigValid()) return;
    
    // Convert weights back to decimal format [0.0 - 1.0] for backend API
    const formattedMap = {};
    Object.entries(allocationMap).forEach(([regime, weights]) => {
      formattedMap[regime] = {};
      selectedTickers.forEach(asset => {
        formattedMap[regime][asset] = (weights[asset] || 0) / 100;
      });
    });

    onRunBacktest({
      start_date: startDate,
      end_date: endDate,
      n_regimes: parseInt(nRegimes),
      tickers: selectedTickers,
      regime_map: formattedMap
    });
  };

  if (!isOpen) return null;

  return (
    <div className="glass-panel animate-fade-in" style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 440, zIndex: 100,
      background: 'rgba(10, 11, 13, 0.95)', borderLeft: '1px solid var(--border-glass)',
      display: 'flex', flexDirection: 'column', height: '100vh', boxShadow: '-10px 0 40px rgba(0,0,0,0.5)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottom: '1px solid var(--border-glass)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sliders size={20} color="var(--color-accent)" />
          <h3 style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 700 }}>Allocation Sandbox</h3>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <X size={20} />
        </button>
      </div>

      {/* Settings Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Date Ranges */}
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6', marginBottom: 12 }}>Time Horizon</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.6875rem', color: '#9ca3af', display: 'block', marginBottom: 4 }}>START DATE</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'white', fontFamily: 'Inter', fontSize: '0.8125rem' }} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.6875rem', color: '#9ca3af', display: 'block', marginBottom: 4 }}>END DATE</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'white', fontFamily: 'Inter', fontSize: '0.8125rem' }} 
              />
            </div>
          </div>
        </div>

        {/* Model State Count */}
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6', marginBottom: 12 }}>Model States</h4>
          <div>
            <label style={{ fontSize: '0.6875rem', color: '#9ca3af', display: 'block', marginBottom: 4 }}>HMM COMPONENTS (K)</label>
            <select
              value={nRegimes}
              onChange={(e) => setNRegimes(parseInt(e.target.value))}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'white', fontFamily: 'Inter', fontSize: '0.8125rem' }}
            >
              <option value={2} style={{ backgroundColor: '#111827' }}>2 States</option>
              <option value={3} style={{ backgroundColor: '#111827' }}>3 States</option>
              <option value={4} style={{ backgroundColor: '#111827' }}>4 States (Full Quadrant Labeling)</option>
              <option value={5} style={{ backgroundColor: '#111827' }}>5 States</option>
              <option value={6} style={{ backgroundColor: '#111827' }}>6 States</option>
            </select>
          </div>
        </div>

        {/* Universe Tickers Selection */}
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6', marginBottom: 12 }}>Asset Universe</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_TICKERS.map(ticker => {
              const active = selectedTickers.includes(ticker);
              return (
                <button
                  key={ticker}
                  onClick={() => handleTickerToggle(ticker)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, border: '1px solid',
                    borderColor: active ? 'var(--color-accent)' : 'var(--border-glass)',
                    background: active ? 'var(--color-accent-dim)' : 'transparent',
                    color: active ? '#f3f4f6' : '#9ca3af',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s ease'
                  }}
                >
                  {active && <Check size={10} />}
                  {ticker}
                </button>
              );
            })}
          </div>
        </div>

        {/* Weights Matrix Grid */}
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f3f4f6', marginBottom: 4 }}>Regime Allocations</h4>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 12 }}>Define the target portfolio weight (%) for each regime.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.keys(allocationMap).map(regime => {
              const sum = getRowSum(regime);
              const sumOk = sum === 100;
              
              return (
                <div key={regime} className="glass-panel" style={{ padding: 12, borderColor: sumOk ? 'var(--border-glass)' : 'rgba(239, 68, 68, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                      {regime.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: sumOk ? '#10b981' : '#ef4444' }}>
                      Sum: {sum}%
                    </span>
                  </div>
                  
                  {/* Grid Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {selectedTickers.map(asset => (
                      <div key={asset} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: '0.625rem', color: '#9ca3af', fontWeight: 500 }}>{asset}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={allocationMap[regime][asset] || 0}
                          onChange={(e) => handleWeightChange(regime, asset, e.target.value)}
                          style={{
                            width: '100%', padding: '6px', background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--border-glass)', borderRadius: 6,
                            color: 'white', fontSize: '0.75rem', fontFamily: 'Inter',
                            textAlign: 'center'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Footer Run Button */}
      <div style={{ padding: 24, borderTop: '1px solid var(--border-glass)', background: 'rgba(10,11,13,0.99)' }}>
        {!isConfigValid() && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: '0.75rem', marginBottom: 12 }}>
            <Info size={12} />
            <span>Ensure all regime weights sum exactly to 100%.</span>
          </div>
        )}
        <button
          onClick={handleRunSubmit}
          disabled={!isConfigValid() || isRunning}
          className="btn btn-primary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14 }}
        >
          <Play size={14} fill="white" />
          {isRunning ? 'Fitting Models...' : 'Run Dynamic Backtest'}
        </button>
      </div>
    </div>
  );
}
