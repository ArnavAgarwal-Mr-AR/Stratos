import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Calendar, Percent, Clock, AlertTriangle, Sliders, Play, Check, Info } from 'lucide-react';

function RunPlaceholder({ title, description }) {
  return (
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
        <Sliders size={36} color="var(--color-accent)" />
      </div>
      <h4 style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 700, marginBottom: 8, color: '#f3f4f6' }}>
        {title}
      </h4>
      <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: 460, marginBottom: 0, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  );
}

export default function DashboardView({ currentRegime, onRunBacktest, isRunning, hasRun, reloadCount }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeSliceIndex, setActiveSliceIndex] = useState(-1);

  // Sandbox inputs state
  const [startDate, setStartDate] = useState('1990-01-01');
  const [endDate, setEndDate] = useState('2026-06-01');
  const [nRegimes, setNRegimes] = useState(4);
  
  const ALL_TICKERS = ['SPY', 'TLT', 'IEF', 'TIP', 'GLD', 'DBC', 'SHY'];
  const [selectedTickers, setSelectedTickers] = useState([...ALL_TICKERS]);

  // Target allocations state
  const [allocationMap, setAllocationMap] = useState({
    'inflationary_expansion': { 'SPY': 45, 'DBC': 20, 'TIP': 15, 'TLT': 10, 'SHY': 10, 'IEF': 0, 'GLD': 0 },
    'disinflationary_expansion': { 'SPY': 60, 'DBC': 5, 'TIP': 5, 'TLT': 20, 'SHY': 10, 'IEF': 0, 'GLD': 0 },
    'stagflation': { 'SPY': 20, 'DBC': 25, 'TIP': 20, 'TLT': 10, 'SHY': 25, 'IEF': 0, 'GLD': 0 },
    'recession': { 'SPY': 15, 'DBC': 5, 'TIP': 10, 'TLT': 45, 'SHY': 25, 'IEF': 0, 'GLD': 0 }
  });

  // Dynamically update allocation keys when nRegimes changes
  useEffect(() => {
    if (nRegimes === 4) {
      setAllocationMap({
        'inflationary_expansion': { 'SPY': 45, 'DBC': 20, 'TIP': 15, 'TLT': 10, 'SHY': 10, 'IEF': 0, 'GLD': 0 },
        'disinflationary_expansion': { 'SPY': 60, 'DBC': 5, 'TIP': 5, 'TLT': 20, 'SHY': 10, 'IEF': 0, 'GLD': 0 },
        'stagflation': { 'SPY': 20, 'DBC': 25, 'TIP': 20, 'TLT': 10, 'SHY': 25, 'IEF': 0, 'GLD': 0 },
        'recession': { 'SPY': 15, 'DBC': 5, 'TIP': 10, 'TLT': 45, 'SHY': 25, 'IEF': 0, 'GLD': 0 }
      });
    } else {
      const tempMap = {};
      for (let i = 0; i < nRegimes; i++) {
        const stateKey = `state_${i}`;
        const equalWeight = Math.floor(100 / selectedTickers.length);
        const stateWeights = {};
        ALL_TICKERS.forEach((ticker, idx) => {
          if (selectedTickers.includes(ticker)) {
            if (idx === ALL_TICKERS.indexOf(selectedTickers[0])) {
              stateWeights[ticker] = 100 - (equalWeight * (selectedTickers.length - 1));
            } else {
              stateWeights[ticker] = equalWeight;
            }
          } else {
            stateWeights[ticker] = 0;
          }
        });
        tempMap[stateKey] = stateWeights;
      }
      setAllocationMap(tempMap);
    }
  }, [nRegimes]);

  // Fetch history data on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/regime/history');
        if (!response.ok) {
          throw new Error('Failed to load historical regime data.');
        }
        const data = await response.json();
        setHistory(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [reloadCount]);

  if (!currentRegime) return null;

  // Format allocation data for PieChart
  const allocationData = Object.entries(currentRegime.target_allocation || {}).map(([asset, weight]) => ({
    name: asset,
    value: parseFloat((weight * 100).toFixed(1))
  })).filter(item => item.value > 0);

  // Colors for asset classes
  const ASSET_COLORS = {
    'SPY': '#818cf8',  // Neon Indigo
    'TLT': '#38bdf8',  // Neon Blue
    'IEF': '#2dd4bf',  // Neon Teal
    'TIP': '#34d399',  // Neon Emerald
    'GLD': '#fbbf24',  // Neon Amber/Gold
    'DBC': '#f97316',  // Neon Orange
    'SHY': '#9ca3af'   // Silver/Slate
  };

  // Colors for regimes
  const REGIME_COLORS = {
    'inflationary_expansion': '#f59e0b',
    'disinflationary_expansion': '#10b981',
    'stagflation': '#f43f5e',
    'recession': '#3b82f6'
  };

  // Human readable regime names
  const REGIME_NAMES = {
    'inflationary_expansion': 'Inflationary Expansion',
    'disinflationary_expansion': 'Disinflationary Expansion',
    'stagflation': 'Stagflation',
    'recession': 'Recession'
  };

  const regimeKey = currentRegime.current_regime;
  const regimeName = REGIME_NAMES[regimeKey] || regimeKey.replace(/_/g, ' ').toUpperCase();
  const regimeColor = REGIME_COLORS[regimeKey] || '#6b7280';

  const regimeKeys = history && history.probabilities ? Object.keys(history.probabilities) : [];

  const getDynamicColor = (index, total) => {
    const hue = (index * (360 / Math.max(total, 1))) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Process history data for AreaChart
  const chartData = [];
  if (history && history.dates) {
    for (let i = 0; i < history.dates.length; i++) {
      const row = { date: history.dates[i].substring(0, 7) };
      Object.entries(history.probabilities).forEach(([regime, list]) => {
        row[regime] = list[i];
      });
      chartData.push(row);
    }
  }

  const handleTickerToggle = (ticker) => {
    if (selectedTickers.includes(ticker)) {
      if (selectedTickers.length > 2) {
        const nextTickers = selectedTickers.filter(t => t !== ticker);
        setSelectedTickers(nextTickers);
        const nextAllocMap = {};
        Object.entries(allocationMap).forEach(([regime, weights]) => {
          nextAllocMap[regime] = { ...weights, [ticker]: 0 };
        });
        setAllocationMap(nextAllocMap);
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

  const getRowSum = (regime) => {
    return selectedTickers.reduce((sum, ticker) => sum + (allocationMap[regime][ticker] || 0), 0);
  };

  const isConfigValid = () => {
    const allRegimesSum100 = Object.keys(allocationMap).every(regime => getRowSum(regime) === 100);
    const datesOk = startDate && endDate && (new Date(startDate) < new Date(endDate));
    return allRegimesSum100 && datesOk;
  };

  const handleRunSubmit = () => {
    if (!isConfigValid()) return;
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

  const getRegimeBorderClass = (key) => {
    if (key === 'inflationary_expansion') return 'indicator-inf-exp';
    if (key === 'disinflationary_expansion') return 'indicator-disinf-exp';
    if (key === 'stagflation') return 'indicator-stagflation';
    if (key === 'recession') return 'indicator-recession';
    return '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.75rem', color: '#f3f4f6', fontFamily: 'Outfit', fontWeight: 700 }}>
          Stratos Macro Allocation Suite
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: 4 }}>
          Configure model parameters first, then run the simulation to analyze historical states and dynamically blended targets.
        </p>
      </div>

      {/* 1. TAA SANDBOX CARD */}
      <div className="glass-panel" style={{ padding: 24, borderTop: '4px solid var(--color-accent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Sliders size={20} color="var(--color-accent)" />
          <h3 style={{ fontSize: '1.125rem', fontFamily: 'Outfit', fontWeight: 700 }}>TAA Sandbox Configuration</h3>
        </div>

        <div className="sandbox-grid">
          
          {/* Col 1: Horizon & States */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: '0.6875rem', color: '#9ca3af', display: 'block', marginBottom: 6, fontWeight: 600 }}>TIME HORIZON</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input 
                  id="sandbox-start-date"
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'white', fontFamily: 'Inter', fontSize: '0.75rem' }} 
                />
                <input 
                  id="sandbox-end-date"
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'white', fontFamily: 'Inter', fontSize: '0.75rem' }} 
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.6875rem', color: '#9ca3af', display: 'block', marginBottom: 6, fontWeight: 600 }}>MODEL COMPONENTS (K)</label>
              <select
                id="sandbox-num-regimes"
                value={nRegimes}
                onChange={(e) => setNRegimes(parseInt(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'white', fontFamily: 'Inter', fontSize: '0.75rem' }}
              >
                <option value={2} style={{ backgroundColor: '#111827' }}>2 States</option>
                <option value={3} style={{ backgroundColor: '#111827' }}>3 States</option>
                <option value={4} style={{ backgroundColor: '#111827' }}>4 States (Full Quadrant Labeling)</option>
                <option value={5} style={{ backgroundColor: '#111827' }}>5 States</option>
                <option value={6} style={{ backgroundColor: '#111827' }}>6 States</option>
              </select>
            </div>
          </div>

          {/* Col 2: Asset Universe */}
          <div>
            <label style={{ fontSize: '0.6875rem', color: '#9ca3af', display: 'block', marginBottom: 8, fontWeight: 600 }}>ASSET UNIVERSE</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ALL_TICKERS.map(ticker => {
                const active = selectedTickers.includes(ticker);
                return (
                  <button
                    id={`sandbox-ticker-btn-${ticker}`}
                    key={ticker}
                    onClick={() => handleTickerToggle(ticker)}
                    style={{
                      width: '100%', padding: '6px 12px', borderRadius: 8, border: '1px solid',
                      borderColor: active ? 'var(--color-accent)' : 'var(--border-glass)',
                      background: active ? 'var(--color-accent-dim)' : 'transparent',
                      color: active ? '#f3f4f6' : '#9ca3af',
                      fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s ease',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{ticker}</span>
                    {active && <Check size={12} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Col 3: Allocations Grid */}
          <div>
            <label style={{ fontSize: '0.6875rem', color: '#9ca3af', display: 'block', marginBottom: 8, fontWeight: 600 }}>PORTFOLIO ALLOCATION TARGETS (%)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 6 }}>
              {Object.keys(allocationMap).map(regime => {
                const sum = getRowSum(regime);
                const sumOk = sum === 100;
                return (
                  <div key={regime} style={{ padding: 10, background: 'rgba(255,255,255,0.01)', border: '1px solid', borderColor: sumOk ? 'var(--border-glass)' : 'rgba(239, 68, 68, 0.4)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                        {regime.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: sumOk ? '#10b981' : '#ef4444' }}>
                        Sum: {sum}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {selectedTickers.map(asset => (
                        <div key={asset} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600 }}>{asset}:</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={allocationMap[regime][asset] || 0}
                            onChange={(e) => handleWeightChange(regime, asset, e.target.value)}
                            style={{
                              width: '45px', padding: '4px', background: 'rgba(0,0,0,0.3)',
                              border: '1px solid var(--border-glass)', borderRadius: 6,
                              color: 'white', fontSize: '0.7rem', fontFamily: 'Inter',
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

        {/* Action Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isConfigValid() ? '#10b981' : '#ef4444', fontSize: '0.75rem' }}>
            <Info size={14} />
            <span>{isConfigValid() ? 'Configuration is valid.' : 'Adjust weights so each active row sums exactly to 100%.'}</span>
          </div>
          <button
            onClick={handleRunSubmit}
            disabled={!isConfigValid() || isRunning}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}
          >
            <Play size={12} fill="white" />
            {isRunning ? 'Fitting Models...' : 'Run Dynamic Backtest'}
          </button>
        </div>
      </div>

      {/* 2. RESULTS DIVISION */}
      {!hasRun ? (
        <RunPlaceholder 
          title="Sandbox Simulation Ready" 
          description="Adjust the time horizon, select active asset tickers, and customize your regime weights above. Click 'Run Dynamic Backtest' to train the HMM engine and generate historical state probabilities and blended targets."
        />
      ) : (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Section Header */}
          <h3 style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 700, borderBottom: '1px solid var(--border-glass)', paddingBottom: 8 }}>
            Simulation Outputs
          </h3>

          {/* Snapshot Cards */}
          <div className="metrics-grid">
            <div className={`glass-panel metric-card ${getRegimeBorderClass(regimeKey)}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="metric-label">Current Macro Regime</span>
                <Calendar size={16} color={regimeColor} />
              </div>
              <span className="metric-value" style={{ color: regimeColor, fontSize: '1.75rem' }}>
                {regimeName}
              </span>
              <span className="metric-subtext">Classified via Gaussian emission features</span>
            </div>

            <div className="glass-panel metric-card" style={{ borderTop: '4px solid var(--color-accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="metric-label">Model Confidence</span>
                <Percent size={16} color="var(--color-accent)" />
              </div>
              <span className="metric-value">
                {(currentRegime.probability * 100).toFixed(1)}%
              </span>
              <span className="metric-subtext">Smoothed posterior probability vector</span>
            </div>

            <div className="glass-panel metric-card" style={{ borderTop: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="metric-label">Regime Duration</span>
                <Clock size={16} color="#10b981" />
              </div>
              <span className="metric-value">
                {currentRegime.consecutive_months} <span style={{ fontSize: '1.25rem', fontWeight: 500, color: '#9ca3af' }}>Months</span>
              </span>
              <span className="metric-subtext">Consecutive periods in active state (fits Sandbox end date)</span>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="dashboard-charts-grid">
            
            {/* Regime Probabilities Area Chart */}
            <div className="glass-panel chart-container" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="chart-header">
                <div>
                  <h3 className="chart-title">Historical State Probabilities</h3>
                  <p className="chart-subtitle">Smoothed regime membership estimates over time (100% stacked area)</p>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 300, width: '100%' }}>
                {loading ? (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                    Loading probabilities...
                  </div>
                ) : error ? (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#ef4444', gap: 8 }}>
                    <AlertTriangle size={16} />
                    Failed to load history
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: 8, color: '#f3f4f6' }}
                        labelStyle={{ fontWeight: 600, color: '#f3f4f6', marginBottom: 4 }}
                        formatter={(v) => [`${(v * 100).toFixed(1)}%`]}
                      />
                      <Legend 
                        verticalAlign="top" 
                        height={36} 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'Inter', paddingBottom: 12 }} 
                      />
                      {regimeKeys.map((key, index) => {
                        const color = REGIME_COLORS[key] || getDynamicColor(index, regimeKeys.length);
                        const displayName = REGIME_NAMES[key] || key.replace(/_/g, ' ').toUpperCase();
                        return (
                          <Area 
                            key={key} 
                            type="monotone" 
                            dataKey={key} 
                            stackId="1" 
                            stroke={color} 
                            fill={color} 
                            fillOpacity={0.55} 
                            name={displayName} 
                          />
                        );
                      })}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Current Allocation Doughnut Chart */}
            <div className="glass-panel chart-container" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="chart-header">
                <div>
                  <h3 className="chart-title">Recommended Weights</h3>
                  <p className="chart-subtitle">Regime-conditional blended targets</p>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                {/* Relative Wrapper for Doughnut Chart + Centered active label */}
                <div style={{ position: 'relative', width: '100%', height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        onMouseEnter={(data, index) => setActiveSliceIndex(index)}
                        onMouseLeave={() => setActiveSliceIndex(-1)}
                      >
                        {allocationData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={ASSET_COLORS[entry.name] || '#6b7280'} 
                            opacity={activeSliceIndex === -1 || activeSliceIndex === index ? 1.0 : 0.35}
                            innerRadius={activeSliceIndex === index ? 52 : 55}
                            outerRadius={activeSliceIndex === index ? 78 : 75}
                            style={{ 
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Centered label inside doughnut hole */}
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', pointerEvents: 'none', width: '100%'
                  }}>
                    {activeSliceIndex !== -1 ? (
                      <>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          color: ASSET_COLORS[allocationData[activeSliceIndex].name], 
                          fontWeight: 700, 
                          fontFamily: 'Outfit',
                          letterSpacing: '0.04em'
                        }}>
                          {allocationData[activeSliceIndex].name}
                        </span>
                        <span style={{ 
                          fontSize: '1.25rem', 
                          color: '#f3f4f6', 
                          fontWeight: 800, 
                          fontFamily: 'monospace',
                          marginTop: 1 
                        }}>
                          {allocationData[activeSliceIndex].value}%
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.625rem', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          REGIME
                        </span>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          color: regimeColor, 
                          fontWeight: 700, 
                          marginTop: 2, 
                          maxWidth: 100,
                          lineHeight: 1.2,
                          textTransform: 'capitalize' 
                        }}>
                          {regimeName.replace(' Expansion', '')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Premium Aligned Custom Legend with Dashed Leader Lines */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', padding: '0 8px', marginTop: 16 }}>
                  {allocationData.map((item, index) => (
                    <div 
                      key={item.name} 
                      onMouseEnter={() => setActiveSliceIndex(index)}
                      onMouseLeave={() => setActiveSliceIndex(-1)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        fontSize: '0.75rem', 
                        width: '100%',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 6,
                        background: activeSliceIndex === index ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                        transition: 'background 0.2s ease'
                      }}
                    >
                      {/* Color Pill */}
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: ASSET_COLORS[item.name], marginRight: 10 }} />
                      
                      {/* Ticker Name */}
                      <span style={{ color: activeSliceIndex === index ? '#ffffff' : '#e5e7eb', fontWeight: 600, fontFamily: 'Outfit' }}>{item.name}</span>
                      
                      {/* Dashed Leader line */}
                      <div style={{ flex: 1, borderBottom: '1px dashed rgba(255,255,255,0.06)', margin: '0 10px', position: 'relative', top: -2 }} />
                      
                      {/* Percentage Value - Colormatched to asset */}
                      <span style={{ color: ASSET_COLORS[item.name], fontWeight: 700, fontFamily: 'monospace' }}>{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
