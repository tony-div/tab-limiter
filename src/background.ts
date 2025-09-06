interface SiteLimit {
  id: string;
  url: string;
  visitLimit: number;
  timeInterval: 'hour' | 'day' | 'week' | 'minutes';
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


  // for any new tab these two methods will be called (creating , updating)
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
      const urlObj = new URL(url); // URL parser
      let hostname = urlObj.hostname;
      
      // Remove www. prefix ex : www.google.com => google
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
    
// multiply by 1000 to convert it to milliseconds
    switch (siteLimit.timeInterval) {
      case 'hour':
        return lastReset + (60 * 60 * 1000);
      case 'day':
        return lastReset + (24 * 60 * 60 * 1000);
      case 'week':
        return lastReset + (7 * 24 * 60 * 60 * 1000);
      case 'minutes':
        return lastReset + (30 * 60*1000)
      default:
        return lastReset + (24 * 60 * 60 * 1000);
    }
  }

  private async blockSite(tab: chrome.tabs.Tab, siteLimit: SiteLimit): Promise<void> {
    if (!tab.id) return;

    const nextReset = this.getResetTime(siteLimit);
    const timeUntilReset = this.formatTimeUntilReset(nextReset - Date.now());

    //MARKED UNUSED 

    try {
          const blockedPageUrl = chrome.runtime.getURL('/assets/Blocked.html') +
       `?timeUntilReset=${encodeURIComponent(timeUntilReset)}` +
       `&visitCount=${siteLimit.visitCount}` +
       `&visitLimit=${siteLimit.visitLimit}` +
       `&siteUrl=${encodeURIComponent(siteLimit.url)}` +
        `&timeInterval=${siteLimit.timeInterval}`;
         chrome.tabs.update(tab.id, { url: blockedPageUrl });

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




  private async getStorageData(): Promise<StorageData> {
    return new Promise((resolve) => {
      //get the item with key => siteLimits and return an object 
      chrome.storage.sync.get(['siteLimits'], (result) => {
        resolve({
          siteLimits: result.siteLimits || {}
        });
      });
    });
  }
}
+  /*
+  {
+    "siteLimits": {
+      "unique-id-123": {
+        "id": "unique-id-123",
+        "url": "facebook.com",
+        "visitLimit": 10,
+        "timeInterval": "day",
+        "visitCount": 5,
+        "lastReset": 1699999999999,
+        "createdAt": 1699999999999
+      }
+    }
+  }
+  */

// Initialize the background service
new TabLimiterBackground();