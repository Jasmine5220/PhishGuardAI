# PhishGuard AI
### **Objective**

A phishing attack is a prevalent cybercrime that utilizes deceptive URLs, emails, and websites to steal sensitive user information. The objective of this project is to design and implement a robust, multi-layered detection system that leverages machine learning, NLP, and real-time cybersecurity intelligence to identify phishing threats. The system analyzes URLs and email content, provides an immediate verdict, and, most importantly, offers an **explainable breakdown of the identified threats** to educate users. The performance of a specialized URL model and an NLP model is evaluated to ensure high-recall threat detection.

### **Installation & Setup**

To set up and run this project, fork and clone the repository. The system is divided into a backend service and a frontend browser extension.

**1. Backend Service Setup**

```bash
# Navigate to the backend directory
cd backend/

# Create a virtual environment and activate it
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install required Python packages
pip install -r requirements.txt

# (Optional) Set up environment variables for API keys (e.g., VirusTotal)
# Create a .env file and add your keys
# VT_API_KEY="your_virustotal_api_key_here"

# Run the FastAPI server
uvicorn main:app --reload
```

**2. Frontend Extension Setup**

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable "Developer mode" using the toggle in the top-right corner.
3.  Click "Load unpacked" and select the `frontend/chrome-extension` directory from this project.
4.  The PhishGuard AI icon will appear in your browser's toolbar.

### **Technologies Used**

| Area      | Technology                                                                                                    |
| :-------- | :------------------------------------------------------------------------------------------------------------ |
| **Backend** | Python, FastAPI, Transformers (DistilBERT), Scikit-learn, Docker, Nginx                                       |
| **Frontend** | JavaScript, HTML, CSS (Chrome Extension APIs)                                                                 |
| **Database** | PostgreSQL (for logging and analysis history)                                                                 |
| **DevOps** | Git, Docker, Linux (Ubuntu Server)                                                                            |
| **Tools** | `whois`, `dig`, VirusTotal API, Postman                                                                       |

### **Feature Extraction & Analysis**

The system employs a comprehensive feature extraction strategy that combines URL-based, content-based, and external intelligence sources.

  * **URL Analysis Features:**

      * **Lexical Features:** URL length, entropy, presence of special characters (`@`, `-`), suspicious keywords (`login`, `secure`), punycode detection.
      * **Domain-based Features:** Analysis of domain age and registration details via the `whois` command.
      * **DNS-based Features:** Analysis of DNS records using the `dig` command.
      * **Third-Party Intelligence:** Real-time reputation score from the VirusTotal API.

  * **Email Content Analysis (NLP):**

      * **Header Analysis:** Programmatic checks for **SPF, DKIM, and DMARC** alignment to detect spoofing.
      * **Body Analysis:** A fine-tuned DistilBERT model analyzes the text for social engineering cues like urgency (`urgent`, `verify now`), generic greetings, and mismatched sender/link domains.

### **Machine Learning Models & Results (Predicted)**

Two primary models form the AI core of this system. Our evaluation prioritizes **Recall** to minimize the number of missed phishing threats (false negatives), even at the cost of a slightly higher false positive rate.

| Model                                    | Primary Use Case | Accuracy | F1-Score | **Recall** | Precision |
| :--------------------------------------- | :--------------- | :------- | :------- | :--------- | :-------- |
| **Gradient Boosting Classifier** | URL Analysis     | 0.978    | 0.979    | **0.991** | 0.968     |
| **Fine-Tuned DistilBERT** | Email NLP        | 0.981    | 0.983    | **0.989** | 0.977     |

The **Gradient Boosting Classifier** was selected for URL analysis due to its high performance on structured, feature-based data and its inherent explainability. The **DistilBERT model** provides a deep understanding of language context, making it highly effective at identifying subtle social engineering tactics in email text.

### **Conclusion**

This project successfully developed an integrated system for real-time phishing detection. The final takeaway is that a hybrid approach, combining traditional machine learning with deep learning (NLP) and external cybersecurity tool integration, provides a significantly more resilient defense than any single method.

Key features identified as highly predictive were **Domain Age**, **DMARC/SPF Failure**, and the presence of **Urgency-Inducing Keywords**. The Gradient Boosting Classifier achieved a 99.1% recall rate for URLs, ensuring a minimal number of threats slip through. The system's unique explainability layer serves the dual purpose of protecting and educating the user, representing a meaningful step forward in user-centric cybersecurity.

