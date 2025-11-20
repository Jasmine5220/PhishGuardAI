"""
Script to generate the missing model files for PhishGuard AI.
This script creates minimal working models compatible with the app.
"""

import pickle
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline

def create_random_forest_model():
    """Create a minimal Random Forest model for URL classification"""
    print("Creating Random Forest model...")
    
    # Create a simple Random Forest classifier
    # The model expects 30 features (as per URL_FEATURE_NAMES in app.py)
    # Classes: -1 (phishing), 0 (suspicious), 1 (safe)
    
    # Create dummy training data to initialize the model
    # In production, this should be trained on real data
    n_samples = 100
    n_features = 30
    
    # Generate synthetic training data
    X_dummy = np.random.randint(-2, 2, size=(n_samples, n_features))
    y_dummy = np.random.choice([-1, 0, 1], size=n_samples)
    
    # Create and train the model
    forest = RandomForestClassifier(n_estimators=10, random_state=42)
    forest.fit(X_dummy, y_dummy)
    
    # Save the model
    with open('random_forest_model.pkl', 'wb') as f:
        pickle.dump(forest, f)
    
    print("✅ Random Forest model saved successfully!")
    print("   Note: This is a placeholder model. For production, train on real data.")
    return forest

def create_svm_email_model():
    """Create a minimal SVM model for email classification"""
    print("Creating SVM email classifier model...")
    
    # Create a pipeline with TF-IDF vectorizer and SVM
    # This matches the structure expected by app.py
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            max_features=1000,
            ngram_range=(1, 2),
            lowercase=True,
            strip_accents='unicode'
        )),
        ('svm', SVC(
            kernel='linear',
            C=1.0,
            probability=False,
            random_state=42
        ))
    ])
    
    # Create dummy training data to initialize the model
    # In production, this should be trained on real email data
    dummy_emails = [
        "This is a legitimate email about your account.",
        "URGENT: Verify your account now!",
        "Click here to claim your prize!",
        "Meeting scheduled for tomorrow at 2 PM.",
        "Your account has been suspended. Click to verify.",
        "Thank you for your purchase.",
        "Free money! No strings attached!",
        "Please review the attached document.",
    ] * 20  # Repeat to have enough samples
    
    dummy_labels = [0, 1, 1, 0, 1, 0, 1, 0] * 20  # 0 = safe, 1 = phishing
    
    # Train the pipeline
    pipeline.fit(dummy_emails, dummy_labels)
    
    # Save the model
    joblib.dump(pipeline, 'svm_email_classifier.pkl')
    
    print("✅ SVM email classifier model saved successfully!")
    print("   Note: This is a placeholder model. For production, train on real email data.")
    return pipeline

if __name__ == '__main__':
    print("=" * 60)
    print("PhishGuard AI - Model Generator")
    print("=" * 60)
    print()
    print("This script creates placeholder models for development.")
    print("For production use, train models on real datasets using the notebooks.")
    print()
    
    try:
        # Generate Random Forest model
        create_random_forest_model()
        print()
        
        # Generate SVM email model
        create_svm_email_model()
        print()
        
        print("=" * 60)
        print("✅ All models generated successfully!")
        print("=" * 60)
        print()
        print("Models saved in current directory:")
        print("  - random_forest_model.pkl")
        print("  - svm_email_classifier.pkl")
        print()
        print("You can now run the Flask app with: python app.py")
        
    except Exception as e:
        print(f"❌ Error generating models: {e}")
        import traceback
        traceback.print_exc()



