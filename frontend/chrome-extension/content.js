// PhishGuard AI Chrome Extension - Content Script
// Analyzes emails and URLs in real-time on email platforms

class PhishGuardAnalyzer {
  constructor() {
    this.isAnalyzing = new Set(); // Track analyzing elements by ID
    this.apiUrl = 'http://localhost:5000';
    this.analyzedElements = new Set(); // Track already analyzed elements
    this.enabled = true;
    this.init();
  }

  async init() {
    console.log('PhishGuard AI Content Script loaded');
    await this.loadSettings();
    this.injectStyles();
    this.setupEventListeners();
    this.analyzeExistingContent();
    
    // Re-analyze when email view changes (Gmail specific)
    this.setupGmailObserver();
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['enabled'], (result) => {
        this.enabled = result.enabled !== false;
        console.log('PhishGuard enabled:', this.enabled);
        resolve();
      });
    });
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
    if (!this.enabled) return;

    // Listen for new emails being loaded
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
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

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) {
        this.enabled = changes.enabled.newValue !== false;
        if (this.enabled) {
          this.analyzeExistingContent();
        }
      }
    });
  }

  setupGmailObserver() {
    // Gmail-specific: Watch for email view changes
    if (window.location.hostname.includes('mail.google.com')) {
      // Observe URL changes (Gmail uses pushState)
      let lastUrl = location.href;
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          // Wait a bit for Gmail to load the email content
          setTimeout(() => {
            this.analyzeExistingContent();
          }, 1000);
        }
      }).observe(document, { subtree: true, childList: true });

      // Also check periodically for new email content
      setInterval(() => {
        if (this.enabled) {
          this.analyzeExistingContent();
        }
      }, 3000);
    }
  }

  analyzeExistingContent() {
    if (!this.enabled) return;
    
    // Analyze emails already on the page
    const emailElements = this.getEmailElements();
    console.log(`Found ${emailElements.length} email elements to analyze`);
    
    emailElements.forEach((element, index) => {
      const elementId = this.getElementId(element);
      if (!this.analyzedElements.has(elementId)) {
        this.analyzeEmailElement(element, `existing-${elementId}`);
      }
    });
  }

  analyzeNewContent(nodes) {
    if (!this.enabled) return;
    
    nodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Better Gmail selectors
        const gmailEmail = node.querySelector ? 
          node.querySelector('[role="main"] [role="article"], .nH.if, .a3s, [data-message-id]') : null;
        
        if (gmailEmail) {
          const elementId = this.getElementId(gmailEmail);
          if (!this.analyzedElements.has(elementId)) {
            this.analyzeEmailElement(gmailEmail, `new-${Date.now()}-${elementId}`);
          }
        }
        
        // Check if the node itself is an email element
        if (this.isEmailElement(node)) {
          const elementId = this.getElementId(node);
          if (!this.analyzedElements.has(elementId)) {
            this.analyzeEmailElement(node, `new-${Date.now()}-${elementId}`);
          }
        }
      }
    });
  }

  getElementId(element) {
    // Create a unique ID for the element
    if (element.dataset.messageId) {
      return element.dataset.messageId;
    }
    if (element.id) {
      return element.id;
    }
    // Use a combination of text content hash
    const text = element.textContent || '';
    return `email-${text.substring(0, 50).replace(/\s/g, '')}`;
  }

  isEmailElement(element) {
    // Check if element looks like an email container
    if (!element || !element.classList) return false;
    
    // Gmail indicators
    if (element.getAttribute('role') === 'article' || 
        element.classList.contains('nH') ||
        element.querySelector('[data-message-id]')) {
      return true;
    }
    
    // Outlook indicators
    if (element.classList.contains('ms-MessageList-item') ||
        element.getAttribute('data-automation-id') === 'message-item') {
      return true;
    }
    
    return false;
  }

  getEmailElements() {
    const elements = [];
    
    // Gmail selectors (updated for current Gmail structure)
    if (window.location.hostname.includes('mail.google.com')) {
      // Main email view
      const mainEmail = document.querySelector('[role="main"] [role="article"]');
      if (mainEmail) {
        elements.push(mainEmail);
      }
      
      // Email list items
      const emailItems = document.querySelectorAll('[role="main"] [role="article"], [data-message-id]');
      emailItems.forEach(item => {
        if (!elements.includes(item)) {
          elements.push(item);
        }
      });
      
      // Email content area
      const emailContent = document.querySelector('.a3s, .ii.gt, [role="main"] .nH.if');
      if (emailContent && !elements.includes(emailContent)) {
        elements.push(emailContent);
      }
    }
    
    // Outlook selectors
    if (window.location.hostname.includes('outlook')) {
      const outlookEmails = document.querySelectorAll(
        '.ms-MessageList-item, [data-automation-id="message-item"], .ms-ConversationHeader'
      );
      outlookEmails.forEach(email => {
        if (!elements.includes(email)) {
          elements.push(email);
        }
      });
    }
    
    // Fallback: try common selectors
    if (elements.length === 0) {
      const fallback = document.querySelectorAll('[data-message-id], .email-content, .message-content');
      fallback.forEach(item => {
        if (!elements.includes(item)) {
          elements.push(item);
        }
      });
    }
    
    return elements;
  }

  async analyzeEmailElement(element, analysisId) {
    if (!this.enabled) return;
    
    const elementId = this.getElementId(element);
    
    // Skip if already analyzing or analyzed
    if (this.isAnalyzing.has(elementId) || this.analyzedElements.has(elementId)) {
      return;
    }
    
    this.isAnalyzing.add(elementId);
    
    try {
      const emailText = this.extractEmailText(element);
      const urls = this.extractUrls(element);
      
      if (!emailText || emailText.trim().length < 10) {
        console.log('Email text too short, skipping analysis');
        this.isAnalyzing.delete(elementId);
        return;
      }

      console.log(`Analyzing email (${emailText.length} chars, ${urls.length} URLs)`);
      const analysis = await this.analyzeContent(emailText, urls);
      
      if (!analysis.error) {
        this.displayAnalysis(element, analysis, analysisId);
        this.analyzedElements.add(elementId);
      } else {
        console.error('Analysis error:', analysis.error);
      }
      
    } catch (error) {
      console.error('Error analyzing email:', error);
    } finally {
      this.isAnalyzing.delete(elementId);
    }
  }

  extractEmailText(element) {
    // Extract text content from email element
    // Try to get the main email body, avoiding navigation and UI elements
    
    // Gmail-specific extraction
    if (window.location.hostname.includes('mail.google.com')) {
      // Try to find the email body content
      const emailBody = element.querySelector('.a3s, .ii.gt, [role="main"] .nH.if, .Am.Al.editable') ||
                       element.querySelector('[dir="ltr"]') ||
                       element;
      
      // Remove common Gmail UI elements
      const clone = emailBody.cloneNode(true);
      const toRemove = clone.querySelectorAll('.gmail_quote, .gmail_signature, .gmail_extra, [role="navigation"], .gb_');
      toRemove.forEach(el => el.remove());
      
      let text = clone.textContent || clone.innerText || '';
      
      // Clean up the text
      text = text
        .replace(/\s+/g, ' ')
        .trim();
      
      // If text is too short, try the whole element
      if (text.length < 50) {
        text = element.textContent || element.innerText || '';
        text = text.replace(/\s+/g, ' ').trim();
      }
      
      return text.substring(0, 5000); // Limit text length
    }
    
    // Outlook-specific extraction
    if (window.location.hostname.includes('outlook')) {
      const emailBody = element.querySelector('.ms-MessageBody, .ms-MessageBody-content') || element;
      let text = emailBody.textContent || emailBody.innerText || '';
      return text.replace(/\s+/g, ' ').trim().substring(0, 5000);
    }
    
    // Generic extraction
    const textContent = element.textContent || element.innerText || '';
    return textContent
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000);
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

    // Check if badge already exists
    const existingBadge = element.querySelector('.phishguard-badge');
    if (existingBadge) {
      existingBadge.className = `phishguard-badge ${badgeClass}`;
      existingBadge.textContent = badgeText;
      existingBadge.dataset.analysis = JSON.stringify(analysis);
      return;
    }

    // Create badge
    const badge = document.createElement('span');
    badge.className = `phishguard-badge ${badgeClass}`;
    badge.textContent = badgeText;
    badge.dataset.analysisId = analysisId;
    badge.title = `Risk Score: ${riskScore.toFixed(1)}% - Click for details`;

    // Store analysis data
    badge.dataset.analysis = JSON.stringify(analysis);

    // Insert badge into email element - try multiple locations
    let header = null;
    
    // Gmail
    if (window.location.hostname.includes('mail.google.com')) {
      header = element.querySelector('[data-testid="message-header"], .gD, .hP') ||
               element.querySelector('h2, h3') ||
               element.firstElementChild;
    }
    
    // Outlook
    if (window.location.hostname.includes('outlook')) {
      header = element.querySelector('.ms-MessageHeader, .ms-MessageHeader-subject') ||
               element.firstElementChild;
    }
    
    // Fallback
    if (!header) {
      header = element.querySelector('.email-header, .message-header, [data-testid="message-header"]') || 
               element.querySelector('h1, h2, h3, h4') ||
               element;
    }
    
    // Insert badge
    if (header && header !== element) {
      header.style.position = 'relative';
      header.appendChild(badge);
    } else {
      // Insert at the beginning of the element
      element.style.position = 'relative';
      element.insertBefore(badge, element.firstChild);
    }

    // Add URL warnings if any URLs are suspicious
    if (analysis.url_analyses && analysis.url_analyses.length > 0) {
      analysis.url_analyses.forEach(urlAnalysis => {
        if (urlAnalysis.analysis.risk_score > 50) {
          this.addUrlWarning(element, urlAnalysis.url, urlAnalysis.analysis);
        }
      });
    }
    
    console.log(`Analysis displayed: ${badgeText} (${riskScore.toFixed(1)}%)`);
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
