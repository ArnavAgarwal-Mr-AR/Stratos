import numpy as np
import pandas as pd

class MockDataEngine:
    def __init__(self, random_state: int = 42):
        self.rng = np.random.default_rng(random_state)
        # States: 0=inflationary_expansion, 1=disinflationary_expansion, 2=stagflation, 3=recession
        self.n_states = 4
        
        # Sticky transition matrix (regimes are persistent)
        self.trans_matrix = np.array([
            [0.92, 0.05, 0.02, 0.01],  # from inf_exp
            [0.05, 0.93, 0.01, 0.01],  # from disinf_exp
            [0.02, 0.02, 0.91, 0.05],  # from stagflation
            [0.01, 0.02, 0.07, 0.90]   # from recession
        ])
        
    def _generate_state_sequence(self, n_months: int) -> np.ndarray:
        """Simulate underlying Markov chain states."""
        states = np.zeros(n_months, dtype=int)
        # Start in Disinflationary Expansion (most common state historically)
        current_state = 1
        states[0] = current_state
        
        for t in range(1, n_months):
            probs = self.trans_matrix[current_state]
            current_state = self.rng.choice(self.n_states, p=probs)
            states[t] = current_state
            
        return states

    def generate_macro_data(self, start_date: str, end_date: str) -> pd.DataFrame:
        """
        Generate realistic monthly macro indicator levels:
        - CPIAUCSL: Consumer Price Index (level)
        - GDPC1: Real GDP (level, generated monthly then resampled quarterly/filled)
        - UNRATE: Unemployment Rate (level)
        - T10Y2Y: 10Y-2Y Treasury Yield Spread (level)
        """
        dates = pd.date_range(start=start_date, end=end_date, freq='ME')
        n_months = len(dates)
        
        states = self._generate_state_sequence(n_months)
        
        # Base levels at start
        cpi = 130.0
        gdp = 7000.0
        unrate = 5.5
        
        cpi_list = []
        gdp_list = []
        unrate_list = []
        spread_list = []
        
        # State-conditional emission parameters (means and stds of monthly changes/levels)
        # Growth and Inflation here represent the target annualized growth rates
        # 0: inf_exp (growth=3.5%, inf=4.5%)
        # 1: disinf_exp (growth=3.0%, inf=1.8%)
        # 2: stagflation (growth=-0.5%, inf=5.5%)
        # 3: recession (growth=-3.5%, inf=0.5%)
        
        for t in range(n_months):
            s = states[t]
            
            # 1. CPI Growth (YoY trend -> monthly growth rate)
            if s == 0:
                inf_rate = self.rng.normal(0.045 / 12, 0.01 / 12)
            elif s == 1:
                inf_rate = self.rng.normal(0.018 / 12, 0.005 / 12)
            elif s == 2:
                inf_rate = self.rng.normal(0.055 / 12, 0.012 / 12)
            else: # Recession
                inf_rate = self.rng.normal(0.005 / 12, 0.01 / 12)
                
            cpi = cpi * (1 + inf_rate)
            cpi_list.append(cpi)
            
            # 2. GDP Growth (QoQ trend -> monthly growth rate)
            if s == 0:
                growth_rate = self.rng.normal(0.035 / 12, 0.01 / 12)
            elif s == 1:
                growth_rate = self.rng.normal(0.030 / 12, 0.008 / 12)
            elif s == 2:
                growth_rate = self.rng.normal(-0.005 / 12, 0.01 / 12)
            else: # Recession
                growth_rate = self.rng.normal(-0.035 / 12, 0.015 / 12)
                
            gdp = gdp * (1 + growth_rate)
            gdp_list.append(gdp)
            
            # 3. Unemployment Rate (Level drift)
            if s == 0:
                unrate_drift = self.rng.normal(-0.08, 0.05)  # falling
            elif s == 1:
                unrate_drift = self.rng.normal(-0.04, 0.04)  # falling slightly
            elif s == 2:
                unrate_drift = self.rng.normal(0.08, 0.08)   # rising
            else: # Recession
                unrate_drift = self.rng.normal(0.20, 0.12)   # rising rapidly
                
            unrate = np.clip(unrate + unrate_drift, 3.2, 12.0)
            unrate_list.append(unrate)
            
            # 4. Yield Curve Spread (T10Y2Y level)
            if s == 0:
                spread = self.rng.normal(0.2, 0.2)   # flat-ish
            elif s == 1:
                spread = self.rng.normal(1.5, 0.3)   # steep
            elif s == 2:
                spread = self.rng.normal(-0.1, 0.15) # inverted
            else: # Recession
                spread = self.rng.normal(0.8, 0.4)   # steepening (bull steepener)
                
            spread_list.append(spread)
            
        macro_df = pd.DataFrame({
            'CPIAUCSL': cpi_list,
            'GDPC1': gdp_list,
            'UNRATE': unrate_list,
            'T10Y2Y': spread_list
        }, index=dates)
        
        # Real GDP (GDPC1) is reported quarterly in the real world.
        # We simulate this by nulling out 2 out of every 3 months of GDPC1 to make it quarterly.
        # Then, features code will resample/forward-fill it.
        # GDPC1 is typically reported on the first month of the quarter for the previous quarter.
        # Let's keep GDPC1 on quarter ends (Mar, Jun, Sep, Dec) and set other months to NaN.
        macro_df['GDPC1'] = macro_df['GDPC1'].where(macro_df.index.month.isin([3, 6, 9, 12]), np.nan)
        
        return macro_df

    def generate_market_data(self, tickers: list, start_date: str, end_date: str) -> pd.DataFrame:
        """
        Generate daily asset prices (SPY, TLT, IEF, TIP, GLD, DBC, SHY)
        whose returns are statistically conditioned on the active macroeconomic state.
        """
        dates = pd.date_range(start=start_date, end=end_date, freq='B') # Business days
        n_days = len(dates)
        
        # Map daily dates to their respective month indices to find the monthly state
        monthly_dates = pd.date_range(start=start_date, end=end_date, freq='ME')
        states_monthly = self._generate_state_sequence(len(monthly_dates))
        
        # Create a mapping of year-month to state
        ym_to_state = {f"{d.year}-{d.month:02d}": states_monthly[i] for i, d in enumerate(monthly_dates)}
        
        # Initialize prices at 100
        prices = {t: [100.0] for t in tickers}
        
        # Define daily state-conditional returns (annualized mean / 252, annualized std / sqrt(252))
        # SPY, TLT, IEF, TIP, GLD, DBC, SHY
        # 0: inf_exp, 1: disinf_exp, 2: stagflation, 3: recession
        means = {
            0: {'SPY': 0.10, 'TLT': -0.05, 'IEF': -0.02, 'TIP': 0.08, 'GLD': 0.12, 'DBC': 0.20, 'SHY': 0.03},
            1: {'SPY': 0.18, 'TLT': 0.06, 'IEF': 0.04, 'TIP': 0.02, 'GLD': 0.00, 'DBC': 0.02, 'SHY': 0.03},
            2: {'SPY': -0.10, 'TLT': -0.12, 'IEF': -0.06, 'TIP': 0.05, 'GLD': 0.15, 'DBC': 0.25, 'SHY': 0.04},
            3: {'SPY': -0.22, 'TLT': 0.15, 'IEF': 0.08, 'TIP': 0.04, 'GLD': 0.06, 'DBC': -0.15, 'SHY': 0.04}
        }
        
        stds = {
            0: {'SPY': 0.15, 'TLT': 0.12, 'IEF': 0.07, 'TIP': 0.08, 'GLD': 0.14, 'DBC': 0.18, 'SHY': 0.01},
            1: {'SPY': 0.12, 'TLT': 0.10, 'IEF': 0.06, 'TIP': 0.06, 'GLD': 0.12, 'DBC': 0.14, 'SHY': 0.01},
            2: {'SPY': 0.22, 'TLT': 0.16, 'IEF': 0.09, 'TIP': 0.09, 'GLD': 0.16, 'DBC': 0.22, 'SHY': 0.015},
            3: {'SPY': 0.25, 'TLT': 0.14, 'IEF': 0.08, 'TIP': 0.08, 'GLD': 0.15, 'DBC': 0.25, 'SHY': 0.015}
        }
        
        for d_idx in range(1, n_days):
            date = dates[d_idx]
            ym = f"{date.year}-{date.month:02d}"
            # Get current state, default to 1 (disinf_exp) if missing (e.g. edge month)
            state = ym_to_state.get(ym, 1)
            
            for t in tickers:
                m = means[state][t] / 252.0
                s = stds[state][t] / np.sqrt(252.0)
                daily_ret = self.rng.normal(m, s)
                
                new_price = prices[t][-1] * (1 + daily_ret)
                prices[t].append(new_price)
                
        market_df = pd.DataFrame(prices, index=dates)
        return market_df
