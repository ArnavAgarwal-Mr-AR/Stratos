# Stratos Macro Allocation Suite: Walk-Forward Backtesting & Execution

This document details the simulation mechanics, boundary conditions, and execution rules of the **Walk-Forward Out-of-Sample (OOS) Backtester** in Stratos.

---

## 1. The Walk-Forward Framework

In quantitative finance, evaluating a trading strategy using a single in-sample model fit leads to **overfitting** and **lookahead bias** (using future information to make past trading decisions). 

To prevent this, Stratos uses a **sliding window validation model**:

![Walk-Forward In-Sample vs Out-of-Sample Diagram](file:///C:/Users/arumy/.gemini/antigravity-ide/brain/08637a1b-932b-4d7b-9d14-68bd23867bab/walk_forward_diagram_1782976291604.png)

1. **Initial Boundary**:
   The backtest starts at a date $T_{start} = D_{first} + 36\text{ months}$ (warm-up window). The warm-up window is required to accumulate enough historical data to stabilize the HMM's covariance estimates.
2. **In-Sample Fit**:
   At each month $t$ (where $t \ge T_{start}$), the HMM is fit on the historical data slice $[D_{first}, t]$. The future dates $[t+1, T_{end}]$ are masked from the model.
3. **Current State Inference**:
   The fitted parameters $\theta_t$ are used to estimate the **current posterior probability vector** (regime membership) for month $t$:
   $$\gamma_t(k) = P(q_t = s_k \mid X_{D_{first}:t}, \theta_t)$$
4. **Target Blending**:
   The asset allocation weights for the upcoming period $t+1$ are calculated by multiplying the posterior probabilities with the user's allocation matrix:
   $$W_{t+1} = \sum_{k=1}^K \gamma_t(k) \cdot W_{regime\_k}$$
5. **Roll Forward**:
   The simulation records the return of the blended portfolio for month $t+1$, advances the clock by $1$ month ($t = t+1$), and repeats the process.

This process ensures that every portfolio allocation is made **strictly out-of-sample**, using only data available at that moment in time.

---

## 2. Transaction Costs & Portfolio Rebalancing Drag

Realistic backtests must account for trading costs. Portfolio rebalancing triggers trades that incur brokerage fees, bid-ask spreads, and market impact. Stratos models these costs as a flat **Turnover Penalty** ($10\text{ bps}$):

### 2.1. Dynamic Turnover Calculation
At the end of month $t$, the portfolio's assets grow by their respective returns, changing the actual asset weights:
$$W_{t, i}^{post-return} = \frac{W_{t, i} \cdot (1 + R_{t+1, i})}{1 + R_{t+1, portfolio}}$$
where:
* $R_{t+1, i}$ is the return of asset $i$ during month $t+1$.
* $R_{t+1, portfolio} = \sum_{j} W_{t, j} R_{t+1, j}$ is the total portfolio return.

When rebalancing to the new target weights $W_{t+1}$, the required trading volume (turnover) is:
$$\text{Turnover}_{t+1} = \sum_{i=1}^M \left| W_{t+1, i} - W_{t, i}^{post-return} \right|$$

### 2.2. Cost Application
The net portfolio return for month $t+1$, after transaction costs, is:
$$R_{t+1, portfolio}^{net} = R_{t+1, portfolio} - c \times \text{Turnover}_{t+1}$$
where $c$ is the transaction cost coefficient (defaulting to $0.0010$, or $10\text{ basis points}$).

---

## 3. Handling Asset Launch Boundaries & Missing Data

When evaluating a multi-asset universe (e.g. `SPY`, `TLT`, `GLD`, `DBC`), the backtest is constrained by the **launch date of the youngest asset**:
* If `GLD` (launched in 2004) and `DBC` (launched in 2006) are selected, the backtest cannot start prior to 2006 because historical returns for `DBC` do not exist.
* The system automatically identifies the latest inception date among the selected assets and adds a $36$-month HMM warm-up window to establish the start date of the backtest.
* **Passive Benchmarks** (like Buy-and-Hold SPY or the 60/40 Portfolio) are sliced to cover the exact same time window to ensure a fair comparison.
