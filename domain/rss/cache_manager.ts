import { RSSCache, ValidURLList } from "./types.ts";

export class CacheManager {
  private kv: Deno.Kv;
  private maxCacheSize: number;
  private cleanupInterval: number;
  private lastCleanup: number;
  private memoryWarningThreshold: number;
  private metrics: {
    hits: number;
    misses: number;
    cleanups: number;
    lastCleanupDuration: number;
  };

  constructor(
    kv: Deno.Kv,
    options: {
      maxCacheSize?: number; // キャッシュの最大サイズ（バイト）
      cleanupInterval?: number; // クリーンアップの間隔（ミリ秒）
      memoryWarningThreshold?: number; // メモリ警告閾値（バイト）
    } = {}
  ) {
    this.kv = kv;
    this.maxCacheSize = options.maxCacheSize || 50 * 1024 * 1024; // デフォルト50MB
    this.cleanupInterval = options.cleanupInterval || 30 * 60 * 1000; // デフォルト30分
    this.memoryWarningThreshold = options.memoryWarningThreshold || 0.8; // デフォルト80%
    this.lastCleanup = Date.now();
    this.metrics = {
      hits: 0,
      misses: 0,
      cleanups: 0,
      lastCleanupDuration: 0
    };
  }

  /**
   * RSSコンテンツをキャッシュに保存
   */
  async cacheContent(feedUrl: string, content: string): Promise<void> {
    const cacheSize = new TextEncoder().encode(content).length;
    
    // キャッシュサイズをチェック
    if (cacheSize > this.maxCacheSize) {
      console.warn(`Cache size (${cacheSize} bytes) exceeds maximum size (${this.maxCacheSize} bytes) for ${feedUrl}`);
      return;
    }

    const cache: RSSCache = {
      content,
      timestamp: Date.now(),
      size: cacheSize,
      lastAccessed: Date.now()
    };

    // 現在のキャッシュ使用量をチェック
    const currentSize = await this.getCurrentCacheSize();
    if (currentSize + cacheSize > this.maxCacheSize) {
      await this.cleanupLRU(this.maxCacheSize * 0.2); // 20%のスペースを確保
    }

    await this.kv.set(["rss", feedUrl], cache);
    await this.checkAndCleanup();
    await this.checkMemoryUsage();
  }

  /**
   * キャッシュされたコンテンツを取得
   */
  async getCachedContent(feedUrl: string): Promise<RSSCache | null> {
    const result = await this.kv.get<RSSCache>(["rss", feedUrl]);
    
    if (!result.value) {
      this.metrics.misses++;
      return null;
    }

    // 期限切れチェック（5分）
    if (Date.now() - result.value.timestamp > 5 * 60 * 1000) {
      await this.kv.delete(["rss", feedUrl]);
      this.metrics.misses++;
      return null;
    }

    // 最終アクセス時刻を更新
    result.value.lastAccessed = Date.now();
    await this.kv.set(["rss", feedUrl], result.value);
    this.metrics.hits++;

    return result.value;
  }

  /**
   * 有効なURLリストを保存
   */
  async saveValidUrls(feedUrl: string, urls: Set<string>): Promise<void> {
    const validUrlList: ValidURLList = {
      urls: Array.from(urls),
      timestamp: Date.now()
    };

    await this.kv.set(["valid_urls", feedUrl], validUrlList);
    await this.checkAndCleanup();
  }

  /**
   * URLが有効なリストに含まれているか確認
   */
  async isValidContentUrl(contentUrl: string): Promise<boolean> {
    const validUrlsEntries = this.kv.list<ValidURLList>({ prefix: ["valid_urls"] });
    
    for await (const entry of validUrlsEntries) {
      if (!entry.value) continue;
      
      if (entry.value.urls.includes(contentUrl)) {
        return true;
      }

      // 期限切れのエントリーを削除
      if (Date.now() - entry.value.timestamp > 5 * 60 * 1000) {
        await this.kv.delete(entry.key);
      }
    }

    return false;
  }

  /**
   * 現在のキャッシュ使用量を取得
   */
  async getCurrentCacheSize(): Promise<number> {
    let totalSize = 0;
    const entries = this.kv.list<RSSCache>({ prefix: ["rss"] });
    
    for await (const entry of entries) {
      if (entry.value.size) {
        totalSize += entry.value.size;
      }
    }

    return totalSize;
  }

  /**
   * キャッシュのメトリクスを取得
   */
  getMetrics() {
    return {
      ...this.metrics,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0
    };
  }

  /**
   * メモリ使用量をチェック
   */
  private async checkMemoryUsage(): Promise<void> {
    const currentSize = await this.getCurrentCacheSize();
    const usageRatio = currentSize / this.maxCacheSize;

    if (usageRatio > this.memoryWarningThreshold) {
      console.warn(`High memory usage: ${(usageRatio * 100).toFixed(2)}% of maximum cache size`);
      console.warn(`Current cache size: ${(currentSize / 1024 / 1024).toFixed(2)}MB`);
      console.warn(`Maximum cache size: ${(this.maxCacheSize / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  /**
   * LRUベースのクリーンアップを実行
   */
  private async cleanupLRU(targetSpace: number): Promise<void> {
    const entries: { key: Deno.KvKey; value: RSSCache }[] = [];
    const rssEntries = this.kv.list<RSSCache>({ prefix: ["rss"] });
    
    for await (const entry of rssEntries) {
      entries.push(entry);
    }

    // 最終アクセス時刻でソート
    entries.sort((a, b) => (a.value.lastAccessed || 0) - (b.value.lastAccessed || 0));

    let freedSpace = 0;
    for (const entry of entries) {
      if (freedSpace >= targetSpace) break;
      await this.kv.delete(entry.key);
      freedSpace += entry.value.size || 0;
    }
  }

  /**
   * キャッシュのクリーンアップが必要か確認し、必要な場合は実行
   */
  private async checkAndCleanup(): Promise<void> {
    const now = Date.now();
    
    // クリーンアップの間隔をチェック
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }

    this.lastCleanup = now;
    await this.cleanup();
  }

  /**
   * 期限切れのキャッシュをクリーンアップ
   */
  private async cleanup(): Promise<void> {
    console.log("Starting cache cleanup...");
    const startTime = Date.now();
    let cleanedCount = 0;
    let freedSpace = 0;

    // RSSキャッシュのクリーンアップ
    const rssEntries = this.kv.list<RSSCache>({ prefix: ["rss"] });
    for await (const entry of rssEntries) {
      if (Date.now() - entry.value.timestamp > 5 * 60 * 1000) {
        await this.kv.delete(entry.key);
        freedSpace += entry.value.size || 0;
        cleanedCount++;
      }
    }

    // 有効なURLリストのクリーンアップ
    const urlEntries = this.kv.list<ValidURLList>({ prefix: ["valid_urls"] });
    for await (const entry of urlEntries) {
      if (Date.now() - entry.value.timestamp > 5 * 60 * 1000) {
        await this.kv.delete(entry.key);
        cleanedCount++;
      }
    }

    const duration = Date.now() - startTime;
    this.metrics.cleanups++;
    this.metrics.lastCleanupDuration = duration;

    console.log(`Cache cleanup completed in ${duration}ms:`);
    console.log(`- Cleaned ${cleanedCount} entries`);
    console.log(`- Freed ${(freedSpace / 1024 / 1024).toFixed(2)}MB of space`);
    console.log(`- Current hit rate: ${(this.getMetrics().hitRate * 100).toFixed(2)}%`);
  }
}