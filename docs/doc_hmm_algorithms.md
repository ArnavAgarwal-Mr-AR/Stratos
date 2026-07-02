# Stratos Macro Allocation Suite: HMM & Core Algorithms

This document provides a mathematical and algorithmic deep dive into the **Hidden Markov Model (HMM)** engine driving Stratos' macroeconomic regime detection.

---

## 1. Unsupervised HMM Representation

The core problem is to model a sequence of observable multi-dimensional macro feature vectors $X = \{x_1, x_2, \dots, x_T\}$ (where $x_t \in \mathbb{R}^D$) as emissions from an unobserved sequence of latent regimes $Q = \{q_1, q_2, \dots, q_T\}$ (where $q_t \in \{s_1, \dots, s_K\}$).

![HMM State Transition Infographic](file:///C:/Users/arumy/.gemini/antigravity-ide/brain/08637a1b-932b-4d7b-9d14-68bd23867bab/hmm_states_diagram_1782976307916.png)

An HMM is parameterized by a tuple $\lambda = (\pi, A, \theta)$:
1. **Initial State Probability Vector** $\pi = \{\pi_i\}$:
   $$\pi_i = P(q_1 = s_i)$$
2. **Transition Probability Matrix** $A = \{a_{ij}\}$:
   $$a_{ij} = P(q_{t+1} = s_j \mid q_t = s_i)$$
   where $\sum_{j=1}^K a_{ij} = 1$ for all rows $i$.
3. **Continuous Emission Parameters** $\theta_k = (\mu_k, \Sigma_k)$ for each state $k$:
   Since our indicators are continuous, the probability density function of observation $x_t$ given state $s_k$ is modeled as a multivariate Gaussian:
   $$b_k(x_t) = P(x_t \mid q_t = s_k) = \frac{1}{(2\pi)^{D/2}|\Sigma_k|^{1/2}} \exp\left(-\frac{1}{2}(x_t - \mu_k)^T \Sigma_k^{-1} (x_t - \mu_k)\right)$$
   Stratos enforces a diagonal covariance matrix ($\Sigma_k = \text{diag}(\sigma_{k,1}^2, \dots, \sigma_{k,D}^2)$) to prevent overfitting and avoid singularities in high-dimensional feature spaces.

---

## 2. Model Fitting: The Baum-Welch (EM) Algorithm

Fitting the model involves finding the parameters $\lambda^* = \arg\max_\lambda P(X \mid \lambda)$ that maximize the likelihood of observing our macro data. Because the states are hidden, we use the Expectation-Maximization (Baum-Welch) algorithm.

### 2.1. The Forward-Backward Procedure
We define forward variables $\alpha_t(i)$ and backward variables $\beta_t(i)$:
* **Forward Variable**: The probability of the partial observation sequence up to time $t$ and state $s_i$ at time $t$:
  $$\alpha_t(i) = P(x_1, \dots, x_t, q_t = s_i \mid \lambda)$$
  * *Initialization*: $\alpha_1(i) = \pi_i b_i(x_1)$
  * *Induction*: $\alpha_{t+1}(j) = \left[ \sum_{i=1}^K \alpha_t(i) a_{i5} \right] b_j(x_{t+1})$
* **Backward Variable**: The probability of the partial observation sequence from $t+1$ to $T$, given state $s_i$ at time $t$:
  $$\beta_t(i) = P(x_{t+1}, \dots, x_T \mid q_t = s_i, \lambda)$$
  * *Initialization*: $\beta_T(i) = 1$
  * *Induction*: $\beta_t(i) = \sum_{j=1}^K a_{ij} b_j(x_{t+1}) \beta_{t+1}(j)$

### 2.2. Expectation Step (E-Step)
Using $\alpha$ and $\beta$, we calculate the posterior probabilities of being in state $s_i$ at time $t$ ($\gamma_t(i)$), and the joint posterior of transitioning from state $s_i$ to $s_j$ between $t$ and $t+1$ ($\xi_t(i,j)$):
$$\gamma_t(i) = P(q_t = s_i \mid X, \lambda) = \frac{\alpha_t(i)\beta_t(i)}{\sum_{j=1}^K \alpha_t(j)\beta_t(j)}$$
$$\xi_t(i,j) = P(q_t = s_i, q_{t+1} = s_j \mid X, \lambda) = \frac{\alpha_t(i) a_{ij} b_j(x_{t+1}) \beta_{t+1}(j)}{\sum_{r=1}^K \sum_{c=1}^K \alpha_t(r) a_{rc} b_c(x_{t+1}) \beta_{t+1}(c)}$$

### 2.3. Maximization Step (M-Step)
We update the HMM parameters by taking expected value averages:
$$\bar{\pi}_i = \gamma_1(i)$$
$$\bar{a}_{ij} = \frac{\sum_{t=1}^{T-1} \xi_t(i,j)}{\sum_{t=1}^{T-1} \gamma_t(i)}$$
$$\bar{\mu}_k = \frac{\sum_{t=1}^T \gamma_t(k) x_t}{\sum_{t=1}^T \gamma_t(k)}$$
$$\bar{\Sigma}_k = \frac{\sum_{t=1}^T \gamma_t(k) (x_t - \bar{\mu}_k)(x_t - \bar{\mu}_k)^T}{\sum_{t=1}^T \gamma_t(k)}$$

To prevent division-by-zero or flatline standard deviations in short historical windows, Stratos checks for a **minimum covariance threshold** ($1\times 10^{-4}$), clamping flatlines to a small positive constant.

---

## 3. Sequence Decoding: The Viterbi Algorithm

To find the single most likely path of hidden regimes $Q^* = \{q_1^*, \dots, q_T^*\}$ over history, we use the Viterbi algorithm. It uses dynamic programming to accumulate log-probabilities and avoid numerical underflow.

1. **Initialization**:
   $$V_1(i) = \ln \pi_i + \ln b_i(x_1)$$
   $$\psi_1(i) = 0$$
2. **Recursion** (for $t = 2, \dots, T$):
   $$V_t(j) = \max_{1 \le i \le K} \left[ V_{t-1}(i) + \ln a_{ij} \right] + \ln b_j(x_t)$$
   $$\psi_t(j) = \arg\max_{1 \le i \le K} \left[ V_{t-1}(i) + \ln a_{ij} \right]$$
3. **Termination**:
   $$P^* = \max_{1 \le i \le K} [V_T(i)]$$
   $$q_T^* = \arg\max_{1 \le i \le K} [V_T(i)]$$
4. **Backtracking** (for $t = T-1, T-2, \dots, 1$):
   $$q_t^* = \psi_{t+1}(q_{t+1}^*)$$

---

## 4. Unsupervised State-to-Regime Mapping

Because HMM training is unsupervised, the states are returned as numeric indices (e.g. `State 0`, `State 1`). Stratos runs a deterministic classification layer to label these states according to macroeconomic quadrants (Inflation vs Growth):

![Macroeconomic Regimes Infographic](file:///C:/Users/arumy/.gemini/antigravity-ide/brain/08637a1b-932b-4d7b-9d14-68bd23867bab/macro_regimes_diagram_1782976278237.png)

1. The algorithm isolates the Gaussian mean parameters for the two most dominant features:
   * **Growth Mean**: $\mu_{gdp}$ (representing quarterly real GDP momentum).
   * **Inflation Mean**: $\mu_{inf}$ (representing YoY CPI changes).
2. If $K=4$, the algorithm evaluates the vectors to map each state index to a quadrant:
   * **Stagflation**: Low Growth ($\mu_{gdp} < 0$), High Inflation ($\mu_{inf} > 0$).
   * **Recession**: Low Growth ($\mu_{gdp} < 0$), Low Inflation ($\mu_{inf} < 0$).
   * **Disinflationary Growth**: High Growth ($\mu_{gdp} > 0$), Low Inflation ($\mu_{inf} < 0$).
   * **Inflationary Expansion**: High Growth ($\mu_{gdp} > 0$), High Inflation ($\mu_{inf} > 0$).
3. If $K$ is not 4, the algorithm sorts states by their growth and inflation coefficients and names them sequentially (e.g. *Low Growth / High Inflation*).
