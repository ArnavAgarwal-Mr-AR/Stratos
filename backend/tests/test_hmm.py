import numpy as np
import pandas as pd
import pytest
from backend.src.models.custom_hmm import GaussianHMM
from backend.src.models.regime_labeler import RegimeLabeler

def test_gaussian_hmm_fit_and_decode():
    # Set random seed
    np.random.seed(42)
    
    # Generate mock 2D data with 4 distinct clusters (regimes)
    # Cluster 0: High growth, High inflation (+2, +2)
    # Cluster 1: High growth, Low inflation (+2, -2)
    # Cluster 2: Low growth, High inflation (-2, +2)
    # Cluster 3: Low growth, Low inflation (-2, -2)
    means = np.array([
        [2.0, 2.0],
        [2.0, -2.0],
        [-2.0, 2.0],
        [-2.0, -2.0]
    ])
    covs = np.array([
        [0.1, 0.1],
        [0.1, 0.1],
        [0.1, 0.1],
        [0.1, 0.1]
    ])
    
    # Sequence of states (stay in each state for 25 periods, then transition)
    true_states = np.concatenate([
        np.zeros(25, dtype=int),
        np.ones(25, dtype=int),
        np.ones(25, dtype=int) * 2,
        np.ones(25, dtype=int) * 3
    ])
    
    n_samples = len(true_states)
    X = np.zeros((n_samples, 2))
    for t in range(n_samples):
        s = true_states[t]
        X[t] = np.random.normal(means[s], np.sqrt(covs[s]))
        
    # Fit the HMM
    hmm = GaussianHMM(n_components=4, n_iter=50, random_state=42)
    hmm.fit(X)
    
    # Check shape of fitted parameters
    assert hmm.startprob_.shape == (4,)
    assert hmm.transmat_.shape == (4, 4)
    assert hmm.means_.shape == (4, 2)
    assert hmm.covars_.shape == (4, 2)
    
    # Decode states
    decoded_states = hmm.decode(X)
    assert len(decoded_states) == n_samples
    
    # Check that decoding is consistent (high overlap with true states after state alignment)
    # We map the fitted states to their nearest true states
    state_mapping = {}
    for s in range(4):
        # Find which true mean the fitted mean is closest to
        dist = np.sum((hmm.means_[s] - means) ** 2, axis=1)
        state_mapping[s] = np.argmin(dist)
        
    mapped_decoded = np.array([state_mapping[s] for s in decoded_states])
    accuracy = np.mean(mapped_decoded == true_states)
    
    # Accuracy should be very high (>= 90%) since clusters are well separated
    assert accuracy >= 0.90
    
    # Test predict_proba
    probs = hmm.predict_proba(X)
    assert probs.shape == (n_samples, 4)
    np.testing.assert_allclose(probs.sum(axis=1), 1.0, atol=1e-5)


def test_regime_labeler():
    # Fitted HMM means for 4 states in 2D space (growth, inflation)
    # State 0: High growth, High inflation
    # State 1: High growth, Low inflation
    # State 2: Low growth, High inflation
    # State 3: Low growth, Low inflation
    means = np.array([
        [1.5, 1.2],
        [1.1, -1.3],
        [-0.9, 1.4],
        [-1.2, -1.1]
    ])
    
    feature_names = ['gdp_growth', 'inflation_yoy']
    
    labeler = RegimeLabeler(growth_col='gdp_growth', inflation_col='inflation_yoy')
    labeler.fit(means, feature_names)
    
    # Check state to label mappings
    assert labeler.state_to_label_[0] == 'inflationary_expansion'
    assert labeler.state_to_label_[1] == 'disinflationary_expansion'
    assert labeler.state_to_label_[2] == 'stagflation'
    assert labeler.state_to_label_[3] == 'recession'
    
    # Test labeling a sequence
    states = [0, 0, 1, 2, 3, 2]
    labeled = labeler.label_series(states)
    assert labeled == [
        'inflationary_expansion',
        'inflationary_expansion',
        'disinflationary_expansion',
        'stagflation',
        'recession',
        'stagflation'
    ]
    
    # Test probability dataframe labeling
    probs = pd.DataFrame({
        'state_0': [0.8, 0.1],
        'state_1': [0.1, 0.7],
        'state_2': [0.05, 0.1],
        'state_3': [0.05, 0.1]
    })
    labeled_probs = labeler.label_probabilities(probs)
    assert 'inflationary_expansion' in labeled_probs.columns
    assert 'disinflationary_expansion' in labeled_probs.columns
    assert 'stagflation' in labeled_probs.columns
    assert 'recession' in labeled_probs.columns
    
    assert labeled_probs.loc[0, 'inflationary_expansion'] == 0.8
    assert labeled_probs.loc[1, 'disinflationary_expansion'] == 0.7
