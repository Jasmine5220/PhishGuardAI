"""
PhishGuard AI - Flask Backend API
A sophisticated AI-powered system for phishing detection with explainable AI
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
import re
import urllib.parse
from urllib.parse import urlparse
import requests
from datetime import datetime
import json
import os
import sys
import pickle

app = Flask(__name__)
CORS(app)

# Global variables for models
email_model = None
url_model = None
tfidf_vectorizer = None

# Try to import FeatureExtraction from existing project code
FeatureExtraction = None
try:
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    phishing_detector_path = os.path.join(project_root, 'Phishing-detector')
    if phishing_detector_path not in sys.path:
        sys.path.insert(0, phishing_detector_path)
    from feature import FeatureExtraction as _FeatureExtraction
    FeatureExtraction = _FeatureExtraction
    print("✅ FeatureExtraction loaded from Phishing-detector/feature.py")
except Exception as _e:
    print(f"⚠️ Could not import FeatureExtraction: {_e}")

def load_models():
    """Load pre-trained models"""
    global email_model, url_model, tfidf_vectorizer
    
    try:
        # Load email classification model
        email_model_path = '../Phishing-detector/newmodel.pkl'
        if os.path.exists(email_model_path):
            email_model = joblib.load(email_model_path)
            print("✅ Email model loaded successfully")
        else:
            print("⚠️ Email model not found, using heuristic analysis")
            
        # Load URL model (trained RandomForest from training.ipynb)
        # Prefer random_forest_model.pkl; fallback to url_model.pkl if present
        candidate_paths = [
            '../Phishing-detector/random_forest_model.pkl',
            '../Phishing-detector/url_model.pkl',
            'random_forest_model.pkl'
        ]
        for p in candidate_paths:
            if os.path.exists(p):
                try:
                    with open(p, 'rb') as f:
                        url_model = pickle.load(f)
                    print(f"✅ URL model loaded successfully from {p}")
                    break
                except Exception as e:
                    print(f"⚠️ Failed to load URL model from {p}: {e}")
        if url_model is None:
            print("⚠️ URL model not found, using heuristic analysis")
            
    except Exception as e:
        print(f"❌ Error loading models: {str(e)}")
        print("🔄 Continuing with heuristic analysis only")

# Feature names aligned with training dataset order
URL_FEATURE_NAMES = [
    'UsingIp','longUrl','shortUrl','symbol','redirecting','prefixSuffix','SubDomains','HTTPS',
    'DomainRegLen','Favicon','NonStdPort','HTTPSDomainURL','RequestURL','AnchorURL','LinksInScriptTags',
    'ServerFormHandler','InfoEmail','AbnormalURL','WebsiteForwarding','StatusBarCust','DisableRightClick',
    'UsingPopupWindow','IframeRedirection','AgeofDomain','DNSRecording','WebsiteTraffic','PageRank',
    'GoogleIndex','LinksPointingToPage','StatsReport'
]

def analyze_url_with_model(url):
    """Analyze URL using trained ML model and FeatureExtraction if available."""
    if url_model is None or FeatureExtraction is None:
        return None
    try:
        obj = FeatureExtraction(url)
        features = obj.getFeaturesList()
        x = np.array(features).reshape(1, len(URL_FEATURE_NAMES))
        result = {
            'features_vector': dict(zip(URL_FEATURE_NAMES, [int(v) for v in features]))
        }
        proba = None
        if hasattr(url_model, 'predict_proba'):
            try:
                proba = url_model.predict_proba(x)[0]
            except Exception:
                proba = None
        pred = int(url_model.predict(x)[0])

        # Interpret prediction: in training, labels were {-1, 0, 1}
        # Map to risk score and label
        explanations = []
        if proba is not None and len(proba) >= 2:
            # Attempt to infer phishing probability: if classes_ available use index of -1 or 0
            phishing_prob = None
            if hasattr(url_model, 'classes_'):
                try:
                    # Prefer -1 as phishing; if absent, use 0
                    classes = list(url_model.classes_)
                    if -1 in classes:
                        phishing_prob = float(proba[classes.index(-1)])
                    elif 0 in classes:
                        phishing_prob = float(proba[classes.index(0)])
                except Exception:
                    phishing_prob = None
            if phishing_prob is None:
                phishing_prob = float(max(proba))
            risk_score = float(min(max(phishing_prob * 100.0, 0.0), 100.0))
        else:
            # Fallback mapping
            if pred == -1:
                risk_score = 90.0
            elif pred == 0:
                risk_score = 60.0
            else:
                risk_score = 10.0

        # Simple explainability based on key features
        fv = result['features_vector']
        if fv.get('UsingIp') == 1:
            explanations.append('URL uses an IP address instead of a domain')
        if fv.get('longUrl') == 1:
            explanations.append('URL is unusually long')
        if fv.get('prefixSuffix') == 1:
            explanations.append('URL contains prefix/suffix in domain (e.g., using -)')
        if fv.get('SubDomains', 0) > 1:
            explanations.append('URL contains multiple subdomains')
        if fv.get('HTTPS') == -1:
            explanations.append('URL does not use HTTPS')
        if fv.get('NonStdPort') == 1:
            explanations.append('URL uses a non-standard port')

        return {
            'risk_score': float(risk_score),
            'is_phishing': risk_score > 50.0,
            'confidence': float(min(risk_score / 10.0, 1.0)),
            'explanations': explanations,
            'features': fv,
            'model_pred': pred,
        }
    except Exception as e:
        print(f"URL ML analysis failed: {e}")
        return None

def extract_url_features(url):
    """Extract features from URL for analysis"""
    try:
        parsed_url = urlparse(url)
        
        features = {
            'url_length': len(url),
            'domain_length': len(parsed_url.netloc),
            'path_length': len(parsed_url.path),
            'query_length': len(parsed_url.query),
            'has_ip': bool(re.match(r'^\d+\.\d+\.\d+\.\d+', parsed_url.netloc)),
            'has_port': ':' in parsed_url.netloc,
            'has_https': parsed_url.scheme == 'https',
            'has_www': 'www.' in parsed_url.netloc.lower(),
            'subdomain_count': len(parsed_url.netloc.split('.')) - 2,
            'has_suspicious_keywords': any(keyword in url.lower() for keyword in [
                'secure', 'verify', 'update', 'confirm', 'account', 'login', 'bank'
            ]),
            'special_char_count': len(re.findall(r'[^a-zA-Z0-9.-]', url)),
            'digit_ratio': len(re.findall(r'\d', url)) / len(url) if url else 0,
            'vowel_ratio': len(re.findall(r'[aeiouAEIOU]', url)) / len(url) if url else 0
        }
        
        return features
    except Exception as e:
        print(f"Error extracting URL features: {str(e)}")
        return {}

def analyze_url_heuristics(url):
    """Heuristic analysis for URL phishing detection"""
    features = extract_url_features(url)
    
    risk_score = 0
    explanations = []
    
    # Length analysis
    if features.get('url_length', 0) > 100:
        risk_score += 20
        explanations.append("URL is unusually long (suspicious)")
    
    # IP address check
    if features.get('has_ip', False):
        risk_score += 30
        explanations.append("URL contains IP address instead of domain name")
    
    # HTTPS check
    if not features.get('has_https', False):
        risk_score += 15
        explanations.append("URL does not use HTTPS encryption")
    
    # Suspicious keywords
    if features.get('has_suspicious_keywords', False):
        risk_score += 25
        explanations.append("URL contains suspicious keywords")
    
    # Special characters
    if features.get('special_char_count', 0) > 5:
        risk_score += 20
        explanations.append("URL contains many special characters")
    
    # Subdomain analysis
    if features.get('subdomain_count', 0) > 3:
        risk_score += 15
        explanations.append("URL has many subdomains")
    
    # Normalize risk score
    risk_score = min(risk_score, 100)
    
    return {
        'risk_score': risk_score,
        'is_phishing': risk_score > 50,
        'confidence': min(risk_score / 10, 1.0),
        'explanations': explanations,
        'features': features
    }

def analyze_email_content(email_text):
    """Analyze email content for phishing indicators"""
    if not email_text:
        return {'error': 'No email content provided'}
    
    # Basic text preprocessing
    email_text = str(email_text).lower().strip()
    
    # Heuristic analysis
    risk_score = 0
    explanations = []
    
    # Urgency indicators
    urgency_words = ['urgent', 'immediately', 'asap', 'expires', 'limited time', 'act now']
    urgency_count = sum(1 for word in urgency_words if word in email_text)
    if urgency_count > 0:
        risk_score += urgency_count * 10
        explanations.append(f"Contains {urgency_count} urgency indicators")
    
    # Financial terms
    financial_words = ['money', 'cash', 'dollars', 'investment', 'guaranteed', 'profit']
    financial_count = sum(1 for word in financial_words if word in email_text)
    if financial_count > 0:
        risk_score += financial_count * 8
        explanations.append(f"Contains {financial_count} financial terms")
    
    # Suspicious phrases
    suspicious_phrases = [
        'click here', 'verify account', 'update information', 'confirm details',
        'suspended account', 'security breach', 'unusual activity'
    ]
    phrase_count = sum(1 for phrase in suspicious_phrases if phrase in email_text)
    if phrase_count > 0:
        risk_score += phrase_count * 12
        explanations.append(f"Contains {phrase_count} suspicious phrases")
    
    # Grammar and spelling errors (basic check)
    common_errors = ['recieve', 'seperate', 'definately', 'occured']
    error_count = sum(1 for error in common_errors if error in email_text)
    if error_count > 0:
        risk_score += error_count * 5
        explanations.append(f"Contains {error_count} common spelling errors")
    
    # Normalize risk score
    risk_score = min(risk_score, 100)
    
    return {
        'risk_score': risk_score,
        'is_phishing': risk_score > 40,
        'confidence': min(risk_score / 10, 1.0),
        'explanations': explanations
    }

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('index.html')

@app.route('/api/analyze_email', methods=['POST'])
def analyze_email():
    """Analyze email content for phishing"""
    try:
        data = request.get_json()
        email_text = data.get('email_text', '')
        
        if not email_text:
            return jsonify({'error': 'Email text is required'}), 400
        
        # Analyze email content
        analysis_result = analyze_email_content(email_text)
        
        # Add timestamp and metadata
        analysis_result.update({
            'timestamp': datetime.now().isoformat(),
            'analysis_type': 'email_content',
            'model_version': '1.0'
        })
        
        return jsonify(analysis_result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze_url', methods=['POST'])
def analyze_url():
    """Analyze URL for phishing"""
    try:
        data = request.get_json()
        url = data.get('url', '')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Analyze URL with ML model if available; fallback to heuristics
        analysis_result = analyze_url_with_model(url) or analyze_url_heuristics(url)
        
        # Add timestamp and metadata
        analysis_result.update({
            'timestamp': datetime.now().isoformat(),
            'analysis_type': 'url_analysis',
            'model_version': '1.0'
        })
        
        return jsonify(analysis_result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze_combined', methods=['POST'])
def analyze_combined():
    """Analyze both email content and URLs"""
    try:
        data = request.get_json()
        email_text = data.get('email_text', '')
        urls = data.get('urls', [])
        
        if not email_text and not urls:
            return jsonify({'error': 'Either email text or URLs are required'}), 400
        
        results = {
            'email_analysis': None,
            'url_analyses': [],
            'combined_risk_score': 0,
            'overall_prediction': 'safe',
            'explanations': [],
            'timestamp': datetime.now().isoformat(),
            'analysis_type': 'combined',
            'model_version': '1.0'
        }
        
        # Analyze email content
        if email_text:
            email_analysis = analyze_email_content(email_text)
            results['email_analysis'] = email_analysis
            results['combined_risk_score'] += email_analysis['risk_score']
            results['explanations'].extend(email_analysis['explanations'])
        
        # Analyze URLs
        if urls:
            for url in urls:
                url_analysis = analyze_url_with_model(url) or analyze_url_heuristics(url)
                results['url_analyses'].append({
                    'url': url,
                    'analysis': url_analysis
                })
                results['combined_risk_score'] += url_analysis['risk_score']
                results['explanations'].extend(url_analysis['explanations'])
        
        # Calculate overall prediction
        total_analyses = len([x for x in [email_text] if x]) + len(urls)
        if total_analyses > 0:
            avg_risk = results['combined_risk_score'] / total_analyses
            results['combined_risk_score'] = min(avg_risk, 100)
            results['overall_prediction'] = 'phishing' if avg_risk > 50 else 'safe'
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'models_loaded': {
            'email_model': email_model is not None,
            'url_model': url_model is not None
        }
    })

@app.route('/api/explanations', methods=['GET'])
def get_explanations():
    """Get explanation guidelines for users"""
    explanations = {
        'email_indicators': {
            'urgency': 'Emails creating artificial urgency are often phishing attempts',
            'financial': 'Promises of money or financial gains are common phishing tactics',
            'grammar': 'Poor grammar and spelling can indicate phishing emails',
            'suspicious_phrases': 'Common phrases used in phishing attempts'
        },
        'url_indicators': {
            'length': 'Unusually long URLs may indicate phishing',
            'ip_address': 'URLs with IP addresses instead of domain names are suspicious',
            'https': 'Lack of HTTPS encryption is a security concern',
            'special_chars': 'Many special characters can indicate malicious URLs'
        }
    }
    return jsonify(explanations)

if __name__ == '__main__':
    print("🚀 Starting PhishGuard AI Backend...")
    load_models()
    print("🌐 Server running on http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
