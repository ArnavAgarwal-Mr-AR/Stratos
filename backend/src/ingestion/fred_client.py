import json
import urllib.request
import urllib.parse
import time
import pandas as pd
from pathlib import Path
import os

class FredClient:
    def __init__(self, api_key: str = None, cache_dir: str = 'backend/data/raw'):
        self.api_key = api_key or os.getenv('FRED_API_KEY')
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.base_url = "https://api.stlouisfed.org/fred/series/observations"

    def get_series(self, series_id: str, start: str, end: str, use_cache: bool = True) -> pd.Series:
        """Fetch a single macroeconomic series from FRED with local caching."""
        cache_path = self.cache_dir / f'{series_id}.parquet'
        
        if use_cache and cache_path.exists():
            try:
                cached = pd.read_parquet(cache_path)['value']
                cached.index = pd.to_datetime(cached.index)
                # Filter index to date range
                return cached.loc[start:end]
            except Exception as e:
                # If cached file is corrupted, re-fetch
                pass

        if not self.api_key:
            raise ValueError(
                f"FRED API Key is required to fetch {series_id}. "
                "Set FRED_API_KEY environment variable or pass to constructor."
            )

        # Build URL
        params = {
            'series_id': series_id,
            'api_key': self.api_key,
            'file_type': 'json',
            'observation_start': start,
            'observation_end': end
        }
        url = f"{self.base_url}?{urllib.parse.urlencode(params)}"

        print(f"  [FRED API] Requesting series '{series_id}' ({start} to {end})...")
        t_start = time.time()
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
            
            observations = data.get('observations', [])
            dates = []
            values = []
            
            for obs in observations:
                # FRED returns '.' for missing observations
                val_str = obs['value']
                if val_str == '.':
                    continue
                dates.append(obs['date'])
                values.append(float(val_str))
                
            series = pd.Series(values, index=pd.to_datetime(dates), name='value')
            
            # Save to cache
            df = series.to_frame()
            df.to_parquet(cache_path)
            
            t_elapsed = time.time() - t_start
            print(f"  [FRED API] Loaded {len(observations)} observations for '{series_id}' in {t_elapsed:.2f}s.")
            return series
            
        except Exception as e:
            t_elapsed = time.time() - t_start
            print(f"  [FRED API ERROR] Failed to fetch series '{series_id}' after {t_elapsed:.2f}s: {e}")
            raise RuntimeError(f"Failed to fetch series {series_id} from FRED: {str(e)}")

    def get_indicator_panel(self, series_ids: list, start: str, end: str, use_cache: bool = True) -> pd.DataFrame:
        """Fetch multiple indicators and combine into a DataFrame."""
        frames = {}
        for sid in series_ids:
            try:
                frames[sid] = self.get_series(sid, start, end, use_cache=use_cache)
            except Exception as e:
                # If offline or key fails, raise to trigger fallback
                raise e
        # Aligns on datetime index
        return pd.DataFrame(frames)
