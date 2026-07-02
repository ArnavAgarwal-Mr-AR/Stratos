import os
import json
import sys
import io
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load environment variables from .env or .env.local in backend directory
backend_dir = Path(__file__).resolve().parent.parent
for env_file in ['.env', '.env.local']:
    env_path = backend_dir / env_file
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)

# Try to import pipeline; handle path issues
try:
    from backend.src.pipeline import MacroRegimePipeline
except ModuleNotFoundError:
    import sys
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from backend.src.pipeline import MacroRegimePipeline

app = FastAPI(
    title="Macro Regime Detection Platform API",
    description="REST API serving regime classification, portfolio weights, and backtest diagnostics.",
    version="1.0.0"
)

# CORS middleware for local frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper to find paths dynamically (Vercel serverless has a read-only filesystem except /tmp)
def get_data_paths():
    is_vercel = os.getenv('VERCEL') == '1'
    tmp_dir = Path("/tmp")
    local_dir = Path(__file__).parent.parent / "data" / "processed"
    
    if is_vercel:
        model_path = tmp_dir / "model_results.json"
        backtest_path = tmp_dir / "backtest_results.json"
    else:
        model_path = local_dir / "model_results.json"
        backtest_path = local_dir / "backtest_results.json"
        
    # If neither exists (e.g. running locally for the first time without running pipeline), 
    # we trigger a build write to local or /tmp depending on Vercel
    if not model_path.exists() or not backtest_path.exists():
        out_dir = tmp_dir if is_vercel else local_dir
        print(f"Cache not found. Generating in-memory fallback to {out_dir}...")
        pipeline = MacroRegimePipeline(output_dir=str(out_dir))
        pipeline.run(force_mock=True)
        
        model_path = tmp_dir / "model_results.json" if is_vercel else local_dir / "model_results.json"
        backtest_path = tmp_dir / "backtest_results.json" if is_vercel else local_dir / "backtest_results.json"
        
    return model_path, backtest_path

def load_json_data(file_path: Path):
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read data cache: {str(e)}")

PIPELINE_RUNNING = False
LATEST_ERROR = None
PIPELINE_LOGS = []

class LogStream(io.StringIO):
    def __init__(self, logs_list):
        super().__init__()
        self.logs_list = logs_list
    
    def write(self, s):
        s_clean = s.strip()
        if s_clean:
            for line in s_clean.split('\n'):
                line_stripped = line.strip()
                if line_stripped:
                    self.logs_list.append(line_stripped)
        sys.__stdout__.write(s)
        
    def flush(self):
        sys.__stdout__.flush()

# Background task to run pipeline without blocking HTTP thread
def run_pipeline_task(force_mock: bool, start_date: str = None, end_date: str = None,
                      n_regimes: int = None, tickers: list = None, regime_map: dict = None):
    global PIPELINE_RUNNING, LATEST_ERROR, PIPELINE_LOGS
    PIPELINE_RUNNING = True
    LATEST_ERROR = None
    PIPELINE_LOGS.clear()
    
    # Redirect stdout to capture logs dynamically
    stream = LogStream(PIPELINE_LOGS)
    old_stdout = sys.stdout
    sys.stdout = stream
    
    try:
        is_vercel = os.getenv('VERCEL') == '1'
        out_dir = "/tmp" if is_vercel else "backend/data/processed"
        pipeline = MacroRegimePipeline(output_dir=out_dir)
        pipeline.run(
            force_mock=force_mock,
            start_date=start_date,
            end_date=end_date,
            n_regimes=n_regimes,
            tickers=tickers,
            regime_map=regime_map
        )
    except Exception as e:
        import traceback
        LATEST_ERROR = traceback.format_exc()
        print(f"Background task failed:\n{LATEST_ERROR}")
    finally:
        sys.stdout = old_stdout
        PIPELINE_RUNNING = False

class RunPipelineRequest(BaseModel):
    start_date: str = None
    end_date: str = None
    n_regimes: int = None
    tickers: list = None
    regime_map: dict = None
    force_mock: bool = False

@app.get("/api/status")
def get_status():
    global PIPELINE_RUNNING, LATEST_ERROR
    model_path, _ = get_data_paths()
    data = load_json_data(model_path)
    snapshot = data.get('snapshot', {})
    
    return {
        "status": "healthy",
        "is_running": PIPELINE_RUNNING,
        "latest_error": LATEST_ERROR,
        "logs": PIPELINE_LOGS,
        "as_of_date": snapshot.get('as_of_date'),
        "is_mock_data": snapshot.get('is_mock_data', True),
        "engine": "FastAPI + NumPy Custom HMM (Vercel-Optimized)"
    }

@app.get("/api/regime/current")
def get_current_regime():
    model_path, _ = get_data_paths()
    data = load_json_data(model_path)
    return data.get('snapshot', {})

@app.get("/api/regime/history")
def get_regime_history():
    _, backtest_path = get_data_paths()
    data = load_json_data(backtest_path)
    
    # Return dates, probabilities series, and decoded regime series
    return {
        "dates": data.get("dates"),
        "regime_history": data.get("regime_history"),
        "probabilities": data.get("probabilities", {}).get("data", {})
    }

@app.get("/api/allocation/history")
def get_allocation_history():
    _, backtest_path = get_data_paths()
    data = load_json_data(backtest_path)
    return data.get("allocations", {})

@app.get("/api/backtest")
def get_backtest_results():
    _, backtest_path = get_data_paths()
    data = load_json_data(backtest_path)
    return {
        "dates": data.get("dates"),
        "cumulative_returns": data.get("cumulative_returns"),
        "drawdowns": data.get("drawdowns"),
        "metrics": data.get("metrics")
    }

@app.get("/api/model/diagnostics")
def get_model_diagnostics():
    model_path, _ = get_data_paths()
    data = load_json_data(model_path)
    return {
        "transition_matrix": data.get("transition_matrix"),
        "feature_profiles": data.get("feature_profiles"),
        "regime_labels": data.get("regime_labels"),
        "feature_names": data.get("feature_names")
    }

@app.post("/api/pipeline/run")
def trigger_pipeline(request: RunPipelineRequest, background_tasks: BackgroundTasks):
    global PIPELINE_RUNNING
    if PIPELINE_RUNNING:
        raise HTTPException(status_code=409, detail="Pipeline is already running in the background.")
        
    PIPELINE_RUNNING = True
    background_tasks.add_task(
        run_pipeline_task, 
        request.force_mock,
        request.start_date,
        request.end_date,
        request.n_regimes,
        request.tickers,
        request.regime_map
    )
    return {"message": "Pipeline run started in the background."}
