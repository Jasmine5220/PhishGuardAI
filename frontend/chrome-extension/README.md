# PhishGuard AI Chrome Extension - Installation Guide

## Overview
PhishGuard AI Chrome Extension provides real-time phishing detection for emails and URLs with explainable AI insights.

## Installation Steps

### 1. Prerequisites
- Chrome browser (version 88 or higher)
- PhishGuard AI Flask server running on localhost:5000

### 2. Install the Extension

#### Method 1: Developer Mode Installation
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from this project
5. The extension should now appear in your extensions list

#### Method 2: Pack and Install
1. In Chrome extensions page, click "Pack extension"
2. Select the `chrome-extension` folder
3. Click "Pack Extension" to create a .crx file
4. Drag and drop the .crx file into Chrome extensions page

### 3. Configure the Extension
1. Click the PhishGuard AI icon in your browser toolbar
2. Ensure "Enable Protection" is turned on
3. Configure notification settings as desired

### 4. Start the Flask Server
```bash
cd frontend
pip install -r requirements.txt
python app.py
```

## Features

### Real-time Email Analysis
- Automatically analyzes emails in Gmail and Outlook
- Shows risk badges next to email headers
- Provides detailed explanations for flagged content

### URL Scanning
- Scans URLs in emails for phishing indicators
- Highlights suspicious links
- Provides risk scores and explanations

### Explainable AI
- Clear explanations for why content is flagged
- Transparent decision-making process
- Educational insights about phishing techniques

## Supported Platforms
- Gmail (mail.google.com)
- Outlook Live (outlook.live.com)
- Outlook Office 365 (outlook.office.com)

## API Endpoints Used
- `/api/analyze_combined` - Analyzes email content and URLs
- `/api/analyze_email` - Analyzes email content only
- `/api/analyze_url` - Analyzes URLs only
- `/api/health` - Health check endpoint

## Troubleshooting

### Extension Not Working
1. Check if Flask server is running on localhost:5000
2. Verify extension permissions in Chrome
3. Check browser console for errors
4. Ensure you're on a supported email platform

### API Connection Issues
1. Verify Flask server is running: `http://localhost:5000/api/health`
2. Check CORS settings in Flask app
3. Ensure no firewall blocking localhost:5000

### Performance Issues
1. Extension analyzes emails as they load
2. Large emails may take longer to process
3. Check browser memory usage if experiencing slowdowns

## Security Notes
- Extension only communicates with local Flask server
- No data is sent to external servers
- All analysis happens locally
- Email content is processed in memory only

## Development
- Modify `content.js` for email platform integration
- Update `background.js` for API communication
- Customize `popup.html` for UI changes
- Test on different email platforms

## Version History
- v1.0.0 - Initial release with basic phishing detection
- Supports Gmail and Outlook
- Real-time analysis with explainable AI
- Chrome extension with popup interface
