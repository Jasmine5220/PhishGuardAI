

import re
import socket
import ipaddress
from urllib.parse import urlparse
from bs4 import BeautifulSoup
import requests
import pandas as pd
from tqdm import tqdm
from datetime import date

# Feature Extraction Class (without WHOIS)
class FeatureExtraction:
    def __init__(self, url):
        self.url = url
        self.features = []
        self.domain = ""
        self.soup = None

        # Parse URL
        try:
            self.parsed_url = urlparse(url)
            self.domain = self.parsed_url.netloc
        except:
            self.parsed_url = None

        # Fetch HTML safely
        try:
            self.response = requests.get(url, timeout=5)
            self.soup = BeautifulSoup(self.response.text, 'html.parser')
        except:
            self.response = None
            self.soup = None

        # Extract features
        self.features = [
            self.UsingIp(),
            self.longUrl(),
            self.shortUrl(),
            self.symbol(),
            self.redirecting(),
            self.prefixSuffix(),
            self.SubDomains(),
            self.Https(),
            -2,  # DomainRegLen skipped
            self.Favicon(),
            self.NonStdPort(),
            self.HTTPSDomainURL(),
            self.RequestURL(),
            self.AnchorURL(),
            self.LinksInScriptTags(),
            self.ServerFormHandler(),
            self.InfoEmail(),
            -2,  # AbnormalURL skipped (depends on WHOIS)
            self.WebsiteForwarding(),
            self.StatusBarCust(),
            self.DisableRightClick(),
            self.UsingPopupWindow(),
            self.IframeRedirection(),
            -2,  # AgeofDomain skipped
            -2,  # DNSRecording skipped
            -2,  # WebsiteTraffic skipped
            -2,  # PageRank skipped
            -2,  # GoogleIndex skipped
            self.LinksPointingToPage(),
            self.StatsReport()
        ]

    # -----------------------------
    # Basic URL features
    def UsingIp(self):
        try:
            ipaddress.ip_address(self.url)
            return -1
        except:
            return 1

    def longUrl(self):
        if len(self.url) < 54: return 1
        elif 54 <= len(self.url) <= 75: return 0
        else: return -1

    def shortUrl(self):
        short_urls = r'bit\.ly|goo\.gl|tinyurl|ow\.ly|t\.co'
        return -1 if re.search(short_urls, self.url) else 1

    def symbol(self): return -1 if '@' in self.url else 1
    def redirecting(self): return -1 if self.url.rfind('//') > 6 else 1
    def prefixSuffix(self): return -1 if '-' in self.domain else 1

    def SubDomains(self):
        dot_count = self.domain.count('.')
        if dot_count == 1: return 1
        elif dot_count == 2: return 0
        else: return -1

    def Https(self):
        if self.parsed_url: return 1 if 'https' in self.parsed_url.scheme else -1
        return -1

    def Favicon(self):
        try:
            if self.soup:
                for link in self.soup.find_all('link', href=True):
                    if self.domain in link['href'] or self.url in link['href']:
                        return 1
            return -1
        except: return -1

    def NonStdPort(self): return -1 if ':' in self.domain else 1
    def HTTPSDomainURL(self): return -1 if 'https' in self.domain else 1

    def RequestURL(self):
        try:
            if not self.soup: return -1
            i, success = 0, 0
            for tag in ['img', 'audio', 'embed', 'iframe']:
                for item in self.soup.find_all(tag, src=True):
                    dots = item['src'].count('.')
                    if self.domain in item['src'] or self.url in item['src'] or dots == 1:
                        success += 1
                    i += 1
            percentage = (success / i) * 100 if i != 0 else 0
            if percentage < 22: return 1
            elif percentage < 61: return 0
            else: return -1
        except: return -1

    def AnchorURL(self):
        try:
            if not self.soup: return -1
            i, unsafe = 0, 0
            for a in self.soup.find_all('a', href=True):
                if "#" in a['href'] or "javascript" in a['href'].lower() or "mailto" in a['href'].lower() or not (self.url in a['href'] or self.domain in a['href']):
                    unsafe += 1
                i += 1
            percentage = (unsafe / i) * 100 if i != 0 else 0
            if percentage < 31: return 1
            elif percentage < 67: return 0
            else: return -1
        except: return -1

    def LinksInScriptTags(self):
        try:
            if not self.soup: return -1
            i, success = 0, 0
            for tag in ['link', 'script']:
                attr = 'href' if tag=='link' else 'src'
                for item in self.soup.find_all(tag, **{attr: True}):
                    dots = item[attr].count('.')
                    if self.domain in item[attr] or self.url in item[attr] or dots == 1:
                        success += 1
                    i += 1
            percentage = (success / i) * 100 if i != 0 else 0
            if percentage < 17: return 1
            elif percentage < 81: return 0
            else: return -1
        except: return -1

    def ServerFormHandler(self):
        try:
            if not self.soup: return -1
            forms = self.soup.find_all('form', action=True)
            if not forms: return 1
            for form in forms:
                action = form['action']
                if action in ["", "about:blank"]: return -1
                elif self.domain not in action and self.url not in action: return 0
            return 1
        except: return -1

    def InfoEmail(self):
        try:
            if self.response and re.search(r"mailto", self.response.text): return -1
            return 1
        except: return -1

    def WebsiteForwarding(self):
        try:
            if self.response:
                if len(self.response.history) <= 1: return 1
                elif len(self.response.history) <= 4: return 0
                else: return -1
            return -1
        except: return -1

    def StatusBarCust(self):
        try:
            if self.response and re.search("<script>.+onmouseover.+</script>", self.response.text):
                return -1
            return -1
        except: return 1

    def DisableRightClick(self):
        try:
            if self.response and re.search(r"event.button ?== ?2", self.response.text): return 1
            return -1
        except: return -1

    def UsingPopupWindow(self):
        try:
            if self.response and re.search(r"alert\(", self.response.text): return -1
            return -1
        except: return 1

    def IframeRedirection(self):
        try:
            if self.response and re.search(r"<iframe>|<frameBorder>", self.response.text): return 1
            return -1
        except: return -1

    def LinksPointingToPage(self):
        try:
            if self.response:
                num_links = len(re.findall(r"<a href=", self.response.text))
                if num_links == 0: return 1
                elif num_links <= 2: return 0
                else: return -1
            return -1
        except: return -1

    def StatsReport(self):
        try:
            ip_address = socket.gethostbyname(self.domain)
            blocked_ips = ['146.112.61.108','213.174.157.151']  # example
            return -1 if ip_address in blocked_ips else 1
        except: return -1

    def getFeaturesList(self):
        return self.features

