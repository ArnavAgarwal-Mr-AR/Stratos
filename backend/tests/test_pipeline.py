import pandas as pd
import numpy as np
import pytest
from backend.src.ingestion.mock_data import MockDataEngine
from backend.src.features.transforms import build_feature_panel
from backend.src.allocation.regime_allocator import blend_allocation
from backend.src.backtest.backtester import WalkForwardBacktester

def test_mock_data_and_features():
    engine = MockDataEngine(random_state=42)
    start_date = '2000-01-01'
    end_date = '2005-12-31'
    
    # Generate mock macro data
    macro_data = engine.generate_macro_data(start_date, end_date)
    assert 'CPIAUCSL' in macro_data.columns
    assert 'GDPC1' in macro_data.columns
    assert 'UNRATE' in macro_data.columns
    assert 'T10Y2Y' in macro_data.columns
    
    # Check that GDP has NaNs (simulating quarterly release)
    # 2/3rds of months should be NaN
    gdp_nans = macro_data['GDPC1'].isna().sum()
    assert gdp_nans > 0
    
    # Build feature panel
    features = build_feature_panel(macro_data, min_periods=12)
    
    # Columns check
    expected_cols = ['inflation_yoy', 'gdp_growth', 'unemployment_mom', 'curve_slope', 'curve_slope_chg']
    for col in expected_cols:
        assert col in features.columns
        
    # NaNs should have been dropped and Z-scored correctly
    assert features.isna().sum().sum() == 0
    assert len(features) < len(macro_data)  # due to Z-score warm-up and diffs

def test_regime_allocator_blending():
    regime_targets = {
        'inflationary_expansion': {'SPY': 0.40, 'TLT': 0.10, 'GLD': 0.50},
        'disinflationary_expansion': {'SPY': 0.60, 'TLT': 0.30, 'GLD': 0.10},
        'stagflation': {'SPY': 0.10, 'TLT': 0.10, 'GLD': 0.80},
        'recession': {'SPY': 0.10, 'TLT': 0.70, 'GLD': 0.20}
    }
    
    # 1. Single period (Series)
    probs_series = pd.Series({
        'inflationary_expansion': 0.50,
        'disinflationary_expansion': 0.50,
        'stagflation': 0.0,
        'recession': 0.0
    })
    
    blended_w = blend_allocation(probs_series, regime_targets)
    assert isinstance(blended_w, pd.Series)
    assert blended_w['SPY'] == pytest.approx(0.50 * 0.40 + 0.50 * 0.60) # 0.50
    assert blended_w['TLT'] == pytest.approx(0.50 * 0.10 + 0.50 * 0.30) # 0.20
    assert blended_w['GLD'] == pytest.approx(0.50 * 0.50 + 0.50 * 0.10) # 0.30
    
    # Sum should equal 1.0
    assert blended_w.sum() == pytest.approx(1.0)
    
    # 2. History panel (DataFrame)
    probs_df = pd.DataFrame([
        {'inflationary_expansion': 0.80, 'disinflationary_expansion': 0.20, 'stagflation': 0.0, 'recession': 0.0},
        {'inflationary_expansion': 0.0, 'disinflationary_expansion': 0.0, 'stagflation': 0.20, 'recession': 0.80}
    ], index=pd.to_datetime(['2026-01-31', '2026-02-28']))
    
    blended_df = blend_allocation(probs_df, regime_targets)
    assert isinstance(blended_df, pd.DataFrame)
    assert list(blended_df.columns) == ['SPY', 'TLT', 'GLD']
    assert len(blended_df) == 2
    
    # Row sums should equal 1.0
    np.testing.assert_allclose(blended_df.sum(axis=1), 1.0)

def test_backtester_end_to_end():
    engine = MockDataEngine(random_state=42)
    start_date = '2000-01-01'
    end_date = '2006-12-31'
    
    macro_data = engine.generate_macro_data(start_date, end_date)
    # yfinance client mock output returns
    asset_tickers = ['SPY', 'TLT', 'IEF', 'TIP', 'GLD', 'DBC', 'SHY']
    market_prices = engine.generate_market_data(asset_tickers, start_date, end_date)
    
    # Resample
    monthly_prices = market_prices.resample('ME').last()
    asset_returns = monthly_prices.pct_change().dropna()
    
    features = build_feature_panel(macro_data, min_periods=12)
    
    regime_targets = {
        'inflationary_expansion': {'SPY': 0.45, 'DBC': 0.20, 'TIP': 0.15, 'TLT': 0.10, 'SHY': 0.10},
        'disinflationary_expansion': {'SPY': 0.60, 'DBC': 0.05, 'TIP': 0.05, 'TLT': 0.20, 'SHY': 0.10},
        'stagflation': {'SPY': 0.20, 'DBC': 0.25, 'TIP': 0.20, 'TLT': 0.10, 'SHY': 0.25},
        'recession': {'SPY': 0.15, 'DBC': 0.05, 'TIP': 0.10, 'TLT': 0.45, 'SHY': 0.25}
    }
    
    backtester = WalkForwardBacktester(n_regimes=4, min_train_periods=12, fee_rate=0.0010)
    results = backtester.run(features, asset_returns, regime_targets)
    
    # Verify outputs
    assert 'dates' in results
    assert 'probabilities' in results
    assert 'states' in results
    assert 'allocations' in results
    assert 'returns' in results
    assert 'metrics' in results
    
    # Verify return shapes
    assert len(results['dates']) == len(results['returns'])
    assert 'strategy' in results['returns'].columns
    assert 'SPY' in results['returns'].columns
    
    # Verify metrics contain strategy and benchmarks
    assert 'strategy' in results['metrics']
    assert 'SPY' in results['metrics']
    assert '60_40' in results['metrics']
    assert 'EqualWeight' in results['metrics']
    
    # Values check
    for key, value in results['metrics']['strategy'].items():
        assert isinstance(value, float)

def test_pipeline_dynamic_overrides():
    from backend.src.pipeline import MacroRegimePipeline
    import tempfile
    
    with tempfile.TemporaryDirectory() as tmpdir:
        pipeline = MacroRegimePipeline(
            settings_path='backend/config/settings.yaml',
            regime_map_path='backend/config/regime_map.yaml',
            output_dir=tmpdir
        )
        
        # Define overrides
        start_date = '1995-01-01'
        end_date = '2015-12-31'
        n_regimes = 3
        tickers = ['SPY', 'TLT', 'SHY']
        regime_map = {
            'state_0': {'SPY': 0.8, 'TLT': 0.1, 'SHY': 0.1},
            'state_1': {'SPY': 0.1, 'TLT': 0.8, 'SHY': 0.1},
            'state_2': {'SPY': 0.1, 'TLT': 0.1, 'SHY': 0.8}
        }
        
        # Run with overrides
        results = pipeline.run(
            force_mock=True,
            start_date=start_date,
            end_date=end_date,
            n_regimes=n_regimes,
            tickers=tickers,
            regime_map=regime_map
        )
        
        # Verify overrides were respected
        assert results['snapshot']['is_mock_data'] is True
        assert set(results['snapshot']['target_allocation'].keys()) == set(tickers)
        assert len(results['regime_labels']) == n_regimes

