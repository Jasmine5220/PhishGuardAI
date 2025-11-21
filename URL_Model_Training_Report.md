# URL Phishing Model - Training Notebook Report

## Overview
- Goal: Train ML models to classify URLs as phishing vs non-phishing using handcrafted lexical/host/domain features.
- Notebook: `training.ipynb`
- Primary Models: RandomForestClassifier, GradientBoostingClassifier
- Dataset size: 54,807 rows, 31 columns (30 features + 1 label)

## Data Input
- Source CSV: `url_features_labeled (1).csv`
- Columns (int features):
  - UsingIp, longUrl, shortUrl, symbol, redirecting, prefixSuffix, SubDomains, HTTPS,
    DomainRegLen, Favicon, NonStdPort, HTTPSDomainURL, RequestURL, AnchorURL,
    LinksInScriptTags, ServerFormHandler, InfoEmail, AbnormalURL, WebsiteForwarding,
    StatusBarCust, DisableRightClick, UsingPopupWindow, IframeRedirection, AgeofDomain,
    DNSRecording, WebsiteTraffic, PageRank, GoogleIndex, LinksPointingToPage, StatsReport
  - Target: Label (values in {-1, 0, 1})

## Exploratory Analysis
- `data.shape`: 54,807 rows × 31 columns
- `data.info()`: all integer columns, no missing values
- Correlation heatmap and pairplots used to visualize feature relationships and class separation
- Class distribution (pie chart) computed from `data['Label'].value_counts()`

## Train/Test Split
- X = all features except `Label` (30 columns)
- y = `Label`
- Split: `train_test_split(test_size=0.2, random_state=42)`

## Model 1: Random Forest
- Config: `RandomForestClassifier(n_estimators=10)`
- Fit on training data
- Predictions: `y_train_forest`, `y_test_forest`
- Metrics computation uses a masking step:
  - Removes samples where label == 0 from both y_train and y_test
  - Maps -1 → 0 for binary metrics
- Results:
  - Accuracy (train): 1.000
  - Accuracy (test): 0.999
  - F1 (train): 1.000
  - F1 (test): 1.000
  - Recall (train): 1.000
  - Recall (test): 1.000
  - Precision (train): 1.000
  - Precision (test): 0.999
- Classification report on original labels:
  - For -1: precision 1.00, recall 1.00, f1 1.00 (support 3993)
  - For 0: precision 1.00, recall 0.98, f1 0.99 (support 205)
  - For 1: precision 1.00, recall 1.00, f1 1.00 (support 6764)
  - Accuracy: 1.00 across 10,962 test samples
- Confusion Matrix also plotted for the Random Forest model
- N-estimators sensitivity plot (1–20) shows very high performance across values

## Model 2: Gradient Boosting Classifier
- Config: `GradientBoostingClassifier(max_depth=4, learning_rate=0.7)`
- Results:
  - Accuracy (train): 1.000
  - Accuracy (test): 0.999
  - F1 (train): 0.996
  - F1 (test): 0.990
  - Recall (train): 0.997
  - Recall (test): 0.993
  - Precision (train): 0.995
  - Precision (test): 0.987
- Classification report confirms near-perfect metrics across classes
- Learning-rate sweep (0.1–0.9) plotted for train/test accuracy

## Model Comparison
Combined table (as printed):
- Random Forest — Accuracy: 0.999442, F1: 0.999557, Recall: 1.000000, Precision: 0.999114
- Gradient Boosting — Accuracy: 0.998632, F1: 0.989775, Recall: 0.992783, Precision: 0.986827
Bar chart plotted for Accuracy, F1, Recall, Precision comparing both models.

## Model Export and Inference
- Saved model: `random_forest_model.pkl` (via `pickle.dump(forest, ...)`)
- Inference demo:
  - `FeatureExtraction(url)` (from `feature.py`) produces a 30-length feature vector
  - RF `predict_proba(x)`: phishing prob = 1.0, non-phishing prob = 0.0 on the sample URL
  - RF `predict(x)`: -1 (interpreted as phishing)
  - Output message: "Caution! Suspicious website detected"

## Key Takeaways
- Both models achieve extremely high performance on this dataset; Random Forest slightly leads.
- Label schema {-1, 0, 1}: notebook’s metrics convert {-1→0} and exclude label 0 for binary scoring. The full classification report (three classes) remains near-perfect.
- Features include lexical indicators (length, symbols), structural (subdomains, ports, HTTPS), and search/authority signals (PageRank, GoogleIndex, WebsiteTraffic).
- Exported RF model integrates cleanly with `FeatureExtraction` for production use.

## Reproducibility Notes
- Random state fixed at 42 for train/test split.
- No missing data handling needed (dataset contains no nulls).
- Evaluation mixes masked binary metrics and multi-class report; keep this in mind when comparing.

## Artifacts
- Trained model: `random_forest_model.pkl`
- Feature generator: `feature.py: FeatureExtraction`
- Notebook visuals: correlation heatmap, pairplot, performance bars, confusion matrix.
