// PhishGuard AI Chrome Extension - URL Content Script
// Shows analysis results for visited URLs

(function() {
  'use strict';

  // Listen for URL analysis results from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'urlAnalysis' && request.analysis) {
      displayUrlBadge(request.url, request.analysis);
      sendResponse({ success: true });
    }
    return true;
  });

  function displayUrlBadge(url, analysis) {
    // Remove existing badge if any
    const existingBadge = document.getElementById('phishguard-url-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    if (analysis.error) {
      return;
    }

    const riskScore = analysis.risk_score || 0;
    const isPhishing = analysis.is_phishing || false;
    
    let badgeClass = 'phishguard-safe';
    let badgeText = 'SAFE';
    let badgeColor = '#10b981';
    
    if (riskScore > 70 || isPhishing) {
      badgeClass = 'phishguard-danger';
      badgeText = 'PHISHING';
      badgeColor = '#ef4444';
    } else if (riskScore > 30) {
      badgeClass = 'phishguard-warning';
      badgeText = 'SUSPICIOUS';
      badgeColor = '#f59e0b';
    }

    // Create badge element
    const badge = document.createElement('div');
    badge.id = 'phishguard-url-badge';
    badge.className = `phishguard-url-badge ${badgeClass}`;
    badge.innerHTML = `
      <div class="phishguard-badge-content">
        <i class="fas fa-shield-alt"></i>
        <span class="phishguard-badge-text">${badgeText}</span>
        <span class="phishguard-risk-score">${riskScore.toFixed(1)}%</span>
        <button class="phishguard-close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      ${analysis.explanations && analysis.explanations.length > 0 ? `
        <div class="phishguard-explanations">
          ${analysis.explanations.slice(0, 3).map(exp => `<div class="phishguard-exp-item">${exp}</div>`).join('')}
        </div>
      ` : ''}
    `;

    // Add styles if not already added
    if (!document.getElementById('phishguard-url-styles')) {
      const style = document.createElement('style');
      style.id = 'phishguard-url-styles';
      style.textContent = `
        #phishguard-url-badge {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          background: #ffffff;
          backdrop-filter: blur(10px);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          border: 2px solid;
          min-width: 300px;
          max-width: 420px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: slideInRight 0.3s ease;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .phishguard-url-badge.phishguard-safe {
          border-color: #10b981;
          background: #d1fae5;
        }
        
        .phishguard-url-badge.phishguard-safe .phishguard-badge-text {
          color: #065f46;
        }
        
        .phishguard-url-badge.phishguard-safe .phishguard-badge-content i {
          color: #059669;
        }
        
        .phishguard-url-badge.phishguard-safe .phishguard-risk-score {
          background: #10b981;
          color: #ffffff;
        }
        
        .phishguard-url-badge.phishguard-warning {
          border-color: #f59e0b;
          background: #fef3c7;
        }
        
        .phishguard-url-badge.phishguard-warning .phishguard-badge-text {
          color: #92400e;
        }
        
        .phishguard-url-badge.phishguard-warning .phishguard-badge-content i {
          color: #d97706;
        }
        
        .phishguard-url-badge.phishguard-warning .phishguard-risk-score {
          background: #f59e0b;
          color: #ffffff;
        }
        
        .phishguard-url-badge.phishguard-danger {
          border-color: #ef4444;
          background: #fee2e2;
        }
        
        .phishguard-url-badge.phishguard-danger .phishguard-badge-text {
          color: #991b1b;
        }
        
        .phishguard-url-badge.phishguard-danger .phishguard-badge-content i {
          color: #dc2626;
        }
        
        .phishguard-url-badge.phishguard-danger .phishguard-risk-score {
          background: #ef4444;
          color: #ffffff;
        }
        
        .phishguard-badge-content {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 18px;
        }
        
        .phishguard-badge-content i {
          font-size: 20px;
          font-weight: 600;
        }
        
        .phishguard-badge-text {
          font-weight: 700;
          font-size: 15px;
          text-transform: uppercase;
          letter-spacing: 1px;
          flex: 1;
        }
        
        .phishguard-risk-score {
          font-weight: 700;
          font-size: 14px;
          padding: 6px 12px;
          border-radius: 10px;
          color: #ffffff;
        }
        
        .phishguard-close-btn {
          background: rgba(0, 0, 0, 0.15);
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
          color: #1a1a1a;
          font-weight: 600;
        }
        
        .phishguard-close-btn:hover {
          background: rgba(0, 0, 0, 0.25);
        }
        
        .phishguard-explanations {
          padding: 0 18px 16px 18px;
          border-top: 1px solid rgba(0, 0, 0, 0.15);
          margin-top: 8px;
          padding-top: 14px;
        }
        
        .phishguard-exp-item {
          font-size: 13px;
          padding: 8px 0;
          color: #1a1a1a;
          font-weight: 500;
          line-height: 1.5;
        }
        
        .phishguard-exp-item:before {
          content: "• ";
          font-weight: bold;
          color: inherit;
        }
      `;
      document.head.appendChild(style);
    }

    // Inject Font Awesome if not present
    if (!document.querySelector('link[href*="font-awesome"]')) {
      const faLink = document.createElement('link');
      faLink.rel = 'stylesheet';
      faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(faLink);
    }

    document.body.appendChild(badge);

    // Auto-remove after 10 seconds if safe, 30 seconds if suspicious/phishing
    const autoRemoveTime = riskScore > 70 ? 30000 : riskScore > 30 ? 20000 : 10000;
    setTimeout(() => {
      if (badge.parentNode) {
        badge.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => badge.remove(), 300);
      }
    }, autoRemoveTime);
  }

  // Add slide out animation
  if (!document.getElementById('phishguard-url-animations')) {
    const style = document.createElement('style');
    style.id = 'phishguard-url-animations';
    style.textContent = `
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
})();


