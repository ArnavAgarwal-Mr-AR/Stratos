import pandas as pd
import numpy as np
from backend.src.models.custom_hmm import GaussianHMM
from backend.src.models.regime_labeler import RegimeLabeler
from backend.src.allocation.regime_allocator import blend_allocation

def compute_drawdowns(returns: pd.Series) -> tuple:
    """Computes peak-to-trough drawdowns, max drawdown, and recovery time."""
    cum_returns = (1 + returns).cumprod()
    running_max = cum_returns.cummax()
    drawdowns = (cum_returns - running_max) / running_max
    max_dd = drawdowns.min()
    return drawdowns, max_dd

def calculate_performance_metrics(returns: pd.Series, turnover: pd.Series = None, risk_free_rate: float = 0.0) -> dict:
    """Computes standard portfolio metrics: CAGR, Volatility, Sharpe, Sortino, Max Drawdown, Calmar."""
    n_months = len(returns)
    if n_months == 0:
        return {}
        
    # Annualized CAGR
    cum_ret = (1 + returns).prod()
    cagr = (cum_ret ** (12 / n_months)) - 1
    
    # Annualized Volatility
    vol = returns.std() * np.sqrt(12)
    
    # Sharpe Ratio
    excess_returns = returns - (risk_free_rate / 12)
    sharpe = (excess_returns.mean() * 12) / (vol + 1e-8)
    
    # Sortino Ratio (downside deviation only)
    downside_returns = returns[returns < 0]
    downside_vol = downside_returns.std() * np.sqrt(12)
    sortino = (excess_returns.mean() * 12) / (downside_vol + 1e-8)
    
    # Max Drawdown
    _, max_dd = compute_drawdowns(returns)
    
    # Calmar Ratio
    calmar = cagr / abs(max_dd) if max_dd != 0 else np.nan
    
    # Turnover
    avg_turnover = turnover.mean() if turnover is not None else 0.0
    
    return {
        'CAGR': float(cagr),
        'Volatility': float(vol),
        'Sharpe': float(sharpe),
        'Sortino': float(sortino),
        'MaxDrawdown': float(max_dd),
        'Calmar': float(calmar),
        'AvgTurnover': float(avg_turnover)
    }

class WalkForwardBacktester:
    def __init__(self, n_regimes: int = 4, min_train_periods: int = 36, fee_rate: float = 0.0010):
        """
        fee_rate: transaction cost rate (e.g., 0.0010 = 10 bps per unit of turnover)
        """
        self.n_regimes = n_regimes
        self.min_train_periods = min_train_periods
        self.fee_rate = fee_rate
        
    def run(self, feature_panel: pd.DataFrame, asset_returns: pd.DataFrame, regime_targets: dict) -> dict:
        """
        Runs out-of-sample walk-forward backtest.
        Fits HMM on expanding window and computes next-month returns.
        """
        # Ensure indices align
        common_idx = feature_panel.index.intersection(asset_returns.index)
        features = feature_panel.loc[common_idx]
        returns = asset_returns.loc[common_idx]
        
        n_periods = len(features)
        
        # Out-of-sample result containers
        oos_dates = []
        oos_probs = []
        oos_states = []
        oos_allocations = []
        oos_returns = []
        oos_turnover = []
        
        prev_weights = None
        
        # Iterate walk-forward month by month
        for t in range(self.min_train_periods, n_periods - 1):
            date_t = features.index[t]
            date_next = features.index[t + 1]
            
            # 1. Slice history up to t
            X_train = features.iloc[:t+1]
            
            # 2. Fit HMM model on history
            hmm = GaussianHMM(n_components=self.n_regimes, n_iter=25, random_state=42)
            hmm.fit(X_train)
            
            # 3. Label states economically
            labeler = RegimeLabeler()
            labeler.fit(hmm.means_, features.columns)
            
            # 4. Get probability vector at time t
            probs_train = hmm.predict_proba(X_train)
            probs_t = probs_train.iloc[-1]
            state_t = hmm.decode(X_train).iloc[-1]
            
            # Map state name
            labeled_probs = labeler.label_probabilities(probs_t.to_frame().T).iloc[0]
            labeled_state = labeler.state_to_label_.get(state_t, f"state_{state_t}")
            
            # 5. Determine next period weights (t to t+1)
            weights_t = blend_allocation(labeled_probs, regime_targets)
            
            # 6. Calculate next period return (t+1) (slicing to match active asset weights index)
            ret_next = returns.loc[date_next, weights_t.index]
            port_ret_gross = np.sum(weights_t * ret_next)
            
            # 7. Transaction cost deduction
            if prev_weights is None:
                # First period: buy the portfolio from cash
                turnover = weights_t.sum() # = 1.0
            else:
                # Weight changes
                turnover = np.sum(np.abs(weights_t - prev_weights))
                
            tc = turnover * self.fee_rate
            port_ret_net = port_ret_gross - tc
            
            # Store out-of-sample data
            oos_dates.append(date_next)
            oos_probs.append(labeled_probs)
            oos_states.append(labeled_state)
            oos_allocations.append(weights_t)
            oos_returns.append(port_ret_net)
            oos_turnover.append(turnover)
            
            prev_weights = weights_t
            
        # Convert to DataFrames / Series
        oos_dates = pd.DatetimeIndex(oos_dates)
        probs_df = pd.DataFrame(oos_probs, index=oos_dates)
        states_series = pd.Series(oos_states, index=oos_dates, name='regime')
        alloc_df = pd.DataFrame(oos_allocations, index=oos_dates)
        ret_series = pd.Series(oos_returns, index=oos_dates, name='strategy')
        turnover_series = pd.Series(oos_turnover, index=oos_dates, name='turnover')
        
        # Calculate benchmark returns over the exact same OOS index
        benchmarks = self._calculate_benchmarks(returns.loc[oos_dates])
        
        # Calculate performance metrics
        metrics = {
            'strategy': calculate_performance_metrics(ret_series, turnover_series)
        }
        for b_name, b_ret in benchmarks.items():
            metrics[b_name] = calculate_performance_metrics(b_ret)
            
        return {
            'dates': oos_dates,
            'probabilities': probs_df,
            'states': states_series,
            'allocations': alloc_df,
            'returns': pd.concat([ret_series, benchmarks], axis=1),
            'metrics': metrics
        }
        
    def _calculate_benchmarks(self, asset_returns: pd.DataFrame) -> pd.DataFrame:
        """Compute returns for 60/40, Equal-Weight, and buy-and-hold SPY."""
        bench_df = pd.DataFrame(index=asset_returns.index)
        
        # 1. SPY Buy and Hold
        bench_df['SPY'] = asset_returns['SPY']
        
        # 2. 60/40 Portfolio (60% SPY, 40% TLT, rebalanced monthly)
        bench_df['60_40'] = 0.60 * asset_returns['SPY'] + 0.40 * asset_returns['TLT']
        
        # 3. Equal Weight
        # If any ticker is missing, distribute weight among remaining
        n_assets = asset_returns.shape[1]
        bench_df['EqualWeight'] = asset_returns.mean(axis=1)
        
        return bench_df
