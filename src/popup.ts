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

class TabLimiterPopup {
  private form: HTMLFormElement;
  private siteList: HTMLElement;
  private statusDiv: HTMLElement;

  constructor() {
    this.form = document.getElementById('addSiteForm') as HTMLFormElement;
    this.siteList = document.getElementById('siteList') as HTMLElement;
    this.statusDiv = document.getElementById('status') as HTMLElement;
    
    this.initializeEventListeners();
    this.loadSiteLimits();
  }

  private initializeEventListeners(): void {
    // Form submission
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addSiteLimit();
    });

    // Clear all limits
    document.getElementById('clearAllBtn')?.addEventListener('click', () => {
      this.clearAllLimits();
    });
  }

  private async addSiteLimit(): Promise<void> {
    const urlInput = document.getElementById('siteUrl') as HTMLInputElement;
    const limitInput = document.getElementById('visitLimit') as HTMLInputElement;
    const intervalSelect = document.getElementById('timeInterval') as HTMLSelectElement;

    const url = urlInput.value.trim();
    const visitLimit = parseInt(limitInput.value);
    const timeInterval = intervalSelect.value as 'hour' | 'day' | 'week' | 'minutes';

    if (!url || !visitLimit || visitLimit < 1) {
      this.showStatus('Please fill in all fields with valid values.', 'error');
      return;
    }

    // Normalize URL (remove protocol, www, trailing slash)
    const normalizedUrl = this.normalizeUrl(url);

    try {
      const data = await this.getStorageData();
      const siteId = this.generateId();

      const newSiteLimit: SiteLimit = {
        id: siteId,
        url: normalizedUrl,
        visitLimit,
        timeInterval,
        visitCount: 0,
        lastReset: Date.now(),
        createdAt: Date.now()
      };

      data.siteLimits[siteId] = newSiteLimit;

      await chrome.storage.sync.set(data);
      
      this.showStatus(`Added limit for ${normalizedUrl}`, 'success');
      this.form.reset();
      this.loadSiteLimits();
    } catch (error) {
      console.error('Error adding site limit:', error);
      this.showStatus('Error adding site limit. Please try again.', 'error');
    }
  }

  private normalizeUrl(url: string): string {
    // Remove protocol
    url = url.replace(/^https?:\/\//, '');
    // Remove www.
    url = url.replace(/^www\./, '');
    // Remove trailing slash
    url = url.replace(/\/$/, '');
    // Convert to lowercase
    return url.toLowerCase();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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

  private async loadSiteLimits(): Promise<void> {
    try {
      const data = await this.getStorageData();
      const siteLimits = Object.values(data.siteLimits);

      if (siteLimits.length === 0) {
        this.showEmptyState();
        return;
      }

      this.renderSiteLimits(siteLimits);
      
    } catch (error) {
      console.error('Error loading site limits:', error);
      this.showStatus('Error loading site limits.', 'error');
    }
  }

  private showEmptyState(): void {
    this.siteList.innerHTML = `
      <div class="empty-state">
        <p>No site limits configured yet.</p>
        <p>Add your first site above to get started!</p>
      </div>
    `;
  }

  //onclick="tabLimiterPopup.editSite('${limit.id}')"
  // onclick="tabLimiterPopup.deleteSite('${limit.id}')"

  private renderSiteLimits(siteLimits: SiteLimit[]): void {
    const sortedLimits = siteLimits.sort((a, b) => b.createdAt - a.createdAt);
    
    this.siteList.innerHTML = sortedLimits.map(limit => {
      const timeLeft = this.getTimeUntilReset(limit);
      const isLimitReached = limit.visitCount >= limit.visitLimit;
      
      return `
        <div class="site-item ${isLimitReached ? 'limit-reached' : ''}">
          <div class="site-info">
            <div class="site-url">${limit.url}</div>
            <div class="site-limit">
              ${limit.visitCount}/${limit.visitLimit} visits per ${limit.timeInterval}
              ${timeLeft ? ` • Resets ${timeLeft}` : ''}
            </div>
          </div>
          <div class="site-actions">
            <button data-siteid = ${limit.id} class="editBtn btn btn-small btn-secondary">Edit</button>
            <button  data-siteid = ${limit.id} class="deleteBtn btn btn-small btn-danger">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    
      this.siteList.querySelectorAll('.editBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const siteId = (e.currentTarget as HTMLElement).dataset.siteid!;
      // this.editSite(siteId);
    });
  });

  this.siteList.querySelectorAll('.deleteBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const siteId = (e.currentTarget as HTMLElement).dataset.siteid!;
      this.deleteSite(siteId);
    });
  });

  }

  private getTimeUntilReset(limit: SiteLimit): string {
    const now = Date.now();
    const lastReset = limit.lastReset;
    
    let resetInterval: number = 0;
    switch (limit.timeInterval) {
      case 'hour':
        resetInterval = 60 * 60 * 1000;
        break;
      case 'day':
        resetInterval = 24 * 60 * 60 * 1000;
        break;
      case 'week':
        resetInterval = 7 * 24 * 60 * 60 * 1000;
        break;
          case 'minutes':
        resetInterval = 30 * 60 * 1000;
        break;
    }

    const nextReset = lastReset + resetInterval;
    const timeLeft = nextReset - now;

    if (timeLeft <= 0) {
      return '';
    }

    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days} day${days !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  }

  public async deleteSite(siteId: string): Promise<void> {
    try {
      const data = await this.getStorageData();
      const siteUrl = data.siteLimits[siteId]?.url;
      
      delete data.siteLimits[siteId];
      await chrome.storage.sync.set(data);
      
      this.showStatus(`Removed limit for ${siteUrl}`, 'success');
      this.loadSiteLimits();
    } catch (error) {
      console.error('Error deleting site:', error);
      this.showStatus('Error deleting site limit.', 'error');
    }
  }

  private async clearAllLimits(): Promise<void> {
    if (!confirm('Are you sure you want to clear all site limits? This cannot be undone.')) {
      return;
    }

    try {
      await chrome.storage.sync.set({ siteLimits: {} });
      this.showStatus('All site limits cleared.', 'success');
      this.loadSiteLimits();
    } catch (error) {
      console.error('Error clearing limits:', error);
      this.showStatus('Error clearing site limits.', 'error');
    }
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    this.statusDiv.style.display = 'block';

    setTimeout(() => {
      this.statusDiv.style.display = 'none';
    }, 3000);
  }
}

// Global instance for onclick handlers
let tabLimiterPopup: TabLimiterPopup | undefined;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  tabLimiterPopup = new TabLimiterPopup();
  // Make it globally accessible for onclick handlers
  (window as any).tabLimiterPopup = tabLimiterPopup;
});
