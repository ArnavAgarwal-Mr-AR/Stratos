# Stratos Macro Allocation Suite: Financial Dictionary & Metrics

This document defines the quantitative financial terms and risk-return performance metrics used in Stratos.

---

## 1. Return Metrics

### 1.1. Compound Annual Growth Rate (CAGR)
The annualized rate of geometric return that would get a portfolio from its starting value to its ending value:
$$\text{CAGR} = \left( \frac{V_{end}}{V_{start}} \right)^{\frac{12}{N}} - 1$$
where:
* $V_{start}$ is the initial portfolio value ($100$ base).
* $V_{end}$ is the final portfolio value.
* $N$ is the number of monthly periods in the backtest.
* *Interpretation*: Unlike simple arithmetic average return, CAGR accounts for compounding, presenting a realistic measure of annualized growth.

---

## 2. Risk Metrics

### 2.1. Annualized Volatility
A measure of the dispersion of returns, representing the portfolio's total risk:
$$\sigma_{annual} = \sigma_{monthly} \times \sqrt{12}$$
where:
* $\sigma_{monthly}$ is the standard deviation of monthly returns:
  $$\sigma_{monthly} = \sqrt{\frac{1}{T-1} \sum_{t=1}^T (R_t - \mu_R)^2}$$
* *Interpretation*: High volatility indicates larger price fluctuations, representing higher risk.

### 2.2. Maximum Drawdown (MDD)
The largest peak-to-trough drop in the portfolio's cumulative value before a new peak is achieved:
$$\text{Drawdown}_t = \frac{\text{Peak}_t - V_t}{\text{Peak}_t}$$
where $\text{Peak}_t = \max_{\tau \le t} (V_{\tau})$.
$$\text{MDD} = \max_{t} (\text{Drawdown}_t)$$
* *Interpretation*: MDD measures the worst-case loss scenario over the backtest period. It is a key metric for understanding risk tolerance.

---

## 3. Risk-Adjusted Return Metrics

### 3.1. Sharpe Ratio
The ratio of annualized excess return to annualized volatility:
$$\text{Sharpe} = \frac{\text{CAGR} - R_f}{\sigma_{annual}}$$
where:
* $R_f$ is the risk-free rate (assumed to be $0\%$ in Stratos).
* *Interpretation*: Measures the return generated per unit of total risk. A Sharpe ratio $> 1.0$ is generally considered good.

### 3.2. Sortino Ratio
A variation of the Sharpe ratio that penalizes only negative returns (downside volatility):
$$\text{Sortino} = \frac{\text{CAGR} - R_f}{\sigma_{downside}}$$
where $\sigma_{downside}$ is the annualized standard deviation of negative returns:
$$\sigma_{downside} = \sqrt{12 \times \frac{1}{T} \sum_{t=1}^T \min(0, R_t)^2}$$
* *Interpretation*: Since investors generally welcome positive volatility (upside spikes), the Sortino ratio provides a more accurate measure of downside risk-adjusted return.

### 3.3. Calmar Ratio
A measure of return relative to tail risk:
$$\text{Calmar} = \frac{\text{CAGR}}{|\text{MDD}|}$$
* *Interpretation*: A Calmar ratio $> 1.0$ indicates that the strategy's annualized return exceeded its maximum historical drawdown, showing strong recovery characteristics.

---

## 4. Trading Metrics

### 4.1. Average Monthly Turnover
A measure of how much the portfolio's allocations change from month to month:
$$\text{Turnover}_{t} = \sum_{i=1}^M \left| W_{t, i} - W_{t-1, i}^{post-return} \right|$$
$$\text{Avg. Monthly Turnover} = \frac{1}{T-1} \sum_{t=2}^T \text{Turnover}_t$$
* *Interpretation*: High turnover increases transaction costs and tax drag, making execution more challenging. Low turnover strategies are typically preferred.
