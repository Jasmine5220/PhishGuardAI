// PhishGuard AI Chrome Extension - Background Script
// Handles API communication and data processing

const API_BASE_URL = 'http://localhost:5000';

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('PhishGuard AI Extension installed');
  
  // Set default settings
  chrome.storage.sync.set({
    enabled: true,
    showNotifications: true,
    autoAnalyze: true, // Auto-analyze URLs on navigation
    apiUrl: API_BASE_URL
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeEmail') {
    analyzeEmailContent(request.emailText, request.urls)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'analyzeUrl') {
    analyzeUrl(request.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
  
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['enabled', 'showNotifications', 'apiUrl'], (result) => {
      sendResponse(result);
    });
    return true;
  }
});

// Analyze email content using the Flask API
async function analyzeEmailContent(emailText, urls = []) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze_combined`, {
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
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error analyzing email:', error);
    return { error: 'Failed to analyze email content' };
  }
}

// Analyze URL using the Flask API
async function analyzeUrl(url) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze_url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: url })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error analyzing URL:', error);
    return { error: 'Failed to analyze URL' };
  }
}

// Show notification for phishing detection
function showNotification(title, message, type = 'basic') {
  chrome.notifications.create({
    type: type,
    title: title,
    message: message,
    priority: 2
  });
}

// Track analyzed URLs to avoid duplicate analysis
const analyzedUrls = new Set();

// Handle tab updates to inject content scripts and analyze URLs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's an email service
    if (tab.url.includes('mail.google.com') || 
        tab.url.includes('outlook.live.com') || 
        tab.url.includes('outlook.office.com')) {
      
      chrome.storage.sync.get(['enabled'], (result) => {
        if (result.enabled) {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }).catch(err => console.log('Script injection failed:', err));
        }
      });
    }
    
    // Automatically analyze URLs (skip chrome://, chrome-extension://, etc.)
    if (tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('edge://') &&
        !tab.url.startsWith('about:') &&
        !tab.url.startsWith('moz-extension://') &&
        (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      
      // Check if we've already analyzed this URL
      const urlKey = `${tabId}-${tab.url}`;
      if (analyzedUrls.has(urlKey)) {
        return; // Already analyzed
      }
      
      chrome.storage.sync.get(['enabled', 'showNotifications', 'autoAnalyze'], (result) => {
        // Default to enabled if not set
        const autoAnalyze = result.autoAnalyze !== false;
        const enabled = result.enabled !== false;
        
        if (enabled && autoAnalyze) {
          analyzedUrls.add(urlKey);
          
          // Analyze the URL
          analyzeUrl(tab.url).then(analysisResult => {
            if (analysisResult && !analysisResult.error) {
              const riskScore = analysisResult.risk_score || 0;
              const isPhishing = analysisResult.is_phishing || false;
              
              // Show notification if enabled and risk is high
              if (result.showNotifications !== false && (riskScore > 30 || isPhishing)) {
                let notificationType = 'basic';
                let notificationTitle = 'PhishGuard AI';
                let notificationMessage = '';
                
                if (riskScore > 70 || isPhishing) {
                  notificationType = 'basic';
                  notificationTitle = '🚨 Phishing Detected!';
                  notificationMessage = `Risk: ${riskScore.toFixed(1)}% - ${tab.url.substring(0, 50)}...`;
                } else if (riskScore > 30) {
                  notificationType = 'basic';
                  notificationTitle = '⚠️ Suspicious URL';
                  notificationMessage = `Risk: ${riskScore.toFixed(1)}% - Exercise caution`;
                }
                
                if (notificationMessage) {
                  showNotification(notificationTitle, notificationMessage, notificationType);
                }
              }
              
              // Send analysis result to content script to display badge
              chrome.tabs.sendMessage(tabId, {
                action: 'urlAnalysis',
                url: tab.url,
                analysis: analysisResult
              }).catch(() => {
                // Content script might not be loaded, that's okay
                console.log('Content script not available for URL analysis display');
              });
            }
          }).catch(error => {
            console.error('Error analyzing URL:', error);
            analyzedUrls.delete(urlKey); // Remove from cache on error
          });
        }
      });
    }
  }
  
  // Clean up analyzed URLs when tab is closed
  if (changeInfo.status === 'loading' && changeInfo.url) {
    // URL changed, remove old entry
    const oldUrlKey = Array.from(analyzedUrls).find(key => key.startsWith(`${tabId}-`));
    if (oldUrlKey) {
      analyzedUrls.delete(oldUrlKey);
    }
  }
});

// Clean up when tab is removed
chrome.tabs.onRemoved.addListener((tabId) => {
  const keysToRemove = Array.from(analyzedUrls).filter(key => key.startsWith(`${tabId}-`));
  keysToRemove.forEach(key => analyzedUrls.delete(key));
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Analyze current tab URL when clicking the action icon
  if (tab && tab.url) {
    analyzeUrl(tab.url).then(result => {
      const risk = typeof result.risk_score === 'number' ? result.risk_score.toFixed(1) : 'N/A';
      const status = result.is_phishing ? 'PHISHING' : (result.risk_score > 30 ? 'SUSPICIOUS' : 'SAFE');
      showNotification('PhishGuard AI', `Current page: ${status} (Risk ${risk}%)`);
    }).catch(() => {
      showNotification('PhishGuard AI', 'Failed to analyze current page URL');
    });
  } else {
    chrome.tabs.create({ url: `${API_BASE_URL}/` });
  }
});
