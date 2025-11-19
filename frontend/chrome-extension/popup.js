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
    const resultsContainer = document.getElementById('analysisResults');
    if (resultsContainer) {
      resultsContainer.style.display = 'block';
    }

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

    // Display results in the analysis container instead of popup
    // Handle both URL-only analysis and combined analysis
    const analysisData = {
      url: url,
      risk_score: riskScore,
      combined_risk_score: data.combined_risk_score || riskScore,
      is_phishing: isPhishing,
      explanations: data.explanations || [],
      email_analysis: data.email_analysis || null,
      url_analyses: data.url_analyses || (url ? [{
        url: url,
        analysis: {
          risk_score: riskScore,
          is_phishing: isPhishing,
          explanations: data.explanations || []
        }
      }] : []),
      timestamp: data.timestamp || new Date().toISOString()
    };

    displayAnalysisInContainer(analysisData);
  }

  // Display analysis results in the container
  function displayAnalysisInContainer(analysis) {
    const resultsContainer = document.getElementById('analysisResults');
    const analysisContent = document.getElementById('analysisContent');
    
    if (!resultsContainer || !analysisContent) return;

    // Show loading state
    resultsContainer.style.display = 'block';
    analysisContent.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Analyzing...</p>
      </div>
    `;

    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Build HTML content
    // Prefer combined_risk_score if available (for combined analysis), otherwise use risk_score
    const riskScore = analysis.combined_risk_score !== undefined 
      ? analysis.combined_risk_score 
      : (analysis.risk_score || 0);
    let riskClass = 'safe';
    let statusText = '🟢 SAFE';
    let statusIcon = '✅';

    if (riskScore > 70) {
      riskClass = 'danger';
      statusText = '🚨 PHISHING DETECTED';
      statusIcon = '🚨';
    } else if (riskScore > 30) {
      riskClass = 'warning';
      statusText = '⚠️ SUSPICIOUS';
      statusIcon = '⚠️';
    }

    let html = `
      <div class="result-section">
        <div class="risk-display ${riskClass}">
          <h5>${statusIcon} ${statusText}</h5>
          <div class="risk-score">Risk Score: ${riskScore.toFixed(1)}%</div>
          <div class="progress-container">
            <div class="progress-bar-container">
              <div class="progress-bar ${riskClass}" style="width: ${riskScore}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add URL information if available
    if (analysis.url) {
      html += `
        <div class="result-section">
          <h4>🔗 URL Analyzed</h4>
          <div class="url-item">
            <div class="url-text">${analysis.url}</div>
          </div>
        </div>
      `;
    }

    // Add email analysis if available
    if (analysis.email_analysis) {
      html += `
        <div class="result-section">
          <h4>✉️ Email Analysis</h4>
          <div class="url-item">
            <div>Risk Score: <span class="url-score">${analysis.email_analysis.risk_score.toFixed(1)}%</span></div>
            ${analysis.email_analysis.model_used ? `<div style="margin-top: 4px; font-size: 11px; color: var(--muted);">Model: ${analysis.email_analysis.model_used}</div>` : ''}
          </div>
        </div>
      `;
    }

    // Add URL analyses if available
    if (analysis.url_analyses && analysis.url_analyses.length > 0) {
      html += `
        <div class="result-section">
          <h4>🔗 URL Analysis</h4>
      `;
      analysis.url_analyses.forEach(urlAnalysis => {
        html += `
          <div class="url-item">
            <div class="url-text">${urlAnalysis.url}</div>
            <div>Risk Score: <span class="url-score">${urlAnalysis.analysis.risk_score.toFixed(1)}%</span></div>
          </div>
        `;
      });
      html += `</div>`;
    }

    // Add explanations
    const explanations = analysis.explanations || [];
    if (explanations.length > 0) {
      html += `
        <div class="result-section">
          <h4>💡 Explanations</h4>
          <ul class="explanation-list">
      `;
      explanations.forEach(explanation => {
        html += `<li class="explanation-item">${explanation}</li>`;
      });
      html += `
          </ul>
        </div>
      `;
    }

    // Add timestamp
    const timestamp = analysis.timestamp ? new Date(analysis.timestamp).toLocaleString() : new Date().toLocaleString();
    html += `
      <div class="timestamp">
        <i class="fas fa-clock"></i> Analyzed at ${timestamp}
      </div>
    `;

    // Update content
    setTimeout(() => {
      analysisContent.innerHTML = html;
    }, 300);
  }

  // Show message to user (for errors only)
  function showMessage(message) {
    const resultsContainer = document.getElementById('analysisResults');
    const analysisContent = document.getElementById('analysisContent');
    
    if (resultsContainer && analysisContent) {
      resultsContainer.style.display = 'block';
      analysisContent.innerHTML = `
        <div class="error-state">
          ${message}
        </div>
      `;
      resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      // Fallback to alert if container doesn't exist
      alert(message);
    }
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

  // Close results button
  const closeResultsBtn = document.getElementById('closeResults');
  if (closeResultsBtn) {
    closeResultsBtn.addEventListener('click', function() {
      const resultsContainer = document.getElementById('analysisResults');
      if (resultsContainer) {
        resultsContainer.style.display = 'none';
      }
    });
  }

  // Check API status on popup open
  checkApiStatus();
});
