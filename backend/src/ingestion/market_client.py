import yfinance as yf
import pandas as pd
import time
from pathlib import Path

class MarketClient:
    def __init__(self, cache_dir: str = 'backend/data/raw'):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_path = self.cache_dir / 'market_prices.parquet'

    def get_price_panel(self, tickers: list, start: str, end: str, use_cache: bool = True) -> pd.DataFrame:
        """Download asset prices from Yahoo Finance with local caching."""
        if use_cache and self.cache_path.exists():
            try:
                cached = pd.read_parquet(self.cache_path)
                cached.index = pd.to_datetime(cached.index)
                
                # Check if all tickers exist in cache and cover the requested range
                # We check index range
                cached_start = cached.index.min().strftime('%Y-%m-%d')
                cached_end = cached.index.max().strftime('%Y-%m-%d')
                
                all_tickers_cached = all(t in cached.columns for t in tickers)
                covers_range = (cached_start <= start) and (cached_end >= end or pd.to_datetime(cached_end) >= pd.to_datetime('today') - pd.Timedelta(days=2))
                
                if all_tickers_cached and covers_range:
                    return cached[tickers].loc[start:end].dropna(how='all')
            except Exception as e:
                pass

        # Fetch from Yahoo Finance
        print(f"  [Yahoo Finance] Downloading Close prices for tickers: {tickers} ({start} to {end})...")
        t_start = time.time()
        try:
            raw = yf.download(tickers, start=start, end=end, auto_adjust=True, progress=False)
            
            # yfinance return structure varies if single ticker or multiple
            if len(tickers) == 1:
                prices = raw['Close'].to_frame()
                prices.columns = tickers
            else:
                prices = raw['Close'] if 'Close' in raw else raw
                
            prices = prices.dropna(how='all')
            prices.index = pd.to_datetime(prices.index)
            
            # Save/Merge to cache
            if self.cache_path.exists():
                try:
                    existing = pd.read_parquet(self.cache_path)
                    existing.index = pd.to_datetime(existing.index)
                    # Combine without duplicates
                    combined = prices.combine_first(existing)
                    combined.to_parquet(self.cache_path)
                except:
                    prices.to_parquet(self.cache_path)
            else:
                prices.to_parquet(self.cache_path)
                
            t_elapsed = time.time() - t_start
            print(f"  [Yahoo Finance] Loaded {prices.shape[0]} daily quotes across {len(tickers)} assets in {t_elapsed:.2f}s.")
            return prices[tickers].loc[start:end]
            
        except Exception as e:
            # Fallback: if cache exists but doesn't cover range fully, return what we have
            if self.cache_path.exists():
                try:
                    cached = pd.read_parquet(self.cache_path)
                    cached.index = pd.to_datetime(cached.index)
                    available_tickers = [t for t in tickers if t in cached.columns]
                    if available_tickers:
                        return cached[available_tickers].loc[start:end].dropna(how='all')
                except:
                    pass
            raise RuntimeError(f"Failed to fetch market data from Yahoo Finance: {str(e)}")

    def get_monthly_returns(self, prices: pd.DataFrame) -> pd.DataFrame:
        """Resample daily prices to month-end and compute monthly returns."""
        # 'ME' stands for Month End resample
        monthly_prices = prices.resample('ME').last()
        return monthly_prices.pct_change().dropna()
