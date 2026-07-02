import pandas as pd
import numpy as np

def yoy_pct_change(series: pd.Series, periods: int = 12) -> pd.Series:
    """YoY percentage change."""
    return series.pct_change(periods=periods) * 100

def annualized_qoq_growth_quarterly(series: pd.Series) -> pd.Series:
    """
    Computes annualized QoQ growth on a quarterly series.
    Formula: ((1 + QoQ_change) ^ 4 - 1) * 100
    """
    qoq_change = series.pct_change(periods=1)
    return ((1 + qoq_change) ** 4 - 1) * 100

def expanding_zscore(series: pd.Series, min_periods: int = 36) -> pd.Series:
    """
    Computes Z-score using an expanding window to prevent look-ahead bias.
    min_periods: the minimum number of observations required to start calculating.
    """
    mean = series.expanding(min_periods=min_periods).mean()
    std = series.expanding(min_periods=min_periods).std()
    # Add a tiny value to std to prevent division by zero
    std_clean = np.where(std == 0, 1e-8, std)
    return (series - mean) / std_clean

def winsorize(series: pd.Series, limit: float = 4.0) -> pd.Series:
    """Winsorize series at +/- limit standard deviations."""
    return series.clip(lower=-limit, upper=limit)

def build_feature_panel(macro_panel: pd.DataFrame, min_periods: int = 36) -> pd.DataFrame:
    """
    Aligns and constructs the standardized feature panel from raw macroeconomic series.
    
    Expected raw columns:
    - CPIAUCSL: Monthly CPI
    - GDPC1: Quarterly Real GDP (with NaNs in non-quarter-end months)
    - UNRATE: Monthly Unemployment Rate
    - T10Y2Y: Daily or monthly Yield Spread
    """
    # 1. Resample T10Y2Y to Month End (take last quote of the month)
    curve_slope = macro_panel['T10Y2Y'].resample('ME').last()
    
    # 2. Resample CPI to Month End
    cpi = macro_panel['CPIAUCSL'].resample('ME').last()
    
    # 3. Resample Unemployment to Month End
    unrate = macro_panel['UNRATE'].resample('ME').last()
    
    # 4. GDP is quarterly. We calculate annualized growth quarterly and then forward-fill to monthly.
    gdp_quarterly = macro_panel['GDPC1'].dropna()
    gdp_growth_q = annualized_qoq_growth_quarterly(gdp_quarterly)
    
    # Reindex GDP to monthly index and forward fill (resampling first to Month-End to align indices)
    monthly_index = cpi.index
    gdp_growth_m = gdp_growth_q.resample('ME').last().reindex(monthly_index).ffill()
    
    # Create aligned panel
    feats = pd.DataFrame(index=monthly_index)
    feats['inflation_yoy'] = yoy_pct_change(cpi, 12)
    feats['gdp_growth'] = gdp_growth_m
    feats['unemployment_mom'] = unrate.diff(3)
    feats['curve_slope'] = curve_slope
    feats['curve_slope_chg'] = curve_slope.diff(6)
    
    # Apply expanding Z-score to avoid look-ahead leakage
    z = feats.apply(lambda col: expanding_zscore(col, min_periods=min_periods))
    
    # Winsorize to restrict extreme outlier drift
    z_winsorized = z.apply(lambda col: winsorize(col, limit=4.0))
    
    # Drop rows containing NaNs (resulting from diffs and expanding window warm-up)
    return z_winsorized.dropna()
