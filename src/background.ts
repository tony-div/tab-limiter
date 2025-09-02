interface SiteLimit {
  id: string;
  url: string;
  visitLimit: number;
  timeInterval: 'hour' | 'day' | 'week';
  visitCount: number;
  lastReset: number;
  createdAt: number;
}

interface StorageData {
  siteLimits: { [key: string]: SiteLimit };
}

class TabLimiterBackground {
  private tabIds: Set<number> = new Set();
  constructor() {
    this.initializeListeners();
  }

  private initializeListeners(): void {
    chrome.tabs.onCreated.addListener((tab: chrome.tabs.Tab) => {
      this.onNavigation(tab);
    });

    chrome.tabs.onUpdated.addListener((_id, changeInfo, tab: chrome.tabs.Tab) => {
      if (changeInfo.url || changeInfo.status === 'complete') {
        this.onNavigation(tab);
      }
    });
  }

  private async onNavigation(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.url || !tab.id) return;

    // Skip chrome:// and extension pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return;
    }

    try {
      const hostname = this.extractHostname(tab.url);
      if (!hostname) return;

      const data = await this.getStorageData();
      const matchedSite = this.findMatchingSite(hostname, data.siteLimits);

      if (matchedSite) {
        await this.handleSiteVisit(matchedSite, tab);
      }
    } catch (error) {
      console.error('Error handling navigation:', error);
    }
  }

  private extractHostname(url: string): string | null {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      
      // Remove www. prefix
      hostname = hostname.replace(/^www\./, '');
      
      return hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private findMatchingSite(hostname: string, siteLimits: { [key: string]: SiteLimit }): SiteLimit | null {
    for (const siteLimit of Object.values(siteLimits)) {
      if (this.isHostnameMatch(hostname, siteLimit.url)) {
        return siteLimit;
      }
    }
    return null;
  }

  private isHostnameMatch(hostname: string, pattern: string): boolean {
    // Handle wildcard patterns like *.youtube.com
    if (pattern.startsWith('*.')) {
      const domain = pattern.substring(2);
      return hostname === domain || hostname.endsWith('.' + domain);
    }
    
    // Exact match or subdomain match
    return hostname === pattern || hostname.endsWith('.' + pattern);
  }

  private async handleSiteVisit(siteLimit: SiteLimit, tab: chrome.tabs.Tab): Promise<void> {
    // Check if we need to reset the counter
    const watched = this.tabIds.has(tab.id!);
    if(watched) return;
    this.tabIds.add(tab.id!);
    const resetTime = this.getResetTime(siteLimit);
    const now = Date.now();

    if (now >= resetTime) {
      siteLimit.visitCount = 0;
      siteLimit.lastReset = now;
    }

    // Increment visit count
    siteLimit.visitCount++;

    // Save updated data
    const data = await this.getStorageData();
    data.siteLimits[siteLimit.id] = siteLimit;
    await chrome.storage.sync.set(data);

    // Check if limit is exceeded
    if (siteLimit.visitCount > siteLimit.visitLimit) {
      await this.blockSite(tab, siteLimit);
    }
  }

  private getResetTime(siteLimit: SiteLimit): number {
    const lastReset = siteLimit.lastReset;
    
    switch (siteLimit.timeInterval) {
      case 'hour':
        return lastReset + (60 * 60 * 1000);
      case 'day':
        return lastReset + (24 * 60 * 60 * 1000);
      case 'week':
        return lastReset + (7 * 24 * 60 * 60 * 1000);
      default:
        return lastReset + (24 * 60 * 60 * 1000);
    }
  }

  private async blockSite(tab: chrome.tabs.Tab, siteLimit: SiteLimit): Promise<void> {
    if (!tab.id) return;

    const nextReset = this.getResetTime(siteLimit);
    const timeUntilReset = this.formatTimeUntilReset(nextReset - Date.now());

    const blockPageHtml = this.generateBlockPage(siteLimit, timeUntilReset);

    try {
      chrome.tabs.goBack(tab.id);
    } catch (error) {
      console.error('Error blocking site:', error);
    }
  }

  private formatTimeUntilReset(milliseconds: number): string {
    const hours = Math.floor(milliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }

  private generateBlockPage(siteLimit: SiteLimit, timeUntilReset: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Site Blocked - Tab Limiter</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            margin: 20px;
          }
          .icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            color: #2c3e50;
            margin: 0 0 20px 0;
            font-size: 28px;
            font-weight: 600;
          }
          .site-url {
            color: #e74c3c;
            font-weight: 600;
            font-size: 18px;
            margin-bottom: 20px;
          }
          .message {
            color: #555;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          .stats {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .stat-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          .stat-row:last-child {
            margin-bottom: 0;
          }
          .stat-label {
            font-weight: 500;
            color: #666;
          }
          .stat-value {
            font-weight: 600;
            color: #2c3e50;
          }
          .actions {
            margin-top: 30px;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0 10px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-primary {
            background: #007bff;
            color: white;
          }
          .btn-primary:hover {
            background: #0056b3;
          }
          .btn-secondary {
            background: #6c757d;
            color: white;
          }
          .btn-secondary:hover {
            background: #545b62;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🚫</div>
          <h1>Site Visit Limit Reached</h1>
          <div class="site-url">${siteLimit.url}</div>
          <div class="message">
            You've reached your visit limit for this site. Take a break and come back later!
          </div>
          <div class="stats">
            <div class="stat-row">
              <span class="stat-label">Visits Today:</span>
              <span class="stat-value">${siteLimit.visitCount}/${siteLimit.visitLimit}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Limit Resets In:</span>
              <span class="stat-value">${timeUntilReset}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Interval:</span>
              <span class="stat-value">Per ${siteLimit.timeInterval}</span>
            </div>
          </div>
          <div class="actions">
            <button class="btn btn-primary" onclick="window.close()">Close Tab</button>
            <button class="btn btn-secondary" onclick="history.back()">Go Back</button>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private async getStorageData(): Promise<StorageData> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['siteLimits'], (result) => {
        resolve({
          siteLimits: result.siteLimits || {}
        });
      });
    });
  }
}

// Initialize the background service
new TabLimiterBackground();