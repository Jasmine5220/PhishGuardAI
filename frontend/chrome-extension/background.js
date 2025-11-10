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

// Handle tab updates to inject content scripts
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
  }
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
