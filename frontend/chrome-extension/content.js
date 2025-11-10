// PhishGuard AI Chrome Extension - Content Script
// Analyzes emails and URLs in real-time on email platforms

class PhishGuardAnalyzer {
  constructor() {
    this.isAnalyzing = false;
    this.apiUrl = 'http://localhost:5000';
    this.init();
  }

  init() {
    console.log('PhishGuard AI Content Script loaded');
    this.injectStyles();
    this.setupEventListeners();
    this.analyzeExistingContent();
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .phishguard-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        margin-left: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      
      .phishguard-safe {
        background-color: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }
      
      .phishguard-warning {
        background-color: #fff3cd;
        color: #856404;
        border: 1px solid #ffeaa7;
      }
      
      .phishguard-danger {
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }
      
      .phishguard-analysis-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        display: none;
      }
      
      .phishguard-panel-header {
        background: #f8f9fa;
        padding: 15px;
        border-bottom: 1px solid #ddd;
        border-radius: 8px 8px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .phishguard-panel-content {
        padding: 20px;
      }
      
      .phishguard-panel-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
      }
      
      .phishguard-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
        display: none;
      }
      
      .phishguard-url-warning {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 4px;
        padding: 8px;
        margin: 4px 0;
        font-size: 12px;
      }
      
      .phishguard-url-danger {
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        padding: 8px;
        margin: 4px 0;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  setupEventListeners() {
    // Listen for new emails being loaded
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          this.analyzeNewContent(mutation.addedNodes);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Handle clicks on analysis badges
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('phishguard-badge')) {
        e.preventDefault();
        this.showAnalysisPanel(e.target.dataset.analysisId);
      }
    });

    // Close panel when clicking overlay
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('phishguard-overlay')) {
        this.hideAnalysisPanel();
      }
    });
  }

  analyzeExistingContent() {
    // Analyze emails already on the page
    const emailElements = this.getEmailElements();
    emailElements.forEach((element, index) => {
      this.analyzeEmailElement(element, `existing-${index}`);
    });
  }

  analyzeNewContent(nodes) {
    nodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const emailElements = node.querySelectorAll ? 
          node.querySelectorAll('[data-message-id], .email-content, .message-content') : [];
        
        emailElements.forEach((element, index) => {
          this.analyzeEmailElement(element, `new-${Date.now()}-${index}`);
        });
      }
    });
  }

  getEmailElements() {
    // Gmail selectors
    const gmailSelectors = [
      '[data-message-id]',
      '.email-content',
      '.message-content',
      '[role="main"] [data-thread-id]'
    ];
    
    // Outlook selectors
    const outlookSelectors = [
      '.ms-ConversationHeader',
      '.ms-MessageList-item',
      '[data-automation-id="message-item"]'
    ];
    
    const allSelectors = [...gmailSelectors, ...outlookSelectors];
    const elements = [];
    
    allSelectors.forEach(selector => {
      const found = document.querySelectorAll(selector);
      elements.push(...found);
    });
    
    return elements;
  }

  async analyzeEmailElement(element, analysisId) {
    if (this.isAnalyzing) return;
    
    this.isAnalyzing = true;
    
    try {
      const emailText = this.extractEmailText(element);
      const urls = this.extractUrls(element);
      
      if (!emailText && urls.length === 0) {
        this.isAnalyzing = false;
        return;
      }

      const analysis = await this.analyzeContent(emailText, urls);
      this.displayAnalysis(element, analysis, analysisId);
      
    } catch (error) {
      console.error('Error analyzing email:', error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  extractEmailText(element) {
    // Extract text content from email element
    const textContent = element.textContent || element.innerText || '';
    
    // Clean up the text
    return textContent
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000); // Limit text length
  }

  extractUrls(element) {
    const urls = [];
    const links = element.querySelectorAll('a[href]');
    
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && this.isValidUrl(href)) {
        urls.push(href);
      }
    });
    
    // Also extract URLs from text content
    const textContent = element.textContent || '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const textUrls = textContent.match(urlRegex) || [];
    
    textUrls.forEach(url => {
      if (this.isValidUrl(url)) {
        urls.push(url);
      }
    });
    
    return [...new Set(urls)]; // Remove duplicates
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  async analyzeContent(emailText, urls) {
    try {
      const response = await fetch(`${this.apiUrl}/api/analyze_combined`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_text: emailText,
          urls: urls
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error analyzing content:', error);
      return { error: 'Failed to analyze content' };
    }
  }

  displayAnalysis(element, analysis, analysisId) {
    if (analysis.error) {
      console.error('Analysis error:', analysis.error);
      return;
    }

    const riskScore = analysis.combined_risk_score || 0;
    const isPhishing = analysis.overall_prediction === 'phishing';
    
    let badgeClass = 'phishguard-safe';
    let badgeText = 'SAFE';
    
    if (riskScore > 70) {
      badgeClass = 'phishguard-danger';
      badgeText = 'PHISHING';
    } else if (riskScore > 30) {
      badgeClass = 'phishguard-warning';
      badgeText = 'SUSPICIOUS';
    }

    // Create badge
    const badge = document.createElement('span');
    badge.className = `phishguard-badge ${badgeClass}`;
    badge.textContent = badgeText;
    badge.dataset.analysisId = analysisId;
    badge.title = `Risk Score: ${riskScore.toFixed(1)}% - Click for details`;

    // Store analysis data
    badge.dataset.analysis = JSON.stringify(analysis);

    // Insert badge into email element
    const header = element.querySelector('.email-header, .message-header, [data-testid="message-header"]') || element;
    header.appendChild(badge);

    // Add URL warnings if any URLs are suspicious
    if (analysis.url_analyses && analysis.url_analyses.length > 0) {
      analysis.url_analyses.forEach(urlAnalysis => {
        if (urlAnalysis.analysis.risk_score > 50) {
          this.addUrlWarning(element, urlAnalysis.url, urlAnalysis.analysis);
        }
      });
    }
  }

  addUrlWarning(element, url, analysis) {
    const warning = document.createElement('div');
    warning.className = analysis.risk_score > 70 ? 'phishguard-url-danger' : 'phishguard-url-warning';
    warning.innerHTML = `
      <strong>⚠️ Suspicious URL Detected:</strong><br>
      ${url}<br>
      <small>Risk Score: ${analysis.risk_score.toFixed(1)}%</small>
    `;
    
    // Insert warning before the email content
    element.insertBefore(warning, element.firstChild);
  }

  showAnalysisPanel(analysisId) {
    const badge = document.querySelector(`[data-analysis-id="${analysisId}"]`);
    if (!badge) return;

    const analysis = JSON.parse(badge.dataset.analysis);
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'phishguard-overlay';
    overlay.style.display = 'block';
    
    // Create panel
    const panel = document.createElement('div');
    panel.className = 'phishguard-analysis-panel';
    panel.style.display = 'block';
    
    const riskScore = analysis.combined_risk_score || 0;
    const isPhishing = analysis.overall_prediction === 'phishing';
    
    let statusClass = 'phishguard-safe';
    let statusText = 'SAFE';
    let statusIcon = '✅';
    
    if (riskScore > 70) {
      statusClass = 'phishguard-danger';
      statusText = 'PHISHING DETECTED';
      statusIcon = '🚨';
    } else if (riskScore > 30) {
      statusClass = 'phishguard-warning';
      statusText = 'SUSPICIOUS';
      statusIcon = '⚠️';
    }

    panel.innerHTML = `
      <div class="phishguard-panel-header">
        <h3>${statusIcon} PhishGuard AI Analysis</h3>
        <button class="phishguard-panel-close">&times;</button>
      </div>
      <div class="phishguard-panel-content">
        <div class="${statusClass}" style="padding: 15px; border-radius: 5px; margin-bottom: 15px;">
          <h4>${statusText}</h4>
          <p><strong>Risk Score:</strong> ${riskScore.toFixed(1)}%</p>
        </div>
        
        ${analysis.email_analysis ? `
          <h5>📧 Email Analysis</h5>
          <p><strong>Risk Score:</strong> ${analysis.email_analysis.risk_score.toFixed(1)}%</p>
        ` : ''}
        
        ${analysis.url_analyses && analysis.url_analyses.length > 0 ? `
          <h5>🔗 URL Analysis</h5>
          ${analysis.url_analyses.map(urlAnalysis => `
            <div style="margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
              <strong>URL:</strong> ${urlAnalysis.url}<br>
              <strong>Risk Score:</strong> ${urlAnalysis.analysis.risk_score.toFixed(1)}%
            </div>
          `).join('')}
        ` : ''}
        
        ${analysis.explanations && analysis.explanations.length > 0 ? `
          <h5>💡 Explanations</h5>
          <ul>
            ${analysis.explanations.map(explanation => `<li>${explanation}</li>`).join('')}
          </ul>
        ` : ''}
        
        <div style="margin-top: 20px; font-size: 12px; color: #666;">
          <strong>Analyzed:</strong> ${new Date(analysis.timestamp).toLocaleString()}
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    
    // Close button functionality
    panel.querySelector('.phishguard-panel-close').onclick = () => {
      this.hideAnalysisPanel();
    };
  }

  hideAnalysisPanel() {
    const overlay = document.querySelector('.phishguard-overlay');
    const panel = document.querySelector('.phishguard-analysis-panel');
    
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }
}

// Initialize the analyzer when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PhishGuardAnalyzer();
  });
} else {
  new PhishGuardAnalyzer();
}
