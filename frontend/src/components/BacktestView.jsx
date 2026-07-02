import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, AlertCircle, ArrowDownRight, RefreshCw, BarChart2 } from 'lucide-react';

export default function BacktestView({ hasRun, reloadCount }) {
  const [backtest, setBacktest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartMode, setChartMode] = useState('returns'); // 'returns' or 'drawdowns'

  if (!hasRun) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', color: '#f3f4f6', fontFamily: 'Outfit', fontWeight: 700 }}>
            Out-of-Sample Backtest Performance
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: 4 }}>
            Transaction-cost adjusted backtest metrics compared side-by-side with passive and active industry benchmarks.
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
            <BarChart2 size={36} color="var(--color-accent)" />
          </div>
          <h4 style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 700, marginBottom: 8, color: '#f3f4f6' }}>
            Backtest Results Locked
          </h4>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', maxWidth: 460, marginBottom: 0, lineHeight: 1.5 }}>
            No simulation has been run yet. Please go to the Dashboard tab, adjust your settings in the TAA Sandbox Configuration, and click 'Run Dynamic Backtest' to generate performance curves.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const fetchBacktest = async () => {
      try {
        const response = await fetch('/api/backtest');
        if (!response.ok) {
          throw new Error('Failed to load backtest metrics.');
        }
        const data = await response.json();
        setBacktest(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBacktest();
  }, [reloadCount]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: 400, alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        <RefreshCw size={24} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite', marginRight: 12 }} />
        Compiling out-of-sample backtest...
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 24, borderColor: '#ef4444' }}>
        <AlertCircle color="#ef4444" size={24} />
        <div>
          <h3 style={{ color: '#f3f4f6', fontWeight: 600 }}>Failed to load Backtest results</h3>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: 4 }}>{error}</p>
        </div>
      </div>
    );
  }

  // Compile returns data for chart
  const chartData = [];
  if (backtest && backtest.dates) {
    for (let i = 0; i < backtest.dates.length; i++) {
      chartData.push({
        date: backtest.dates[i].substring(0, 7), // YYYY-MM
        strategy: parseFloat(((backtest.cumulative_returns.strategy[i] + 1) * 100).toFixed(1)), // growth of 100 base
        SPY: parseFloat(((backtest.cumulative_returns.SPY[i] + 1) * 100).toFixed(1)),
        portfolio_6040: parseFloat(((backtest.cumulative_returns['60_40'][i] + 1) * 100).toFixed(1)),
        EqualWeight: parseFloat(((backtest.cumulative_returns.EqualWeight[i] + 1) * 100).toFixed(1)),
        strategy_dd: parseFloat((backtest.drawdowns.strategy[i] * 100).toFixed(2)),
        spy_dd: parseFloat((backtest.drawdowns.SPY[i] * 100).toFixed(2)),
      });
    }
  }

  const formatPercent = (val) => `${(val * 100).toFixed(2)}%`;
  const formatValuePercent = (val) => `${val.toFixed(2)}%`;

  // Colors mapping
  const METRIC_LABELS = {
    'CAGR': 'CAGR (Ann. Return)',
    'Volatility': 'Annualized Volatility',
    'Sharpe': 'Sharpe Ratio',
    'Sortino': 'Sortino Ratio',
    'MaxDrawdown': 'Maximum Drawdown',
    'Calmar': 'Calmar Ratio',
    'AvgTurnover': 'Monthly Avg. Turnover'
  };

  const formatMetricValue = (metric, val) => {
    if (['CAGR', 'Volatility', 'MaxDrawdown', 'AvgTurnover'].includes(metric)) {
      return `${(val * 100).toFixed(2)}%`;
    }
    return val.toFixed(2);
  };

  const getMetricRow = (metricKey) => {
    if (!backtest || !backtest.metrics) return null;
    const strategy = backtest.metrics.strategy[metricKey];
    const spy = backtest.metrics.SPY[metricKey];
    const portfolio_6040 = backtest.metrics['60_40'][metricKey];
    const ew = backtest.metrics.EqualWeight[metricKey];
    
    return (
      <tr key={metricKey} style={{ borderBottom: '1px solid var(--border-glass)' }}>
        <td style={{ padding: '14px 16px', color: '#9ca3af', fontSize: '0.875rem', fontWeight: 500 }}>
          {METRIC_LABELS[metricKey] || metricKey}
        </td>
        <td style={{ padding: '14px 16px', color: '#6366f1', fontWeight: 600 }}>
          {formatMetricValue(metricKey, strategy)}
        </td>
        <td style={{ padding: '14px 16px', color: '#f3f4f6' }}>
          {formatMetricValue(metricKey, spy)}
        </td>
        <td style={{ padding: '14px 16px', color: '#f3f4f6' }}>
          {formatMetricValue(metricKey, portfolio_6040)}
        </td>
        <td style={{ padding: '14px 16px', color: '#f3f4f6' }}>
          {formatMetricValue(metricKey, ew)}
        </td>
      </tr>
    );
  };

  const metricKeys = ['CAGR', 'Volatility', 'Sharpe', 'Sortino', 'MaxDrawdown', 'Calmar', 'AvgTurnover'];

  // Current stats for quick header metrics
  const stratMetrics = backtest?.metrics?.strategy || {};
  const spyMetrics = backtest?.metrics?.SPY || {};

  return (
    <div>
      {/* Top Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1.75rem', color: '#f3f4f6', fontFamily: 'Outfit', fontWeight: 700 }}>
          OOS Backtest Performance
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: 4 }}>
          Out-of-sample walk-forward performance, transaction-cost adjusted, compared side-by-side with industry benchmarks.
        </p>
      </div>

      {/* Quick Cards */}
      <div className="metrics-grid">
        <div className="glass-panel metric-card" style={{ borderTop: '4px solid #6366f1' }}>
          <div style={{ display: 'flex', justifyContext: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="metric-label">Strategy CAGR</span>
            <TrendingUp size={16} color="#6366f1" />
          </div>
          <span className="metric-value" style={{ color: '#6366f1' }}>
            {(stratMetrics.CAGR * 100).toFixed(2)}%
          </span>
          <span className="metric-subtext">Passive SPY: {(spyMetrics.CAGR * 100).toFixed(2)}%</span>
        </div>

        <div className="glass-panel metric-card" style={{ borderTop: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContext: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="metric-label">Strategy Sharpe</span>
            <BarChart2 size={16} color="#10b981" />
          </div>
          <span className="metric-value">
            {stratMetrics.Sharpe?.toFixed(2)}
          </span>
          <span className="metric-subtext">Passive SPY: {spyMetrics.Sharpe?.toFixed(2)}</span>
        </div>

        <div className="glass-panel metric-card" style={{ borderTop: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContext: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="metric-label">Max Drawdown</span>
            <ArrowDownRight size={16} color="#ef4444" />
          </div>
          <span className="metric-value" style={{ color: '#ef4444' }}>
            {(stratMetrics.MaxDrawdown * 100).toFixed(2)}%
          </span>
          <span className="metric-subtext">Passive SPY: {(spyMetrics.MaxDrawdown * 100).toFixed(2)}%</span>
        </div>
      </div>

      {/* Chart Panel */}
      <div className="glass-panel chart-container" style={{ marginBottom: 32 }}>
        <div className="chart-header">
          <div>
            <h3 className="chart-title">{chartMode === 'returns' ? 'Growth of $100' : 'Underwater Drawdown Plot'}</h3>
            <p className="chart-subtitle">{chartMode === 'returns' ? 'Out-of-sample cumulative growth curve' : 'Historical peak-to-trough decline curves'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => setChartMode('returns')} 
              className={`btn ${chartMode === 'returns' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
            >
              Cumulative Growth
            </button>
            <button 
              onClick={() => setChartMode('drawdowns')} 
              className={`btn ${chartMode === 'drawdowns' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
            >
              Drawdown Curve
            </button>
          </div>
        </div>

        <div style={{ minHeight: 320, width: '100%' }}>
          {chartMode === 'returns' ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: 8, color: '#f3f4f6' }}
                  labelStyle={{ fontWeight: 600, color: '#f3f4f6', marginBottom: 4 }}
                />
                <Line type="monotone" dataKey="strategy" stroke="#6366f1" strokeWidth={2.5} dot={false} name="Regime Overlay" />
                <Line type="monotone" dataKey="SPY" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Buy & Hold SPY" />
                <Line type="monotone" dataKey="portfolio_6040" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="60/40 Benchmark" />
                <Line type="monotone" dataKey="EqualWeight" stroke="#10b981" strokeWidth={1.5} dot={false} name="Equal Weight" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: 8, color: '#f3f4f6' }}
                  labelStyle={{ fontWeight: 600, color: '#f3f4f6', marginBottom: 4 }}
                  formatter={(value) => [`${value}%`]}
                />
                <Area type="monotone" dataKey="strategy_dd" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Strategy Drawdown" />
                <Area type="monotone" dataKey="spy_dd" stroke="#6b7280" fill="transparent" strokeDasharray="3 3" name="SPY Drawdown" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Metrics Table */}
      <div className="glass-panel" style={{ padding: 24, overflowX: 'auto' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 16, color: '#f3f4f6' }}>
          Comparative Risk-Return Profiles
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)', color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 16px' }}>Metric</th>
              <th style={{ padding: '12px 16px', color: '#6366f1' }}>Regime Strategy</th>
              <th style={{ padding: '12px 16px' }}>Buy & Hold SPY</th>
              <th style={{ padding: '12px 16px' }}>60/40 Portfolio</th>
              <th style={{ padding: '12px 16px' }}>Equal Weight</th>
            </tr>
          </thead>
          <tbody>
            {metricKeys.map(getMetricRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
