import numpy as np
import itertools

class RegimeLabeler:
    def __init__(self, growth_col='gdp_growth', inflation_col='inflation_yoy'):
        self.growth_col = growth_col
        self.inflation_col = inflation_col
        self.canonical_labels = [
            'inflationary_expansion',
            'disinflationary_expansion',
            'stagflation',
            'recession'
        ]
        self.state_to_label_ = {}
        self.label_to_state_ = {}

    def fit(self, state_means, feature_names):
        """
        Maps abstract HMM states to economic labels uniquely.
        
        Parameters:
        -----------
        state_means : np.ndarray
            Fitted HMM means of shape (n_components, n_features)
        feature_names : list
            List of feature names matching columns in feature panel
        """
        n_states = state_means.shape[0]
        
        # Find feature indices
        feature_names = list(feature_names)
        growth_idx = feature_names.index(self.growth_col)
        inflation_idx = feature_names.index(self.inflation_col)
        
        # Calculate affinity scores for all states and labels
        # Growth and inflation are standardized (Z-scored) features, so 0 is the midline.
        affinities = {}
        for s in range(n_states):
            g_val = state_means[s, growth_idx]
            i_val = state_means[s, inflation_idx]
            
            affinities[s] = {
                'inflationary_expansion': g_val + i_val,        # High growth, High inflation
                'disinflationary_expansion': g_val - i_val,      # High growth, Low inflation
                'stagflation': -g_val + i_val,                 # Low growth, High inflation
                'recession': -g_val - i_val                    # Low growth, Low inflation
            }
            
        # If we have exactly 4 states, we can run a permutation search to find the 1-to-1 matching
        # that maximizes total affinity.
        if n_states == 4:
            best_perm = None
            best_score = -np.inf
            
            # Generate all permutations of labels
            for perm in itertools.permutations(self.canonical_labels):
                # Score of this permutation
                score = sum(affinities[s][perm[s]] for s in range(4))
                if score > best_score:
                    best_score = score
                    best_perm = perm
                    
            self.state_to_label_ = {s: best_perm[s] for s in range(4)}
            self.label_to_state_ = {best_perm[s]: s for s in range(4)}
            
        else:
            # Fallback for K != 4: Simply label as state_0, state_1... to ensure uniqueness and prevent index issues
            self.state_to_label_ = {s: f"state_{s}" for s in range(n_states)}
            self.label_to_state_ = {f"state_{s}": s for s in range(n_states)}
            
        return self

    def label_series(self, states):
        """Map a series of integer states to economic labels."""
        if hasattr(states, 'map'):
            return states.map(self.state_to_label_)
        return [self.state_to_label_[s] for s in states]

    def label_probabilities(self, prob_df):
        """Rename columns of a probability dataframe from state_i to economic labels."""
        rename_map = {}
        for col in prob_df.columns:
            if col.startswith('state_'):
                state_idx = int(col.split('_')[1])
                rename_map[col] = self.state_to_label_.get(state_idx, col)
        return prob_df.rename(columns=rename_map)