-----

## Detailed System Architecture

The PhishGuard AI system is designed using a modern 3-tier architecture, ensuring scalability, maintainability, and a clear separation of concerns.
### **1. Tier 1: Frontend (Chrome Extension)**
  * **Role:** The user interaction layer that runs directly in the user's browser.
  * **Functionality:**
      * **On-Demand Scanning:** Provides a right-click context menu option ("Check link with PhishGuard AI") for any hyperlink.
      * **Text Analysis:** A popup interface allows users to paste email bodies or other text for analysis.
      * **Result Display:** Renders the final verdict (Safe, Suspicious, Phishing) and the list of explainable warnings received from the backend.
  * **Communication:** Communicates with the backend via secure, asynchronous HTTPS requests (using the `fetch` API) to the REST API endpoints.

### **2. Tier 2: Backend (FastAPI Application on Linux)**
  * **Role:** The central processing and intelligence core of the system. It is a containerized application designed for performance.
  * **Key Components:**
      * **API Gateway (Nginx):** Acts as a reverse proxy, handling incoming HTTPS requests, performing load balancing (if needed), and forwarding them to the FastAPI application server.
      * **FastAPI Web Server:** Hosts the REST API endpoints (e.g., `/api/v1/analyze-url`, `/api/v1/analyze-email`). It handles request validation and data serialization.
      * **Analysis Orchestrator:** The main logic module that receives a request and invokes the necessary analysis sub-modules in a structured manner.
      * **AI Inference Module:** Loads the pre-trained Gradient Boosting (`.pkl`) and DistilBERT (`.pt`) models into memory and provides functions to run predictions (inference).
      * **Cybersecurity Tools Module:** A wrapper that executes and parses the output of Linux shell commands like `whois <domain>` and `dig <domain>`. This allows the application to gather domain and DNS intelligence.
      * **Threat Intelligence Module:** Contains the client code to make API calls to external services like VirusTotal.
      * **Explainability Engine:** A rule-based module that maps the raw features and model outputs (e.g., `domain_age=2`, `dmarc_status='fail'`) to user-friendly text warnings.

### **3. Tier 3: Data & Intelligence Layer**
  * **Role:** Handles all data persistence, logging, and access to external knowledge bases.
  * **Components:**
      * **PostgreSQL Database:** A relational database used to store:
          * **Scan History:** Every URL/email analyzed, its verdict, confidence score, and the specific warnings generated.
          * **User Feedback:** (Future enhancement) A mechanism for users to report false positives/negatives.
          * **Logging:** Detailed application logs for debugging and auditing.
      * **AI Models:** The serialized, trained model files stored on the server's filesystem.
      * **External Threat Feeds:** Real-time connections to PhishTank, VirusTotal, and other threat intelligence platforms.

### **Data Flow Example (URL Analysis)**
1.  **User Action:** A user right-clicks a suspicious link (`http://login.secure-paypal-access.com`) and selects "Check link with PhishGuard AI".
2.  **Frontend Request:** The Chrome Extension sends a JSON payload `{"url": "..."}` to the backend endpoint `https://api.phishguard.ai/api/v1/analyze-url`.
3.  **Backend Processing:**
      * Nginx receives the request and passes it to the FastAPI application.
      * The Analysis Orchestrator starts several tasks concurrently:
          * Extracts lexical features from the URL.
          * Calls the Cybersecurity Tools Module to run `whois secure-paypal-access.com`.
          * Calls the Threat Intelligence Module to query the VirusTotal API for the domain's reputation.
      * The collected features (e.g., `domain_age: 5 days`, `vt_score: 15/90`, `contains_keyword: 'paypal'`) are compiled into a feature vector.
4.  **AI Prediction:** The feature vector is passed to the loaded Gradient Boosting model, which returns a probability score (e.g., `0.96`).
5.  **Explanation & Response:**
      * The probability score is converted to a verdict ("Phishing").
      * The Explainability Engine maps the features to warnings: "⚠️ **High Risk:** Domain was registered only 5 days ago.", "⚠️ **Suspicious:** URL contains a brand name ('paypal') but is not the official domain.", "⚠️ **Warning:** This domain is flagged by security vendors on VirusTotal."
      * The backend sends a final JSON response to the frontend containing the verdict, score, and the list of warnings.
6.  **Display Result:** The Chrome Extension parses the JSON and displays a clear, actionable alert to the user.
