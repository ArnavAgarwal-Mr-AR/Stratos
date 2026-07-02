import pandas as pd
import numpy as np

def blend_allocation(regime_probs, regime_targets: dict) -> pd.DataFrame:
    """
    Computes probability-weighted asset allocations.
    
    Parameters:
    -----------
    regime_probs : pd.Series or pd.DataFrame
        If Series: index represents regime labels, values represent probabilities.
        If DataFrame: columns represent regime labels, index represents dates.
    regime_targets : dict
        Dict of dicts mapping regime label -> {asset: weight}.
        Example:
        {
            'recession': {'SPY': 0.15, 'TLT': 0.45, ...},
            ...
        }
        
    Returns:
    --------
    pd.Series or pd.DataFrame
        Blended allocations of assets (matches type of input).
    """
    # Get the asset tickers from the target map
    first_regime = next(iter(regime_targets.keys()))
    assets = list(regime_targets[first_regime].keys())
    
    if isinstance(regime_probs, pd.Series):
        # Blend a single vector of probabilities
        blended = pd.Series(0.0, index=assets)
        for regime, prob in regime_probs.items():
            if regime in regime_targets:
                for asset in assets:
                    blended[asset] += prob * regime_targets[regime][asset]
        # Normalize to sum to 1
        total_w = blended.sum()
        if total_w > 0:
            blended /= total_w
        return blended
        
    elif isinstance(regime_probs, pd.DataFrame):
        # Blend a matrix of probabilities over time
        blended_df = pd.DataFrame(0.0, index=regime_probs.index, columns=assets)
        for regime in regime_probs.columns:
            if regime in regime_targets:
                targets = regime_targets[regime]
                prob_series = regime_probs[regime]
                for asset in assets:
                    blended_df[asset] += prob_series * targets[asset]
        
        # Normalize each row to sum to 1
        row_sums = blended_df.sum(axis=1)
        # Avoid division by zero
        row_sums_clean = np.where(row_sums == 0, 1.0, row_sums)
        blended_df = blended_df.div(row_sums_clean, axis=0)
        return blended_df
        
    else:
        raise TypeError("regime_probs must be a pandas Series or DataFrame.")
