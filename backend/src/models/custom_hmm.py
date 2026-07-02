import numpy as np
import pandas as pd

def log_sum_exp(a, axis=None, keepdims=False):
    """Numerically stable log-sum-exp trick."""
    a_max = np.amax(a, axis=axis, keepdims=True)
    if not keepdims:
        a_max_reduced = np.amax(a, axis=axis, keepdims=False)
    else:
        a_max_reduced = a_max
    
    # Handle infinities gracefully
    if np.any(np.isinf(a_max)):
        # If all are -inf, return -inf
        # Otherwise, subtract the max ignoring infs
        a_max_clean = np.where(np.isinf(a_max), 0.0, a_max)
        res = a_max_reduced + np.log(np.sum(np.exp(a - a_max_clean), axis=axis, keepdims=keepdims))
    else:
        res = a_max_reduced + np.log(np.sum(np.exp(a - a_max), axis=axis, keepdims=keepdims))
        
    # Check for infs in the output and return a_max_reduced if sum is 0
    return np.where(np.isnan(res), a_max_reduced, res)

class GaussianHMM:
    def __init__(self, n_components=4, n_iter=100, tol=1e-4, random_state=42, cov_type='diag'):
        self.n_components = n_components
        self.n_iter = n_iter
        self.tol = tol
        self.random_state = random_state
        self.cov_type = cov_type  # 'diag' is the most stable and size-efficient
        
        # Parameters to fit
        self.startprob_ = None
        self.transmat_ = None
        self.means_ = None
        self.covars_ = None # variance vectors of shape (n_components, n_features) for diag
        
    def _init_params(self, X):
        """Deterministic initialization based on sorting and splitting the data."""
        rng = np.random.default_rng(self.random_state)
        n_samples, n_features = X.shape
        
        # 1. Initialize starting probabilities (near uniform with slight noise)
        self.startprob_ = np.ones(self.n_components) / self.n_components
        
        # 2. Initialize transition matrix (sticky diagonal: 0.8 on diagonal, 0.2/K distributed elsewhere)
        self.transmat_ = np.full((self.n_components, self.n_components), 0.2 / (self.n_components - 1))
        np.fill_diagonal(self.transmat_, 0.8)
        self.transmat_ /= self.transmat_.sum(axis=1, keepdims=True)
        
        # 3. Initialize means and variances
        # We sort the data by the first feature (typically growth or inflation momentum)
        # to segment it deterministically into K bins.
        sort_idx = np.argsort(X[:, 0])
        sorted_X = X[sort_idx]
        split_size = n_samples // self.n_components
        
        self.means_ = np.zeros((self.n_components, n_features))
        self.covars_ = np.zeros((self.n_components, n_features))
        
        for k in range(self.n_components):
            start_i = k * split_size
            end_i = (k + 1) * split_size if k < self.n_components - 1 else n_samples
            chunk = sorted_X[start_i:end_i]
            
            # Means: chunk average
            self.means_[k] = np.mean(chunk, axis=0)
            
            # Covariances: chunk variance + small offset to prevent singularity
            self.covars_[k] = np.var(chunk, axis=0) + 1e-2
            
    def _log_gaussian_pdf(self, X):
        """Compute log emission probabilities of shape (n_samples, n_components)."""
        n_samples, n_features = X.shape
        log_pdf = np.zeros((n_samples, self.n_components))
        
        for k in range(self.n_components):
            mean = self.means_[k]
            var = self.covars_[k]
            
            # For diagonal covariance matrix:
            # log_pdf = -0.5 * [ D * log(2*pi) + sum(log(var)) + sum( (x - mean)^2 / var ) ]
            log_det = np.sum(np.log(var))
            sq_err = np.sum(((X - mean) ** 2) / var, axis=1)
            log_pdf[:, k] = -0.5 * (n_features * np.log(2 * np.pi) + log_det + sq_err)
            
        return log_pdf
        
    def _forward(self, log_emissions):
        n_samples = log_emissions.shape[0]
        log_alpha = np.zeros((n_samples, self.n_components))
        
        # t = 0
        log_alpha[0] = np.log(self.startprob_ + 1e-15) + log_emissions[0]
        
        # t > 0
        log_trans = np.log(self.transmat_ + 1e-15)
        for t in range(1, n_samples):
            # log_alpha[t, j] = log_emission[t, j] + log_sum_exp(log_alpha[t-1, i] + log_trans[i, j])
            work = log_alpha[t-1][:, np.newaxis] + log_trans
            log_alpha[t] = log_emissions[t] + log_sum_exp(work, axis=0)
            
        return log_alpha
        
    def _backward(self, log_emissions):
        n_samples = log_emissions.shape[0]
        log_beta = np.zeros((n_samples, self.n_components))
        
        # t = T - 1 is initialized to 0 (log(1))
        log_beta[-1] = 0.0
        
        # t < T - 1
        log_trans = np.log(self.transmat_ + 1e-15)
        for t in range(n_samples - 2, -1, -1):
            # log_beta[t, i] = log_sum_exp(log_trans[i, j] + log_emission[t+1, j] + log_beta[t+1, j])
            work = log_trans + log_emissions[t+1] + log_beta[t+1]
            log_beta[t] = log_sum_exp(work, axis=1)
            
        return log_beta

    def fit(self, X):
        """Fit model using EM (Baum-Welch) algorithm."""
        if isinstance(X, pd.DataFrame):
            X_val = X.values
        else:
            X_val = np.asarray(X)
            
        self._init_params(X_val)
        
        old_logprob = -np.inf
        
        for i in range(self.n_iter):
            # E-step: Compute emissions, forward-backward variables, posteriors
            log_emissions = self._log_gaussian_pdf(X_val)
            log_alpha = self._forward(log_emissions)
            log_beta = self._backward(log_emissions)
            
            # Log likelihood is the sum of forward variables at T-1
            logprob = log_sum_exp(log_alpha[-1])
            
            # Convergence check
            if i > 0 and logprob - old_logprob < self.tol:
                break
            old_logprob = logprob
            
            # Smoothed state posteriors (gamma)
            log_gamma = log_alpha + log_beta
            log_gamma -= log_sum_exp(log_gamma, axis=1, keepdims=True)
            gamma = np.exp(log_gamma)
            
            # Transition posteriors (xi)
            # log_xi[t, i, j] = log_alpha[t, i] + log_trans[i, j] + log_emission[t+1, j] + log_beta[t+1, j] - logprob
            n_samples = X_val.shape[0]
            log_trans = np.log(self.transmat_ + 1e-15)
            
            log_xi = (log_alpha[:-1, :, np.newaxis] + 
                      log_trans[np.newaxis, :, :] + 
                      log_emissions[1:, np.newaxis, :] + 
                      log_beta[1:, np.newaxis, :])
            log_xi -= log_sum_exp(log_xi.reshape(n_samples - 1, -1), axis=1)[:, np.newaxis, np.newaxis]
            xi = np.exp(log_xi)
            
            # M-step: Update model parameters
            # startprob
            self.startprob_ = gamma[0] / np.sum(gamma[0])
            
            # transmat
            sum_xi = np.sum(xi, axis=0)
            sum_gamma_minus1 = np.sum(gamma[:-1], axis=0)[:, np.newaxis]
            self.transmat_ = sum_xi / (sum_gamma_minus1 + 1e-15)
            self.transmat_ /= self.transmat_.sum(axis=1, keepdims=True)
            
            # means and covars
            sum_gamma = np.sum(gamma, axis=0)
            for k in range(self.n_components):
                weights = gamma[:, k]
                self.means_[k] = np.sum(X_val * weights[:, np.newaxis], axis=0) / (sum_gamma[k] + 1e-15)
                diff = X_val - self.means_[k]
                self.covars_[k] = np.sum((diff ** 2) * weights[:, np.newaxis], axis=0) / (sum_gamma[k] + 1e-15) + 1e-5
                
        return self
        
    def predict_proba(self, X):
        """Compute state posteriors (forward-backward smoothed)."""
        if isinstance(X, pd.DataFrame):
            X_val = X.values
            index = X.index
        else:
            X_val = np.asarray(X)
            index = None
            
        log_emissions = self._log_gaussian_pdf(X_val)
        log_alpha = self._forward(log_emissions)
        log_beta = self._backward(log_emissions)
        
        log_gamma = log_alpha + log_beta
        log_gamma -= log_sum_exp(log_gamma, axis=1, keepdims=True)
        gamma = np.exp(log_gamma)
        
        if index is not None:
            cols = [f'state_{i}' for i in range(self.n_components)]
            return pd.DataFrame(gamma, index=index, columns=cols)
        return gamma
        
    def decode(self, X):
        """Compute the Viterbi decoded state path."""
        if isinstance(X, pd.DataFrame):
            X_val = X.values
            index = X.index
        else:
            X_val = np.asarray(X)
            index = None
            
        n_samples = X_val.shape[0]
        log_emissions = self._log_gaussian_pdf(X_val)
        
        # Viterbi DP table
        v = np.zeros((n_samples, self.n_components))
        ptr = np.zeros((n_samples, self.n_components), dtype=int)
        
        # Initial step
        v[0] = np.log(self.startprob_ + 1e-15) + log_emissions[0]
        
        log_trans = np.log(self.transmat_ + 1e-15)
        
        for t in range(1, n_samples):
            for j in range(self.n_components):
                # Maximize over previous states
                work = v[t-1] + log_trans[:, j]
                ptr[t, j] = np.argmax(work)
                v[t, j] = log_emissions[t, j] + work[ptr[t, j]]
                
        # Backtracking
        states = np.zeros(n_samples, dtype=int)
        states[-1] = np.argmax(v[-1])
        
        for t in range(n_samples - 2, -1, -1):
            states[t] = ptr[t+1, states[t+1]]
            
        if index is not None:
            return pd.Series(states, index=index, name='regime')
        return states
        
    def score(self, X):
        """Compute log-likelihood of observations."""
        if isinstance(X, pd.DataFrame):
            X_val = X.values
        else:
            X_val = np.asarray(X)
            
        log_emissions = self._log_gaussian_pdf(X_val)
        log_alpha = self._forward(log_emissions)
        return log_sum_exp(log_alpha[-1])
