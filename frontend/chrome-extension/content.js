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
    if (document.getElementById('phishguard-style-link') || document.getElementById('phishguard-inline-style')) {
      return;
    }

    // Inject Font Awesome for icons
    if (!document.getElementById('phishguard-fa-link')) {
      const faLink = document.createElement('link');
      faLink.id = 'phishguard-fa-link';
      faLink.rel = 'stylesheet';
      faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(faLink);
    }

    const runtimeAPI = (typeof chrome !== 'undefined' && chrome.runtime)
      ? chrome
      : (typeof browser !== 'undefined' && browser.runtime ? browser : null);

    if (runtimeAPI?.runtime?.getURL) {
      const link = document.createElement('link');
      link.id = 'phishguard-style-link';
      link.rel = 'stylesheet';
      link.href = runtimeAPI.runtime.getURL('content.css');
      document.head.appendChild(link);
      return;
    }

    const style = document.createElement('style');
    style.id = 'phishguard-inline-style';
    style.textContent = `
      .phishguard-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        margin-left: 8px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        background: rgba(255,255,255,0.8);
        color: #1a1a1a;
        border: 1px solid rgba(0,0,0,0.08);
      }
      .phishguard-badge .phishguard-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 0 3px rgba(255,255,255,0.6);
      }
      .phishguard-safe {
        color: #0f5132;
        border-color: rgba(15,81,50,0.2);
        background: rgba(212,237,218,0.9);
      }
      .phishguard-warning {
        color: #7f5200;
        border-color: rgba(255,204,0,0.35);
        background: rgba(255,243,205,0.95);
      }
      .phishguard-danger {
        color: #842029;
        border-color: rgba(220,53,69,0.3);
        background: rgba(248,215,218,0.95);
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

    // Handle clicks on analysis badges + overlay
    document.addEventListener('click', (e) => {
      const badgeTarget = e.target instanceof Element ? e.target.closest('.phishguard-badge') : null;
      if (badgeTarget) {
        e.preventDefault();
        this.showAnalysisPanel(badgeTarget.dataset.analysisId);
        return;
      }

      if (e.target.classList && e.target.classList.contains('phishguard-overlay')) {
        this.hideAnalysisPanel();
      }
    });

    // Support keyboard activation for badges
    document.addEventListener('keydown', (e) => {
      if (!['Enter', ' ', 'Spacebar'].includes(e.key)) {
        return;
      }
      const badgeTarget = e.target instanceof Element ? e.target.closest('.phishguard-badge') : null;
      if (badgeTarget) {
        e.preventDefault();
        this.showAnalysisPanel(badgeTarget.dataset.analysisId);
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
    // Gmail selectors - more specific to find email headers
    const gmailSelectors = [
      '[data-message-id]',
      '.hP', // Gmail email header
      '.g3', // Gmail header container
      '.xY', // Gmail header area
      '.email-content',
      '.message-content',
      '[role="main"] [data-thread-id]',
      '.nH.if', // Gmail message container
      '.a3s', // Gmail message body container
    ];
    
    // Outlook selectors
    const outlookSelectors = [
      '.ms-ConversationHeader',
      '.ms-MessageList-item',
      '[data-automation-id="message-item"]',
      '.ms-MessageHeader',
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
    // Check if badge already exists for this element
    if (element.querySelector('.phishguard-badge')) {
      return; // Already analyzed
    }
    
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

    // Check if badge already exists to prevent duplicates
    if (element.querySelector('.phishguard-badge')) {
      return;
    }

    const riskScore = analysis.combined_risk_score || 0;
    const isPhishing = analysis.overall_prediction === 'phishing';
    
    let badgeClass = 'phishguard-safe';
    let badgeText = 'SAFE';
    
    if (riskScore > 70) {
      badgeClass = 'phishguard-danger';
      badgeText = 'PHISHING';
    } else if (riskScore > 50) {
      badgeClass = 'phishguard-warning';
      badgeText = 'SUSPICIOUS';
    }

    // Create badge with icon
    const badge = document.createElement('span');
    badge.className = `phishguard-badge ${badgeClass}`;
    badge.dataset.analysisId = analysisId;
    badge.dataset.status = badgeText.toLowerCase();
    badge.title = `Risk Score: ${riskScore.toFixed(1)}% - Click for details`;
    badge.dataset.analysis = JSON.stringify(analysis);
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.innerHTML = `
      <i class="fas fa-shield-alt"></i>
      <span class="phishguard-label-text">${badgeText}</span>
    `;

    // Try to find icon container in email header (Gmail, Outlook, etc.)
    const header = element.querySelector('.email-header, .message-header, [data-testid="message-header"]') || element;
    
    // Look for common icon containers in email headers
    const iconContainers = [
      header.querySelector('[role="toolbar"]'), // Gmail action buttons
      header.querySelector('.T-I.J-J5-Ji'), // Gmail icon buttons
      header.querySelector('[data-tooltip]'), // Gmail tooltip elements
      header.querySelector('.ms-CommandBar'), // Outlook command bar
      header.querySelector('.ms-Button-iconContainer'), // Outlook button icons
      header.querySelector('[aria-label*="Reply"], [aria-label*="Forward"], [aria-label*="More"]'), // Action buttons
      header.querySelector('.action-buttons, .email-actions, .message-actions'), // Generic action containers
    ].filter(Boolean);

    // Try to find action bar or icon container and add spacing
    const actionBar = header.querySelector('[role="toolbar"]') || 
                     header.querySelector('[aria-label*="More"]')?.closest('div') ||
                     iconContainers[0];
    
    if (actionBar) {
      // Create a spacer element for better separation
      const spacer = document.createElement('span');
      spacer.style.width = '36px';
      spacer.style.display = 'inline-block';
      spacer.setAttribute('aria-hidden', 'true');
      spacer.style.flexShrink = '0';
      
      // Insert spacer and badge after action bar
      if (actionBar.nextSibling) {
        actionBar.parentNode.insertBefore(spacer, actionBar.nextSibling);
        actionBar.parentNode.insertBefore(badge, spacer.nextSibling);
      } else {
        actionBar.parentNode.appendChild(spacer);
        actionBar.parentNode.appendChild(badge);
      }
    } else if (iconContainers.length > 0) {
      const iconContainer = iconContainers[0];
      // Add spacer before badge
      const spacer = document.createElement('span');
      spacer.style.width = '36px';
      spacer.style.display = 'inline-block';
      spacer.setAttribute('aria-hidden', 'true');
      spacer.style.flexShrink = '0';
      
      if (iconContainer.nextSibling) {
        iconContainer.parentNode.insertBefore(spacer, iconContainer.nextSibling);
        iconContainer.parentNode.insertBefore(badge, spacer.nextSibling);
      } else {
        iconContainer.parentNode.appendChild(spacer);
        iconContainer.parentNode.appendChild(badge);
      }
    } else {
      // Fallback: Look for timestamp or action area in header
      const timestampArea = header.querySelector('[data-tooltip-delay], .g3, .xY, .bA4') || 
                           header.querySelector('time, [datetime]') ||
                           header.querySelector('.ms-DatePicker, .ms-Text');
      
      if (timestampArea) {
        // Add spacer before badge
        const spacer = document.createElement('span');
        spacer.style.width = '28px';
        spacer.style.display = 'inline-block';
        spacer.setAttribute('aria-hidden', 'true');
        spacer.style.flexShrink = '0';
        
        timestampArea.parentNode.insertBefore(spacer, timestampArea.nextSibling);
        timestampArea.parentNode.insertBefore(badge, spacer.nextSibling);
      } else {
        // Last resort: append to header with spacer
        const spacer = document.createElement('span');
        spacer.style.width = '28px';
        spacer.style.display = 'inline-block';
        spacer.setAttribute('aria-hidden', 'true');
        spacer.style.flexShrink = '0';
        header.appendChild(spacer);
        header.appendChild(badge);
      }
    }

    // Add URL warnings if any URLs are suspicious (threshold increased to 60)
    if (analysis.url_analyses && analysis.url_analyses.length > 0) {
      analysis.url_analyses.forEach(urlAnalysis => {
        if (urlAnalysis.analysis && urlAnalysis.analysis.risk_score > 60) {
          this.addUrlWarning(element, urlAnalysis.url, urlAnalysis.analysis);
        }
      });
    }
  }

  addUrlWarning(element, url, analysis) {
    const warning = document.createElement('div');
    warning.className = analysis.risk_score > 70 ? 'phishguard-url-danger' : 'phishguard-url-warning';
    
    // Truncate long URLs for display
    const displayUrl = url.length > 60 ? url.substring(0, 60) + '...' : url;
    
    // Show only top 2 most critical explanations
    let explanationText = '';
    if (analysis.explanations && analysis.explanations.length > 0) {
      const topExplanations = analysis.explanations.slice(0, 2);
      explanationText = '<br><small style="color: #854d0e; font-size: 11px;">' + topExplanations.join(' • ') + '</small>';
    }
    
    warning.innerHTML = `
      <strong>⚠️ Suspicious URL Detected:</strong><br>
      <code style="font-size: 11px; word-break: break-all; color: #1a1a1a;">${displayUrl}</code><br>
      <small style="color: #854d0e;">Risk Score: ${analysis.risk_score.toFixed(1)}%</small>
      ${explanationText}
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
          <h4 style="color: #1a1a1a; font-weight: 700; margin: 0 0 8px 0; font-size: 18px;">${statusText}</h4>
          <p style="color: #1a1a1a; font-size: 15px; margin: 0;"><strong style="color: #1a1a1a;">Risk Score:</strong> <span style="color: #1a1a1a; font-weight: 700; font-size: 16px;">${riskScore.toFixed(1)}%</span></p>
        </div>
        
        ${analysis.email_analysis ? `
          <h5 style="color: #1a1a1a; font-weight: 700; margin-top: 15px; margin-bottom: 10px; font-size: 16px;">📧 Email Analysis</h5>
          <div style="background: #f8f9fa; padding: 12px; border-radius: 5px; margin-bottom: 15px;">
            <p style="color: #1a1a1a; font-size: 14px; margin: 5px 0;"><strong style="color: #1a1a1a;">Risk Score:</strong> <span style="color: #1a1a1a; font-weight: 600;">${analysis.email_analysis.risk_score.toFixed(1)}%</span></p>
            ${analysis.email_analysis.explanations && analysis.email_analysis.explanations.length > 0 ? `
              <div style="margin-top: 10px;">
                ${analysis.email_analysis.explanations.slice(0, 3).map(exp => `
                  <div style="color: #1a1a1a; font-size: 13px; margin: 4px 0; padding: 6px 10px; background: white; border-radius: 3px; border-left: 3px solid #6c5ce7;">
                    ${exp}
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        ${analysis.url_analyses && analysis.url_analyses.length > 0 ? `
          <h5 style="color: #1a1a1a; font-weight: 700; margin-top: 15px; margin-bottom: 10px; font-size: 16px;">🔗 URL Analysis</h5>
          ${(() => {
            // Group URLs by risk level
            const highRisk = analysis.url_analyses.filter(u => u.analysis && u.analysis.risk_score > 60);
            const mediumRisk = analysis.url_analyses.filter(u => u.analysis && u.analysis.risk_score > 30 && u.analysis.risk_score <= 60);
            const lowRisk = analysis.url_analyses.filter(u => u.analysis && u.analysis.risk_score <= 30);
            const totalUrls = analysis.url_analyses.length;
            
            // Collect unique explanations
            const allExplanations = new Set();
            analysis.url_analyses.forEach(u => {
              if (u.analysis && u.analysis.explanations) {
                u.analysis.explanations.forEach(exp => allExplanations.add(exp));
              }
            });
            const uniqueExplanations = Array.from(allExplanations).slice(0, 3);
            
            // Calculate average risk
            const avgRisk = analysis.url_analyses.reduce((sum, u) => sum + (u.analysis?.risk_score || 0), 0) / totalUrls;
            
            let html = '';
            
            // Summary section
            html += `<div style="margin: 10px 0; padding: 12px; border: 1px solid #ddd; border-radius: 5px; background: #f8f9fa;">
              <p style="color: #1a1a1a; font-size: 14px; margin: 5px 0;"><strong style="color: #1a1a1a;">Total URLs Analyzed:</strong> <span style="color: #1a1a1a; font-weight: 600;">${totalUrls}</span></p>
              <p style="color: #1a1a1a; font-size: 14px; margin: 5px 0;"><strong style="color: #1a1a1a;">Average Risk:</strong> <span style="color: #1a1a1a; font-weight: 600;">${avgRisk.toFixed(1)}%</span></p>`;
            
            if (highRisk.length > 0) {
              html += `<p style="color: #dc3545; font-size: 13px; margin: 5px 0; font-weight: 600;">⚠️ ${highRisk.length} high-risk URL${highRisk.length > 1 ? 's' : ''} detected</p>`;
            }
            if (mediumRisk.length > 0) {
              html += `<p style="color: #ffc107; font-size: 13px; margin: 5px 0;">⚠️ ${mediumRisk.length} medium-risk URL${mediumRisk.length > 1 ? 's' : ''} detected</p>`;
            }
            
            // Show unique explanations
            if (uniqueExplanations.length > 0) {
              html += `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                <p style="color: #1a1a1a; font-size: 12px; font-weight: 600; margin-bottom: 6px;">Key Issues Found:</p>
                ${uniqueExplanations.map(exp => `
                  <div style="color: #1a1a1a; font-size: 12px; margin: 4px 0; padding: 6px 10px; background: white; border-radius: 3px; border-left: 3px solid #6c5ce7;">
                    ${exp}
                  </div>
                `).join('')}
              </div>`;
            }
            
            html += `</div>`;
            
            // Only show individual URLs if there are high-risk ones (max 2)
            if (highRisk.length > 0) {
              html += `<div style="margin-top: 10px;">
                <p style="color: #1a1a1a; font-size: 13px; font-weight: 600; margin-bottom: 8px;">High-Risk URLs:</p>
                ${highRisk.slice(0, 2).map(urlAnalysis => {
                  const domain = urlAnalysis.url.match(/https?:\/\/([^\/]+)/)?.[1] || urlAnalysis.url.substring(0, 40);
                  return `
                    <div style="margin: 8px 0; padding: 10px; border: 1px solid #dc3545; border-radius: 4px; background: #fff5f5;">
                      <p style="color: #1a1a1a; font-size: 12px; margin: 3px 0; word-break: break-all; overflow-wrap: break-word;">
                        <code style="color: #dc3545; background: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; max-width: 100%; display: inline-block;">${domain}${urlAnalysis.url.length > 40 ? '...' : ''}</code>
                      </p>
                      <p style="color: #dc3545; font-size: 12px; margin: 3px 0; font-weight: 600;">Risk: ${urlAnalysis.analysis.risk_score.toFixed(1)}%</p>
                    </div>
                  `;
                }).join('')}
                ${highRisk.length > 2 ? `<p style="color: #666; font-size: 11px; margin-top: 5px;">+ ${highRisk.length - 2} more high-risk URL${highRisk.length - 2 > 1 ? 's' : ''}</p>` : ''}
              </div>`;
            }
            
            return html;
          })()}
        ` : ''}
        
        ${analysis.explanations && analysis.explanations.length > 0 ? `
          <h5 style="color: #1a1a1a; font-weight: 700; margin-top: 20px; margin-bottom: 12px; font-size: 16px;">💡 Combined Analysis Summary</h5>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${(() => {
              // Remove duplicates and limit to 5 most important
              const uniqueExplanations = [...new Set(analysis.explanations)].slice(0, 5);
              return uniqueExplanations.map(explanation => {
                // Shorten long explanations
                const shortExp = explanation.length > 80 ? explanation.substring(0, 80) + '...' : explanation;
                return `
                  <li style="background: #f8f9fa; border-left: 4px solid #6c5ce7; padding: 10px 14px; margin: 6px 0; border-radius: 4px; color: #1a1a1a; font-size: 13px; font-weight: 500; line-height: 1.5; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    ${shortExp}
                  </li>
                `;
              }).join('');
            })()}
          </ul>
        ` : ''}
        
        <div style="margin-top: 20px; font-size: 12px; color: #1a1a1a; opacity: 0.7;">
          <strong style="color: #1a1a1a;">Analyzed:</strong> ${new Date(analysis.timestamp).toLocaleString()}
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
