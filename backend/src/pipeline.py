import os
import json
import yaml
from pathlib import Path
from dotenv import load_dotenv
import pandas as pd
import numpy as np

# Load environment variables from .env or .env.local in backend directory
backend_dir = Path(__file__).resolve().parent.parent
for env_file in ['.env', '.env.local']:
    env_path = backend_dir / env_file
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)

from backend.src.ingestion.fred_client import FredClient
from backend.src.ingestion.market_client import MarketClient
from backend.src.ingestion.mock_data import MockDataEngine
from backend.src.features.transforms import build_feature_panel
from backend.src.models.custom_hmm import GaussianHMM
from backend.src.models.regime_labeler import RegimeLabeler
from backend.src.backtest.backtester import WalkForwardBacktester, compute_drawdowns

class MacroRegimePipeline:
    def __init__(self, settings_path: str = 'backend/config/settings.yaml',
                 regime_map_path: str = 'backend/config/regime_map.yaml',
                 output_dir: str = 'backend/data/processed'):
        
        # Load configs
        with open(settings_path, 'r') as f:
            self.settings = yaml.safe_load(f)
            
        with open(regime_map_path, 'r') as f:
            self.regime_map = yaml.safe_load(f)
            
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Ingestion setup
        self.fred_key = os.getenv('FRED_API_KEY')
        self.fred_client = FredClient(self.fred_key)
        self.market_client = MarketClient()
        self.mock_engine = MockDataEngine()

    def run(self, force_mock: bool = False, start_date: str = None, end_date: str = None,
            n_regimes: int = None, tickers: list = None, regime_map: dict = None) -> dict:
        """Runs the entire ingestion, engineering, model training, allocation, and backtesting pipeline."""
        start_date = start_date or self.settings['start_date']
        end_date = end_date or self.settings['end_date']
        min_periods = self.settings.get('min_periods', 36)
        n_regimes = n_regimes or self.settings.get('n_regimes', 4)
        regime_map = regime_map or self.regime_map
        tickers = tickers or ['SPY', 'TLT', 'IEF', 'TIP', 'GLD', 'DBC', 'SHY']
        
        # Ensure SPY and TLT are always downloaded for baseline/passive benchmark calculations
        download_tickers = list(set(tickers + ['SPY', 'TLT']))
        
        # 1. Ingest Data (Real FRED/yfinance or Mock Fallback)
        using_mock = force_mock or not self.fred_key
        
        if using_mock:
            print("No FRED API key detected or mock forced. Generating high-fidelity mock data...")
            macro_panel = self.mock_engine.generate_macro_data(start_date, end_date)
            market_prices = self.mock_engine.generate_market_data(download_tickers, start_date, end_date)
        else:
            print("FRED API key detected. Ingesting macro data...")
            try:
                macro_panel = self.fred_client.get_indicator_panel(
                    self.settings['indicators'], start_date, end_date, use_cache=False
                )
                print("Downloading market data from Yahoo Finance...")
                market_prices = self.market_client.get_price_panel(download_tickers, start_date, end_date, use_cache=False)
            except Exception as e:
                print(f"Error fetching real data: {str(e)}")
                print("Falling back to high-fidelity simulated mock data...")
                using_mock = True
                macro_panel = self.mock_engine.generate_macro_data(start_date, end_date)
                market_prices = self.mock_engine.generate_market_data(download_tickers, start_date, end_date)

        # 2. Resample Market returns to monthly
        monthly_returns = self.market_client.get_monthly_returns(market_prices)

        # 3. Clean and Transform features
        print("Cleaning and engineering macroeconomic features...")
        features = build_feature_panel(macro_panel, min_periods=min_periods)
        
        # Align features and returns
        common_idx = features.index.intersection(monthly_returns.index)
        features = features.loc[common_idx]
        monthly_returns = monthly_returns.loc[common_idx]
        
        if len(features) <= min_periods + 1:
            raise ValueError(
                f"Selected date range from {start_date} to {end_date} has only {len(features)} valid data points "
                f"after Z-score warm-up. A minimum of {min_periods + 12} periods is required to run the walk-forward backtest."
            )
        
        # 4. Fit the Final HMM Model (for current state snapshot)
        print("Fitting final Hidden Markov Model...")
        hmm = GaussianHMM(n_components=n_regimes, random_state=42)
        hmm.fit(features)
        
        labeler = RegimeLabeler()
        labeler.fit(hmm.means_, features.columns)
        
        all_probs = hmm.predict_proba(features)
        all_states = hmm.decode(features)
        
        labeled_probs = labeler.label_probabilities(all_probs)
        labeled_states = labeler.label_series(all_states)
        
        # 5. Run Out-of-Sample Walk-Forward Backtest
        print("Running walk-forward out-of-sample backtest...")
        backtester = WalkForwardBacktester(n_regimes=n_regimes, min_train_periods=min_periods)
        backtest_results = backtester.run(features, monthly_returns, regime_map)

        # 6. Prepare and Save Results
        print("Compiling and caching diagnostics results...")
        
        # A. Current snapshot details
        current_date = oos_date = backtest_results['dates'][-1]
        current_regime = backtest_results['states'].iloc[-1]
        current_prob = backtest_results['probabilities'].iloc[-1][current_regime]
        
        # Calculate consecutive months in current regime
        consec_months = 0
        state_list = backtest_results['states'].tolist()
        for state in reversed(state_list):
            if state == current_regime:
                consec_months += 1
            else:
                break
                
        # Current recommended weights
        current_weights = backtest_results['allocations'].iloc[-1].to_dict()
        
        snapshot = {
            'as_of_date': current_date.strftime('%Y-%m-%d'),
            'current_regime': current_regime,
            'probability': float(current_prob),
            'consecutive_months': consec_months,
            'target_allocation': current_weights,
            'is_mock_data': using_mock
        }
        
        # B. Diagnostics / Model Results
        transition_matrix = hmm.transmat_.tolist()
        
        # Compile feature profiles for each regime (Gaussian means/covars)
        feature_profiles = {}
        for s in range(n_regimes):
            lbl = labeler.state_to_label_[s]
            feature_profiles[lbl] = {}
            for col_idx, col_name in enumerate(features.columns):
                feature_profiles[lbl][col_name] = {
                    'mean': float(hmm.means_[s, col_idx]),
                    'variance': float(hmm.covars_[s, col_idx])
                }
                
        model_results = {
            'snapshot': snapshot,
            'transition_matrix': transition_matrix,
            'feature_profiles': feature_profiles,
            'regime_labels': list(labeler.state_to_label_.values()),
            'feature_names': list(features.columns)
        }
        
        # Save model results
        with open(self.output_dir / 'model_results.json', 'w') as f:
            json.dump(model_results, f, indent=2)
            
        # C. Backtest Results
        # Cumulative returns
        returns_df = backtest_results['returns']
        cum_returns = (1 + returns_df).cumprod() - 1
        
        # Convert index to string for JSON serialization
        dates_str = [d.strftime('%Y-%m-%d') for d in returns_df.index]
        
        # Convert drawdowns
        strategy_dd, _ = compute_drawdowns(returns_df['strategy'])
        spy_dd, _ = compute_drawdowns(returns_df['SPY'])
        portfolio_6040_dd, _ = compute_drawdowns(returns_df['60_40'])
        ew_dd, _ = compute_drawdowns(returns_df['EqualWeight'])
        
        backtest_output = {
            'dates': dates_str,
            'cumulative_returns': {
                'strategy': cum_returns['strategy'].tolist(),
                'SPY': cum_returns['SPY'].tolist(),
                '60_40': cum_returns['60_40'].tolist(),
                'EqualWeight': cum_returns['EqualWeight'].tolist()
            },
            'drawdowns': {
                'strategy': strategy_dd.tolist(),
                'SPY': spy_dd.tolist(),
                '60_40': portfolio_6040_dd.tolist(),
                'EqualWeight': ew_dd.tolist()
            },
            'metrics': backtest_results['metrics'],
            'allocations': {
                'dates': dates_str,
                'data': backtest_results['allocations'].to_dict(orient='list')
            },
            'probabilities': {
                'dates': dates_str,
                'data': backtest_results['probabilities'].to_dict(orient='list')
            },
            'regime_history': backtest_results['states'].tolist()
        }
        
        # Save backtest results
        with open(self.output_dir / 'backtest_results.json', 'w') as f:
            json.dump(backtest_output, f, indent=2)
            
        print("Pipeline run completed successfully. Cache saved to backend/data/processed/")
        return model_results
        
if __name__ == '__main__':
    # Add project root to path for imports when run directly
    import sys
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    pipeline = MacroRegimePipeline()
    pipeline.run()
