// PhishGuard AI Chrome Extension - Popup Script
// Handles the extension popup interface

document.addEventListener('DOMContentLoaded', function() {
  const analyzeCurrentBtn = document.getElementById('analyzeCurrent');
  const openDashboardBtn = document.getElementById('openDashboard');
  const protectionToggle = document.getElementById('protectionToggle');
  const notificationToggle = document.getElementById('notificationToggle');
  const statusDiv = document.getElementById('status');
  const riskScoreSpan = document.getElementById('riskScore');

  // Load settings
  loadSettings();

  // Event listeners
  analyzeCurrentBtn.addEventListener('click', analyzeCurrentPage);
  openDashboardBtn.addEventListener('click', openDashboard);
  protectionToggle.addEventListener('click', toggleProtection);
  notificationToggle.addEventListener('click', toggleNotifications);

  // Load current settings
  function loadSettings() {
    chrome.storage.sync.get(['enabled', 'showNotifications'], function(result) {
      protectionToggle.classList.toggle('active', result.enabled !== false);
      notificationToggle.classList.toggle('active', result.showNotifications !== false);
      updateStatus(result.enabled !== false);
    });
  }

  // Analyze current page
  function analyzeCurrentPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];
      if (!currentTab || !currentTab.url) {
        showMessage('Unable to read current tab URL.');
        return;
      }

      // Request background to analyze the current page URL
      chrome.runtime.sendMessage({
        action: 'analyzeUrl',
        url: currentTab.url
      }, function(response) {
        if (chrome.runtime.lastError) {
          showMessage('Extension error: ' + chrome.runtime.lastError.message);
          return;
        }
        if (response && !response.error) {
          showUrlAnalysisResult(currentTab.url, response);
        } else {
          showMessage(response && response.error ? response.error : 'Failed to analyze the current page URL.');
        }
      });
    });
  }

  // Open dashboard
  function openDashboard() {
    chrome.tabs.create({ url: 'http://localhost:5000/' });
  }

  // Toggle protection
  function toggleProtection() {
    const isActive = protectionToggle.classList.contains('active');
    const newState = !isActive;
    
    chrome.storage.sync.set({ enabled: newState }, function() {
      protectionToggle.classList.toggle('active', newState);
      updateStatus(newState);
      
      // Notify content script of setting change
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'settingsChanged',
          enabled: newState
        });
      });
    });
  }

  // Toggle notifications
  function toggleNotifications() {
    const isActive = notificationToggle.classList.contains('active');
    const newState = !isActive;
    
    chrome.storage.sync.set({ showNotifications: newState }, function() {
      notificationToggle.classList.toggle('active', newState);
    });
  }

  // Update status display
  function updateStatus(enabled) {
    if (enabled) {
      statusDiv.className = 'status safe';
      statusDiv.innerHTML = '<span>🟢 Protection Active</span><span id="riskScore">0%</span>';
    } else {
      statusDiv.className = 'status warning';
      statusDiv.innerHTML = '<span>🟡 Protection Disabled</span><span>OFF</span>';
    }
  }

  // Show analysis result
  function showAnalysisResult(analysis) {
    const riskScore = analysis.combined_risk_score || 0;
    const isPhishing = analysis.overall_prediction === 'phishing';
    
    let statusClass = 'safe';
    let statusText = '🟢 SAFE';
    
    if (riskScore > 70) {
      statusClass = 'danger';
      statusText = '🚨 PHISHING';
    } else if (riskScore > 30) {
      statusClass = 'warning';
      statusText = '⚠️ SUSPICIOUS';
    }
    
    statusDiv.className = `status ${statusClass}`;
    statusDiv.innerHTML = `<span>${statusText}</span><span>${riskScore.toFixed(1)}%</span>`;
    
    // Show detailed analysis in a temporary message
    let message = `Risk Score: ${riskScore.toFixed(1)}%\n`;
    
    if (analysis.explanations && analysis.explanations.length > 0) {
      message += '\nReasons:\n';
      analysis.explanations.forEach(explanation => {
        message += `• ${explanation}\n`;
      });
    }
    
    showMessage(message);
  }

  // Show URL analysis result (for current page URL)
  function showUrlAnalysisResult(url, data) {
    const riskScore = (typeof data.risk_score === 'number') ? data.risk_score : 0;
    const isPhishing = !!data.is_phishing;

    let statusClass = 'safe';
    let statusText = '🟢 SAFE';

    if (riskScore > 70) {
      statusClass = 'danger';
      statusText = '🚨 PHISHING';
    } else if (riskScore > 30) {
      statusClass = 'warning';
      statusText = '⚠️ SUSPICIOUS';
    }

    statusDiv.className = `status ${statusClass}`;
    statusDiv.innerHTML = `<span>${statusText}</span><span>${riskScore.toFixed(1)}%</span>`;

    let message = `URL:\n${url}\n\nRisk Score: ${riskScore.toFixed(1)}%\n`;
    if (Array.isArray(data.explanations) && data.explanations.length > 0) {
      message += '\nReasons:\n';
      data.explanations.forEach(explanation => {
        message += `• ${explanation}\n`;
      });
    }
    showMessage(message);
  }

  // Show message to user
  function showMessage(message) {
    // Create a temporary message overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.6);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      background: linear-gradient(180deg, #121829, #0f1525);
      color: #e6e9f0;
      padding: 16px 18px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 16px 40px rgba(0,0,0,0.35);
      max-width: 320px;
      max-height: 240px;
      overflow-y: auto;
      white-space: pre-line;
      font-size: 14px;
    `;
    messageDiv.textContent = message;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      display: inline-block;
      margin-top: 12px;
      padding: 8px 14px;
      background: linear-gradient(135deg, #6c5ce7, #8a7ff0);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      cursor: pointer;
      box-shadow: 0 8px 18px rgba(108,92,231,0.28);
    `;
    
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    
    messageDiv.appendChild(closeBtn);
    overlay.appendChild(messageDiv);
    document.body.appendChild(overlay);
    
    // Auto-close after 5 seconds
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }, 5000);
  }

  // Check API connection status
  function checkApiStatus() {
    fetch('http://localhost:5000/api/health')
      .then(response => response.json())
      .then(data => {
        if (data.status === 'healthy') {
          console.log('API connection successful');
        }
      })
      .catch(error => {
        console.log('API connection failed:', error);
        showMessage('Warning: Cannot connect to PhishGuard AI server. Please ensure the Flask server is running.');
      });
  }

  // Check API status on popup open
  checkApiStatus();
});
