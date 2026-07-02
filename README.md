# STRATOS: Macro Allocation Suite

STRATOS is an institutional-grade quantitative platform that utilizes unsupervised machine learning—specifically a custom **Gaussian Hidden Markov Model (HMM)**—to detect latent macroeconomic regimes and dynamically rebalance tactical asset allocation (TAA) portfolios in a walk-forward out-of-sample backtest.

The project is structured as a monorepo optimized for local development and serverless deployment:
* `backend/` — FastAPI REST API, custom NumPy Gaussian HMM solver, out-of-sample backtest engine, and processing scripts.
* `frontend/` — React single-page dashboard built with Vite, Recharts, and styled with high-luminance glassmorphic elements.

---

## 🚀 Key Features

* **Gaussian HMM Regime Classifier**: Trains continuous multivariate probability densities to map cycle phases (Inflationary Expansion, Disinflationary Growth, Stagflation, Recession) based on Inflation, GDP, Labor Slack, and Yield Curve slope metrics.
* **Walk-Forward Out-of-Sample Simulator**: Employs rolling validation matrices and holds asset weights strictly out-of-sample to ensure zero lookahead bias. Models rebalancing drag using 10 bps transaction costs.
* **Interactive Heatmaps & Diagnostics**: High-fidelity, mathematically proportioned transition probability grids with interactive cross-hover sync states, color-matched legends, and dynamic state descriptions.
* **Thread-Safe Log Interception**: Dynamically captures backend execution prints and streams color-coded pipeline logs into an interactive monospace console on the frontend.
* **Performance Code-Splitting**: Uses dynamic chunk loading to reduce initial landing bundle size by $74\%$.

---

## 📋 Prerequisites

Make sure you have the following installed on your system:
* **Python** (version 3.11 or later)
* **Node.js** (version 18 or later) and **npm**

---

## 🛠️ Step-by-Step Local Setup

### 1. Clone & Navigate
Navigate to your workspace directory:
```bash
cd Macro-Regime-Detection
```

### 2. Backend Setup
We recommend setting up a Python virtual environment to manage dependencies:
```powershell
# Create virtual env
python -m venv .venv

# Activate virtual env (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Install requirements
pip install -r backend/requirements.txt
```

#### Configure FRED API Key
By default, the platform runs offline using a simulated mock data generator. To use real economic data:
1. Obtain a free API key from the St. Louis Fed FRED API website.
2. Create a `.env.local` file inside the `backend/` folder:
   ```env
   FRED_API_KEY=your_actual_fred_api_key_here
   ```

### 3. Frontend Setup
Install npm packages and bootstrap build outputs:
```bash
npm run setup
```

---

## 🖥️ Running the Platform Locally

To run the entire application (both the FastAPI backend and React frontend dev server) concurrently on Windows, execute the batch script from the root workspace directory:

```powershell
.\run_dev.bat
```
This script starts both servers in their own separate terminal windows, allowing you to monitor logs and restart them independently.

Alternatively, you can run them concurrently in a single terminal using npm:
```bash
npm run dev
```

---

## 🧪 Running Tests & Pipelines

### Run the Pytest Suite
To verify the custom HMM convergence constraints, labeling accuracy, and backtester statistics:
```bash
python -m pytest backend/
```

### Manually Re-trigger Data Refresh & Backtest Pipeline
You can trigger a full pipeline fit either by clicking the **"Retrain Pipeline"** button on the dashboard UI, or running the script directly from your terminal:
```bash
python -m backend.src.pipeline
```
This updates processed caches stored locally that FastAPI endpoints read.

---

## ☁️ Deploying to Vercel

1. Install the Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```
2. Run deployment setup from the root directory:
   ```bash
   vercel
   ```
3. Set your environment variables in the Vercel project settings:
   * Key: `FRED_API_KEY`
   * Value: `your_fred_api_key_here`
4. Deploy to production:
   ```bash
   vercel --prod
   ```
