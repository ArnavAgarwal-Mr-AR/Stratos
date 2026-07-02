# Macro Regime Detection Platform

*A Hidden Markov Model System for Macroeconomic Regime Classification and Dynamic Asset Allocation*

**Document Type:** Complete Project Specification & Build Guide
**Domain:** Quantitative Finance / Macro Strategy / Systematic Asset Allocation
**Stack:** Python — hmmlearn, pandas, FRED API, yfinance, cvxpy, scikit-learn
**Prepared for:** Senior Quantitative Developer Build-Out

---

## Contents

1. [Project Overview](#1-project-overview)
2. [Real-World Finance Use Case](#2-real-world-finance-use-case)
3. [System Architecture](#3-system-architecture)
4. [Sample Input / Output](#4-sample-input--output)
5. [Required APIs and Data Sources](#5-required-apis-and-data-sources)
6. [Step-by-Step Build Guide](#6-step-by-step-build-guide)
7. [Data Collection Pipeline](#7-data-collection-pipeline)
8. [Data Cleaning & Feature Engineering](#8-data-cleaning--feature-engineering)
9. [Core Models & Algorithms](#9-core-models--algorithms)
10. [Visualizations & Dashboard Components](#10-visualizations--dashboard-components)
11. [Performance Metrics](#11-performance-metrics)
12. [Final Deliverables](#12-final-deliverables)

---

## 1. Project Overview

The Macro Regime Detection Platform is a systematic research and trading infrastructure that classifies the prevailing macroeconomic environment into discrete regimes — such as Inflationary Expansion, Disinflationary Growth, Stagflation, or Recession — using a Hidden Markov Model (HMM) trained on macro time series. Once a regime is identified, the platform maps that state probabilistically to a target asset allocation, producing a regime-aware portfolio that adapts as the macro backdrop shifts.

The system is built around four economic dimensions: inflation, growth, unemployment, and the shape of the yield curve. Rather than relying on a single point-in-time classification, the platform outputs a full probability distribution across regimes at every period, allowing downstream allocation logic to blend exposures smoothly instead of making binary switches.

### Core Objectives

- Ingest and standardize macroeconomic indicators (CPI, GDP, unemployment, yield curve) from FRED.
- Engineer regime-relevant features: growth momentum, inflation trend, curve slope, labor market slack.
- Fit a Gaussian HMM to uncover latent regimes and estimate regime probabilities at each time step.
- Label/interpret each hidden state economically (e.g., "Inflationary Expansion").
- Translate regime probabilities into dynamic, risk-aware portfolio weights across equities, bonds, commodities, and cash.
- Backtest the regime-driven strategy against static benchmarks (60/40, equal-weight, buy-and-hold).
- Visualize the regime timeline, transition probabilities, and resulting allocations on an interactive dashboard.

---

## 2. Real-World Finance Use Case

Macro regime frameworks are foundational to how large asset managers run multi-asset portfolios. Bridgewater's "All Weather" approach, Ray Dalio's growth/inflation quadrant framework, and the regime-conditioned allocation models used by firms like AQR, PIMCO, and BlackRock's systematic macro desks all rest on the same core idea: asset class returns behave very differently depending on whether growth is accelerating or decelerating, and whether inflation is rising or falling.

### Why It Matters

- Equities tend to outperform in Expansion regimes and underperform sharply in Recession regimes.
- Commodities and TIPS (inflation-protected bonds) tend to outperform during Inflationary regimes, while nominal long-duration bonds are hurt.
- Nominal government bonds tend to rally during Recession/Disinflation regimes as central banks ease and growth expectations fall.
- Cash and short-duration instruments become attractive during Stagflation, when both equities and bonds underperform simultaneously.

A regime detection system gives a portfolio manager a quantitative, repeatable, and back-testable way to answer the question "what environment are we in, and how confident are we?" — replacing subjective macro calls with a probabilistic, data-driven signal that can be embedded directly into a tactical asset allocation (TAA) overlay on top of a strategic benchmark portfolio.

### Where This Plugs Into a Real Workflow

- **Tactical overlay:** a sleeve (e.g., 10–20%) of a larger multi-asset portfolio is tilted according to the detected regime, while the core remains strategically allocated.
- **Risk management:** regime probabilities act as an early-warning signal — a rising probability of Recession ahead of realized drawdowns can trigger de-risking.
- **Manager research & due diligence:** regime classification provides a lens to evaluate how a fund's returns are conditioned on the macro backdrop (regime-conditional performance attribution).

---

## 3. System Architecture

The platform is organized into five layers, each independently testable and replaceable:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — DATA INGESTION                                       │
│  fred_client.py · yfinance_client.py · raw_store/ (parquet)     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│  LAYER 2 — CLEANING & FEATURE ENGINEERING                       │
│  alignment, frequency resampling, transforms, lag handling       │
│  feature_store.py → processed/features.parquet                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│  LAYER 3 — REGIME MODEL                                         │
│  hmm_model.py (GaussianHMM, hmmlearn)                            │
│  → state probabilities, Viterbi path, transition matrix          │
│  regime_labeler.py → economic interpretation of hidden states    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│  LAYER 4 — ALLOCATION ENGINE                                     │
│  allocator.py → regime-conditional target weights                │
│  probability-weighted blending across regime allocation map      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│  LAYER 5 — BACKTEST & DASHBOARD                                  │
│  backtester.py (vectorized, walk-forward)                        │
│  dashboard/ (Streamlit/Plotly) — timeline, probs, allocations    │
└─────────────────────────────────────────────────────────────────┘
```

### Repository Layout

```
macro_regime_platform/
├── config/
│   ├── settings.yaml          # API keys, tickers, date ranges
│   └── regime_map.yaml        # regime → asset allocation targets
├── data/
│   ├── raw/                   # untouched FRED / Yahoo pulls (parquet)
│   ├── processed/             # aligned, feature-engineered panel
│   └── cache/
├── src/
│   ├── ingestion/
│   │   ├── fred_client.py
│   │   └── market_client.py   # yfinance wrapper
│   ├── features/
│   │   ├── transforms.py      # YoY%, diffs, z-scores
│   │   └── feature_builder.py
│   ├── models/
│   │   ├── hmm_model.py
│   │   ├── regime_labeler.py
│   │   └── model_selection.py # BIC/AIC state count selection
│   ├── allocation/
│   │   ├── regime_allocator.py
│   │   └── risk_overlay.py    # vol targeting, turnover control
│   ├── backtest/
│   │   ├── backtester.py
│   │   └── metrics.py
│   └── pipeline.py            # orchestrates end-to-end run
├── dashboard/
│   └── app.py                 # Streamlit dashboard
├── tests/
├── notebooks/                 # exploratory analysis
├── requirements.txt
└── README.md
```

---

## 4. Sample Input / Output

### Input Configuration

```yaml
# config/settings.yaml
country: US
indicators:
  - CPIAUCSL        # CPI, all urban consumers (FRED)
  - GDPC1           # Real GDP (FRED)
  - UNRATE          # Unemployment rate (FRED)
  - T10Y2Y          # 10Y-2Y Treasury yield spread (FRED)
start_date: '1990-01-01'
end_date: '2026-06-01'
rebalance_frequency: monthly
n_regimes: 4
```

### Sample Output — Current Regime Snapshot

| Field | Value |
|---|---|
| As-of Date | 2026-05-31 |
| Current Regime | Inflationary Expansion |
| Regime Probability | 78% |
| Second-Most-Likely Regime | Disinflationary Expansion (15%) |
| Months in Current Regime | 4 |
| Recommended Allocation | Equities 45% · Commodities 20% · TIPS 15% · Nominal Bonds 10% · Cash 10% |

### Sample Output — Regime Probability Vector (JSON)

```json
{
  "date": "2026-05-31",
  "regime_probabilities": {
    "inflationary_expansion": 0.78,
    "disinflationary_expansion": 0.15,
    "stagflation": 0.05,
    "recession": 0.02
  },
  "most_likely_regime": "inflationary_expansion",
  "target_allocation": {
    "equities": 0.45,
    "commodities": 0.20,
    "tips": 0.15,
    "nominal_bonds": 0.10,
    "cash": 0.10
  }
}
```

---

## 5. Required APIs and Data Sources

### FRED (Federal Reserve Economic Data)

Primary source for macro indicators. Free API key required from the St. Louis Fed (fred.stlouisfed.org/docs/api/api_key.html). Accessed via the `fredapi` Python package or direct REST calls.

| Series ID | Description | Native Frequency |
|---|---|---|
| CPIAUCSL | CPI for All Urban Consumers (inflation level) | Monthly |
| GDPC1 | Real Gross Domestic Product (growth level) | Quarterly |
| UNRATE | Civilian Unemployment Rate | Monthly |
| T10Y2Y | 10-Year minus 2-Year Treasury Yield Spread | Daily |
| FEDFUNDS | Effective Federal Funds Rate (optional, policy stance) | Monthly |
| INDPRO | Industrial Production Index (optional growth proxy) | Monthly |

### Yahoo Finance (via yfinance)

Source for the asset price series used to (a) build the allocation universe and (b) backtest regime-conditional portfolios.

| Ticker | Asset Class Role |
|---|---|
| SPY | US Equities |
| TLT | Long-Duration Nominal Treasuries |
| IEF | Intermediate Treasuries (lower duration alternative) |
| TIP | Treasury Inflation-Protected Securities (TIPS) |
| GLD | Gold / Inflation Hedge |
| DBC | Broad Commodities Index |
| SHY | Short-Duration Treasuries / Cash Proxy |

### API Access Notes

- FRED: free, requires an API key, rate limit ~120 requests/minute — generous for this use case.
- yfinance: unofficial wrapper around Yahoo's endpoints — no key required, but add retry/backoff logic since it occasionally throttles or changes response shape.
- Cache all raw pulls to local parquet so notebooks and backtests don't re-hit either API on every run.

---

## 6. Step-by-Step Build Guide

This is the recommended build order. Each step produces a runnable, testable artifact before moving to the next — avoid building the dashboard before the model output is validated.

1. **Environment & scaffolding** — set up the repo structure, virtualenv, `requirements.txt` (pandas, numpy, hmmlearn, fredapi, yfinance, scipy, cvxpy, matplotlib, plotly, streamlit, scikit-learn).
2. **Data ingestion** — implement `fred_client.py` and `market_client.py`; write raw pulls to `data/raw/` as parquet with a manifest of last-updated timestamps.
3. **Alignment & resampling** — build a unified monthly panel: forward-fill or interpolate lower-frequency series (GDP) onto the monthly grid used by CPI/UNRATE.
4. **Feature engineering** — compute YoY inflation, GDP growth rate, unemployment change, yield curve slope, and standardize (z-score) each feature over a trailing window.
5. **Model selection** — fit GaussianHMM across a grid of state counts (2–6) and select via BIC; inspect transition matrices for interpretability.
6. **Regime fitting** — fit the chosen HMM on the full feature panel; extract the Viterbi-decoded state path and the full posterior probability matrix (`predict_proba`).
7. **Regime labeling** — map each hidden state index to an economic label by inspecting the fitted Gaussian means for each feature (high growth + high inflation → "Inflationary Expansion", etc.).
8. **Allocation engine** — define a regime → target weights map (`config/regime_map.yaml`) and build the probability-weighted blending logic in `regime_allocator.py`.
9. **Backtesting** — implement a walk-forward backtest: refit the HMM on expanding/rolling windows to avoid look-ahead bias, simulate monthly rebalancing, and compute performance metrics.
10. **Dashboard** — build the Streamlit app with the regime timeline, probability stacked area chart, and allocation history.
11. **Validation & documentation** — write unit tests for feature transforms and allocation logic, and document model assumptions and limitations in the README.

---

## 7. Data Collection Pipeline

### 7.1 FRED Client

```python
# src/ingestion/fred_client.py
from fredapi import Fred
import pandas as pd
from pathlib import Path

class FredClient:
    def __init__(self, api_key: str, cache_dir: str = 'data/raw'):
        self.fred = Fred(api_key=api_key)
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get_series(self, series_id: str, start: str, end: str,
                   use_cache: bool = True) -> pd.Series:
        cache_path = self.cache_dir / f'{series_id}.parquet'
        if use_cache and cache_path.exists():
            cached = pd.read_parquet(cache_path)['value']
            cached.index = pd.to_datetime(cached.index)
            return cached.loc[start:end]

        series = self.fred.get_series(series_id, start, end)
        series.name = 'value'
        series.to_frame().to_parquet(cache_path)
        return series

    def get_indicator_panel(self, series_ids: list, start: str,
                             end: str) -> pd.DataFrame:
        frames = {sid: self.get_series(sid, start, end) for sid in series_ids}
        return pd.DataFrame(frames)
```

### 7.2 Market Data Client (Yahoo Finance)

```python
# src/ingestion/market_client.py
import yfinance as yf
import pandas as pd

ASSET_UNIVERSE = ['SPY', 'TLT', 'IEF', 'TIP', 'GLD', 'DBC', 'SHY']

def get_price_panel(tickers: list, start: str, end: str) -> pd.DataFrame:
    raw = yf.download(tickers, start=start, end=end,
                       auto_adjust=True, progress=False)
    prices = raw['Close'] if 'Close' in raw else raw
    return prices.dropna(how='all')

def get_monthly_returns(prices: pd.DataFrame) -> pd.DataFrame:
    monthly = prices.resample('ME').last()
    return monthly.pct_change().dropna()
```

### 7.3 Caching & Refresh Strategy

- Raw pulls are immutable snapshots written to `data/raw/` — never overwritten in place, only appended to with new date ranges.
- A `manifest.json` tracks last successful pull timestamp per series to support incremental refresh.
- Retry logic with exponential backoff wraps both clients (FRED occasionally rate-limits; yfinance occasionally returns empty frames on transient failures).

---

## 8. Data Cleaning & Feature Engineering

### 8.1 Frequency Alignment

CPI and unemployment are monthly; GDP is quarterly; the yield curve spread is daily. All series are resampled to a common monthly grid. GDP is forward-filled across the two intervening months of each quarter — this introduces an intentional information lag that mirrors real-world reporting delay and must be respected in the backtest to avoid look-ahead bias. The yield curve spread is downsampled by taking the month-end value.

### 8.2 Core Feature Transforms

| Raw Series | Transform | Resulting Feature |
|---|---|---|
| CPIAUCSL | 12-month % change | `inflation_yoy` |
| GDPC1 | QoQ annualized % change | `gdp_growth_qoq_saar` |
| UNRATE | 3-month change (level) | `unemployment_momentum` |
| T10Y2Y | level + 6-month change | `curve_slope`, `curve_slope_chg` |

### 8.3 Standardization

Each feature is z-scored using a trailing expanding window (not the full-sample mean/std) so that the feature scale at any historical point only reflects information available up to that point — critical for a valid walk-forward backtest.

```python
# src/features/transforms.py
import pandas as pd
import numpy as np

def yoy_pct_change(series: pd.Series, periods: int = 12) -> pd.Series:
    return series.pct_change(periods=periods) * 100

def annualized_qoq_growth(series: pd.Series) -> pd.Series:
    return ((1 + series.pct_change()) ** 4 - 1) * 100

def expanding_zscore(series: pd.Series, min_periods: int = 36) -> pd.Series:
    mean = series.expanding(min_periods=min_periods).mean()
    std = series.expanding(min_periods=min_periods).std()
    return (series - mean) / std

def build_feature_panel(macro_panel: pd.DataFrame) -> pd.DataFrame:
    feats = pd.DataFrame(index=macro_panel.index)
    feats['inflation_yoy'] = yoy_pct_change(macro_panel['CPIAUCSL'])
    feats['gdp_growth'] = annualized_qoq_growth(
        macro_panel['GDPC1'].resample('ME').ffill())
    feats['unemployment_mom'] = macro_panel['UNRATE'].diff(3)
    feats['curve_slope'] = macro_panel['T10Y2Y']
    feats['curve_slope_chg'] = macro_panel['T10Y2Y'].diff(6)

    z = feats.apply(expanding_zscore)
    return z.dropna()
```

### 8.4 Outlier & Missing-Data Handling

- Winsorize z-scored features at ±4 standard deviations to prevent a single data revision or COVID-era outlier from dominating HMM emission estimates.
- Drop the warm-up period before the expanding window reaches `min_periods` rather than back-filling, since back-filling would leak future information into early-history rows.
- Flag and log any FRED data revisions (FRED occasionally restates historical GDP/CPI values) — store a vintage date alongside the raw pull for full reproducibility.

---

## 9. Core Models & Algorithms

### 9.1 Why a Hidden Markov Model

Macro regimes are not directly observable — they are latent states inferred from observable indicators. An HMM is a natural fit: it assumes the economy occupies one of K hidden states at each time step, each state has its own characteristic distribution over the observed features (a Gaussian emission model here), and the economy transitions between states according to a Markov transition matrix. This produces both a most-likely discrete regime path (via the Viterbi algorithm) and a full probability distribution over regimes at every time step (via the forward-backward algorithm), which is exactly the dual output — point classification plus uncertainty — that a real allocation process needs.

### 9.2 Model Specification

```python
# src/models/hmm_model.py
from hmmlearn.hmm import GaussianHMM
import numpy as np
import pandas as pd

class RegimeHMM:
    def __init__(self, n_states: int = 4, covariance_type: str = 'full',
                 n_iter: int = 1000, random_state: int = 42):
        self.model = GaussianHMM(
            n_components=n_states,
            covariance_type=covariance_type,
            n_iter=n_iter,
            random_state=random_state,
        )
        self.n_states = n_states

    def fit(self, feature_panel: pd.DataFrame):
        X = feature_panel.values
        self.model.fit(X)
        return self

    def decode(self, feature_panel: pd.DataFrame) -> pd.Series:
        """Viterbi-decoded most likely state path."""
        X = feature_panel.values
        _, states = self.model.decode(X, algorithm='viterbi')
        return pd.Series(states, index=feature_panel.index, name='regime')

    def predict_proba(self, feature_panel: pd.DataFrame) -> pd.DataFrame:
        """Forward-backward smoothed state probabilities."""
        X = feature_panel.values
        probs = self.model.predict_proba(X)
        cols = [f'state_{i}' for i in range(self.n_states)]
        return pd.DataFrame(probs, index=feature_panel.index, columns=cols)

    @property
    def transition_matrix(self) -> np.ndarray:
        return self.model.transmat_

    @property
    def state_means(self) -> np.ndarray:
        return self.model.means_
```

### 9.3 Selecting the Number of States

The number of hidden states (K) is chosen by fitting the model across a grid (typically 2–6 states) and comparing Bayesian Information Criterion (BIC) scores, which penalize model complexity to avoid overfitting transient noise into spurious extra regimes. K=4 is the natural choice here given the four target labels (Inflationary Expansion, Disinflationary Expansion, Stagflation, Recession), but the BIC sweep should still be run to confirm the data supports that many distinct, well-separated states rather than collapsing two of them.

```python
# src/models/model_selection.py
import numpy as np

def select_n_states(feature_panel, candidate_states=range(2, 7)):
    results = []
    for k in candidate_states:
        model = RegimeHMM(n_states=k).fit(feature_panel)
        log_likelihood = model.model.score(feature_panel.values)
        n_params = k * k + k * feature_panel.shape[1] * 2  # rough param count
        bic = -2 * log_likelihood + n_params * np.log(len(feature_panel))
        results.append({'k': k, 'log_likelihood': log_likelihood, 'bic': bic})
    return min(results, key=lambda r: r['bic'])
```

### 9.4 Regime Labeling

`hmmlearn` assigns arbitrary integer indices to states — state 0 has no inherent economic meaning. After fitting, each state's Gaussian mean vector (`model.means_`) is inspected across the `inflation_yoy` and `gdp_growth` dimensions specifically, and each state is mapped to an economic label using a simple quadrant rule (growth above/below its long-run median, inflation above/below its long-run median). This mirrors the classic Growth/Inflation quadrant framework used across macro investing.

| Growth | Inflation | Regime Label |
|---|---|---|
| Above trend | Above trend | Inflationary Expansion |
| Above trend | Below trend | Disinflationary Expansion |
| Below trend | Above trend | Stagflation |
| Below trend | Below trend | Recession / Disinflationary Contraction |

### 9.5 Allocation Engine

Rather than switching the portfolio abruptly when the most-likely regime flips, the allocator blends the regime-conditional target weights using the full probability vector — this avoids whipsaw trading around regime boundaries where the model is genuinely uncertain.

```python
# src/allocation/regime_allocator.py
import pandas as pd

REGIME_TARGETS = {
    'inflationary_expansion': {
        'equities': 0.45, 'commodities': 0.20, 'tips': 0.15,
        'nominal_bonds': 0.10, 'cash': 0.10},
    'disinflationary_expansion': {
        'equities': 0.60, 'commodities': 0.05, 'tips': 0.05,
        'nominal_bonds': 0.20, 'cash': 0.10},
    'stagflation': {
        'equities': 0.20, 'commodities': 0.25, 'tips': 0.20,
        'nominal_bonds': 0.10, 'cash': 0.25},
    'recession': {
        'equities': 0.15, 'commodities': 0.05, 'tips': 0.10,
        'nominal_bonds': 0.45, 'cash': 0.25},
}

def blend_allocation(regime_probs: pd.Series,
                      regime_targets: dict = REGIME_TARGETS) -> pd.Series:
    """Probability-weighted blend across regime target weights."""
    assets = next(iter(regime_targets.values())).keys()
    blended = {a: 0.0 for a in assets}
    for regime, prob in regime_probs.items():
        targets = regime_targets[regime]
        for asset, weight in targets.items():
            blended[asset] += prob * weight
    return pd.Series(blended)
```

### 9.6 Avoiding Look-Ahead Bias

- The HMM must be refit on a rolling or expanding window using only data available as of each rebalance date — never fit once on the full history and then evaluated retroactively.
- State labels (which integer maps to which economic regime) can flip between refits; the quadrant-based labeling rule in 9.4 must be reapplied at every refit, not cached from the first fit.
- FRED data revisions mean the GDP/CPI value available on a historical date differs from the final revised value seen today — for production-grade backtests, use FRED's ALFRED vintage data to reconstruct what was actually known at each point in time.

---

## 10. Visualizations & Dashboard Components

### 10.1 Regime Timeline

A horizontal timeline chart spanning the full sample, with the background shaded by the Viterbi-decoded most-likely regime at each month (e.g., one color per regime). Overlay the S&P 500 price line on top so the visual immediately communicates how each regime historically coincided with market performance.

### 10.2 Economic State Probabilities

A stacked area chart where, at every month, the four regime probabilities sum to 100% — this is the richest visualization in the platform, since it shows not just the current call but how confident the model is and how that confidence has evolved (e.g., probability of Recession climbing for several months before a regime flip is officially decoded).

### 10.3 Asset Allocation Over Time

A stacked area or stacked bar chart of the blended portfolio weights over time, directly driven by the probability-weighted allocation in section 9.5 — this should visually track the probability chart above it, making the allocation logic transparent and auditable.

### 10.4 Transition Matrix Heatmap

A K×K heatmap of the fitted transition matrix, showing the probability of moving from each regime to every other regime in a single period — useful for understanding regime persistence (diagonal dominance implies regimes are sticky, which is typical for macro data at monthly frequency).

### 10.5 Dashboard Layout (Streamlit)

```python
# dashboard/app.py — page structure

st.title('Macro Regime Detection Platform')

# --- Sidebar controls ---
country = st.sidebar.selectbox('Country', ['US'])
n_regimes = st.sidebar.slider('Number of regimes', 2, 6, 4)
lookback = st.sidebar.date_input('Start date', value='1990-01-01')

# --- Top row: current snapshot cards ---
col1, col2, col3 = st.columns(3)
col1.metric('Current Regime', 'Inflationary Expansion')
col2.metric('Probability', '78%')
col3.metric('Months in Regime', '4')

# --- Regime timeline + price overlay ---
st.plotly_chart(regime_timeline_fig)

# --- Probability stacked area ---
st.plotly_chart(regime_probability_fig)

# --- Allocation history ---
st.plotly_chart(allocation_history_fig)

# --- Transition matrix heatmap ---
st.plotly_chart(transition_matrix_fig)

# --- Backtest performance table ---
st.dataframe(performance_metrics_df)
```

---

## 11. Performance Metrics

The regime-driven strategy should be evaluated both as a standalone portfolio and against passive benchmarks, using a walk-forward backtest that refits the HMM out-of-sample to avoid look-ahead bias.

### 11.1 Return & Risk Metrics

| Metric | Purpose |
|---|---|
| CAGR | Annualized compounded return of the regime-driven portfolio |
| Annualized Volatility | Standard deviation of returns, annualized |
| Sharpe Ratio | Risk-adjusted return relative to a risk-free rate |
| Sortino Ratio | Risk-adjusted return penalizing only downside volatility |
| Maximum Drawdown | Largest peak-to-trough decline over the backtest |
| Calmar Ratio | CAGR divided by maximum drawdown |
| Turnover | Average monthly portfolio rebalancing activity (cost proxy) |

### 11.2 Regime-Specific Diagnostics

- Regime classification accuracy vs. NBER-dated recessions (treat NBER recession dates as a partial ground-truth check on the Recession regime, acknowledging the model is unsupervised and not trained to match NBER directly).
- Average regime duration and number of transitions — sanity-checks against excessive regime-flipping, which would indicate an unstable or overfit model.
- Log-likelihood and BIC across the state-count grid (model fit quality, see 9.3).
- Brier score on regime probability forecasts vs. realized regime one period ahead — a proper scoring rule for the quality of the probabilistic output, not just the point classification.

### 11.3 Benchmark Comparisons

| Benchmark | Description |
|---|---|
| 60/40 Portfolio | Static 60% SPY / 40% TLT, rebalanced monthly |
| Equal-Weight | Equal weight across the full asset universe |
| Buy-and-Hold SPY | Passive equity-only benchmark |
| Risk Parity | Inverse-volatility weighted static benchmark |

### 11.4 Backtest Methodology Notes

- Use a walk-forward (expanding or rolling) window: refit the HMM using only data up to each rebalance date, then apply the resulting regime call and allocation strictly out-of-sample for the next period.
- Apply realistic transaction costs (e.g., 5–10 bps per unit of turnover) since probability-weighted blending changes weights every period, even without a discrete regime flip.
- Report performance across distinct historical stress windows (2000–02, 2008–09, 2020, 2022) separately from full-sample aggregates, since aggregate Sharpe ratios can hide regime-specific failure modes.

---

## 12. Final Deliverables

### 12.1 Codebase

- Full repository per the architecture in Section 3, with ingestion, feature engineering, modeling, allocation, and backtest modules independently unit-tested.
- `config/regime_map.yaml` exposing the regime → allocation mapping as an editable, version-controlled artifact rather than a hardcoded constant.
- `requirements.txt` / `pyproject.toml` pinning hmmlearn, fredapi, yfinance, pandas, numpy, scipy, cvxpy, plotly, streamlit, scikit-learn, pytest.

### 12.2 Research Artifacts

- A model selection notebook documenting the BIC sweep over state counts and the final choice of K with justification.
- A regime interpretation table mapping each fitted hidden state to its economic label, derived from the Gaussian means per Section 9.4.
- A backtest report (notebook or generated PDF) with the full performance metrics table from Section 11 and per-stress-window breakdowns.

### 12.3 Interactive Dashboard

- A Streamlit application implementing all four visualizations from Section 10: regime timeline, probability stacked area, allocation history, and transition matrix heatmap.
- Sidebar controls allowing the user to adjust the regime count, lookback window, and asset universe without touching code.

### 12.4 Documentation

- README covering setup, FRED API key configuration, and how to run the end-to-end pipeline (`src/pipeline.py`) and dashboard.
- A methodology document explaining the HMM specification, regime labeling rule, allocation blending logic, and explicit list of look-ahead-bias safeguards (Section 9.6) for any future reviewer or auditor of the system.
- A known-limitations section: macro data revision risk, regime label instability across refits, and the unsupervised (not NBER-supervised) nature of the regime classification.

---