import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BarChart3, LineChart, Cpu, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';

const DashboardView = lazy(() => import('./components/DashboardView'));
const BacktestView = lazy(() => import('./components/BacktestView'));
const ModelView = lazy(() => import('./components/ModelView'));


function StratosLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Recession: Blue bottom curve */}
      <path d="M15 78C30 63 70 63 85 78" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" opacity="0.8" />
      {/* Stagflation: Rose lower-middle curve */}
      <path d="M23 58C35 45 65 45 77 58" stroke="#f43f5e" strokeWidth="8" strokeLinecap="round" opacity="0.9" />
      {/* Disinflationary Growth: Emerald upper-middle curve */}
      <path d="M31 38C40 27 60 27 69 38" stroke="#10b981" strokeWidth="8" strokeLinecap="round" opacity="0.95" />
      {/* Inflationary Expansion: Gold top peak/arrow */}
      <path d="M42 18C46 14 54 14 58 18" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
      {/* Central diamond core representing stability */}
      <polygon points="50,34 56,44 50,54 44,44" fill="url(#core-gradient)" />
      <defs>
        <linearGradient id="core-gradient" x1="44" y1="34" x2="56" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState(null);
  const [currentRegime, setCurrentRegime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [hasRun, setHasRun] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState([]);

  const logContainerRef = useRef(null);

  const fetchCoreData = async () => {
    try {
      setError(null);
      const [statusRes, regimeRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/regime/current')
      ]);
      
      if (!statusRes.ok || !regimeRes.ok) {
        throw new Error('API server is unreachable or returned an error.');
      }
      
      const statusData = await statusRes.json();
      const regimeData = await regimeRes.json();
      
      setStatus(statusData);
      setCurrentRegime(regimeData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoreData();
  }, []);

  // Auto-scroll logs to bottom as they arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [pipelineLogs]);

  const startStatusPolling = () => {
    setRefreshing(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          setPipelineLogs(data.logs || []);
          
          if (data.latest_error) {
            clearInterval(interval);
            setError(data.latest_error);
            setRefreshing(false);
            return;
          }
          
          if (!data.is_running) {
            clearInterval(interval);
            // Polling complete: reload all data
            await fetchCoreData();
            setHasRun(true);
            setReloadCount(prev => prev + 1);
            setRefreshing(false);
          }
        } else {
          clearInterval(interval);
          setRefreshing(false);
          const errData = await res.json().catch(() => ({}));
          setError(errData.detail || `Server status check failed (HTTP ${res.status}).`);
        }
      } catch (err) {
        clearInterval(interval);
        setRefreshing(false);
        setError("Error polling backend engine status.");
      }
    }, 1000); // Poll slightly faster (1s) to make logs feel real-time
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    setPipelineLogs([]);
    try {
      const response = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_mock: false })
      });
      if (response.ok) {
        startStatusPolling();
      } else {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to trigger model retraining.");
      }
    } catch (err) {
      setRefreshing(false);
      setError(err.message);
    }
  };

  const handleRunDynamicBacktest = async (config) => {
    setRefreshing(true);
    setError(null);
    setPipelineLogs([]);
    try {
      const response = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          force_mock: false
        })
      });
      
      if (response.ok) {
        startStatusPolling();
      } else {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to trigger backtest simulation.");
      }
    } catch (err) {
      setRefreshing(false);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw',
        alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0b0d'
      }}>
        <RefreshCw size={48} className="animate-spin" style={{ color: '#6366f1', animation: 'spin 1.5s linear infinite' }} />
        <p style={{ marginTop: 16, color: '#9ca3af', fontSize: '0.875rem', fontFamily: 'Outfit' }}>
          Initializing Macro Engine...
        </p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <StratosLogo size={36} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', color: '#f3f4f6', fontFamily: 'Outfit', fontWeight: 800, letterSpacing: '0.04em', margin: 0 }}>
              STRATOS
            </h1>
            <p style={{ fontSize: '0.625rem', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.08em', margin: 0, marginTop: 2 }}>
              MACRO ALLOCATION SUITE
            </p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <a
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <BarChart3 size={18} />
            Dashboard
          </a>
          <a
            className={`nav-link ${activeTab === 'backtest' ? 'active' : ''}`}
            onClick={() => setActiveTab('backtest')}
          >
            <LineChart size={18} />
            Backtest
          </a>
          <a
            className={`nav-link ${activeTab === 'model' ? 'active' : ''}`}
            onClick={() => setActiveTab('model')}
          >
            <Cpu size={18} />
            Model Diagnostics
          </a>
        </nav>

        {/* Engine Status Block */}
        <div className="glass-panel" style={{ padding: 16, fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#10b981' }}>
            <ShieldCheck size={14} />
            <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Engine Active</span>
          </div>
          <p style={{ color: '#9ca3af', marginBottom: 4 }}>
            As-of: <span style={{ color: '#f3f4f6', fontWeight: 500 }}>{status?.as_of_date || 'N/A'}</span>
          </p>
          <p style={{ color: '#9ca3af', marginBottom: 12 }}>
            Data: <span style={{ color: '#f3f4f6', fontWeight: 500 }}>{status?.is_mock_data ? 'Simulated' : 'FRED API'}</span>
          </p>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.75rem', padding: '8px 12px' }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} style={{ animation: refreshing ? 'spin 1.5s linear infinite' : 'none' }} />
            {refreshing ? 'Refitting HMM...' : 'Retrain Pipeline'}
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="main-content">
        {error && (
          <div className="glass-panel" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 16,
            borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', marginBottom: 24,
            animation: 'fadeInUp 0.3s ease'
          }}>
            <AlertCircle color="#ef4444" size={20} />
            <div style={{ flex: 1 }}>
              <h4 style={{ color: '#f3f4f6', fontSize: '0.875rem', fontWeight: 600 }}>Engine Error</h4>
              <pre style={{
                color: '#ef4444', fontSize: '0.75rem', marginTop: 6,
                background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 6,
                overflowX: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap'
              }}>{error}</pre>
            </div>
            <button onClick={fetchCoreData} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
              Retry Connect
            </button>
          </div>
        )}

        <div className="animate-fade-in">
          <Suspense fallback={<div style={{ display: 'flex', height: 400, alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Loading section details...</div>}>
            {activeTab === 'dashboard' && (
              <DashboardView 
                currentRegime={currentRegime} 
                onRunBacktest={handleRunDynamicBacktest} 
                isRunning={refreshing} 
                hasRun={hasRun}
                reloadCount={reloadCount}
              />
            )}
            {activeTab === 'backtest' && (
              <BacktestView 
                hasRun={hasRun} 
                reloadCount={reloadCount}
              />
            )}
            {activeTab === 'model' && (
              <ModelView 
                hasRun={hasRun} 
                reloadCount={reloadCount}
              />
            )}
          </Suspense>
        </div>
      </main>

      {/* Dynamic Loader Overlay with Monospace Terminal Logs */}
      {refreshing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(10, 11, 13, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 20, maxWidth: 640, width: '90%', textAlign: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--color-accent)', animation: 'spin 1.5s linear infinite' }} />
              <h4 style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 700, margin: 0 }}>
                Running TAA Backtest Simulation
              </h4>
            </div>
            
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              Ingesting FRED/Yahoo Finance macro features, fitting HMM out-of-sample, and evaluating portfolio performance...
            </p>
            
            {/* Monospace Log Viewer */}
            <div 
              ref={logContainerRef}
              style={{
                width: '100%', height: 200, background: 'rgba(0,0,0,0.5)',
                border: '1px solid var(--border-glass)', borderRadius: 8,
                padding: 12, textAlign: 'left', overflowY: 'auto',
                fontFamily: 'monospace', fontSize: '0.725rem',
                display: 'flex', flexDirection: 'column', gap: 6,
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)'
              }}
            >
              {pipelineLogs.length === 0 ? (
                <div style={{ color: '#6b7280', fontStyle: 'italic' }}>Initializing background thread...</div>
              ) : (
                pipelineLogs.map((log, i) => (
                  <div key={i} style={{
                    color: log.includes('ERROR') || log.includes('Failed') || log.includes('failed') ? '#ef4444' :
                           log.includes('SUCCESS') || log.includes('successfully') ? '#10b981' :
                           log.includes('[FRED API]') ? '#3b82f6' :
                           log.includes('[Yahoo Finance]') ? '#eab308' : '#e5e7eb'
                  }}>
                    <span style={{ color: '#4b5563', marginRight: 8 }}>&gt;</span>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Styles for spinners */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
