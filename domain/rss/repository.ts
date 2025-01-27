import { CacheError, CacheStats, RSSCache, ValidURLList } from "./types.ts";
import { CacheManager } from "./cache_manager.ts";

export class RSSRepository {
  private cacheManager: CacheManager;

  constructor(kv: Deno.Kv) {
    this.cacheManager = new CacheManager(kv, {
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      cleanupInterval: 30 * 60 * 1000, // 30分
    });
  }

  /**
   * RSSコンテンツのキャッシュを取得
   */
  async getCachedContent(feedUrl: string): Promise<RSSCache | null> {
    try {
      return await this.cacheManager.getCachedContent(feedUrl);
    } catch (error: unknown) {
      console.error("Error getting cached content:", error);
      throw new CacheError(
        `Failed to get cached content: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * RSSコンテンツをキャッシュに保存
   */
  async cacheContent(feedUrl: string, content: string): Promise<void> {
    try {
      await this.cacheManager.cacheContent(feedUrl, content);
    } catch (error: unknown) {
      console.error("Error caching content:", error);
      throw new CacheError(
        `Failed to cache content: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * 有効なURLリストを保存
   */
  async saveValidUrls(feedUrl: string, urls: Set<string>): Promise<void> {
    try {
      await this.cacheManager.saveValidUrls(feedUrl, urls);
    } catch (error: unknown) {
      console.error("Error saving valid URLs:", error);
      throw new CacheError(
        `Failed to save valid URLs: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * URLが有効なリストに含まれているか確認
   */
  async isValidContentUrl(contentUrl: string): Promise<boolean> {
    try {
      return await this.cacheManager.isValidContentUrl(contentUrl);
    } catch (error: unknown) {
      console.error("Error checking valid content URL:", error);
      throw new CacheError(
        `Failed to check valid content URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * キャッシュの統計情報を取得
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const totalSize = await this.cacheManager.getCurrentCacheSize();
      let entryCount = 0;
      let oldestTimestamp = Date.now();

      // RSSキャッシュのエントリーをカウント
      const rssEntries = this.cacheManager["kv"].list<RSSCache>({
        prefix: ["rss"],
      });
      for await (const entry of rssEntries) {
        entryCount++;
        if (entry.value.timestamp < oldestTimestamp) {
          oldestTimestamp = entry.value.timestamp;
        }
      }

      // 有効なURLリストのエントリーをカウント
      const urlEntries = this.cacheManager["kv"].list<ValidURLList>({
        prefix: ["valid_urls"],
      });
      for await (const entry of urlEntries) {
        entryCount++;
        if (entry.value.timestamp < oldestTimestamp) {
          oldestTimestamp = entry.value.timestamp;
        }
      }

      // キャッシュマネージャーからメトリクスを取得
      const metrics = this.cacheManager.getMetrics();
      const maxCacheSize = this.cacheManager["maxCacheSize"];

      return {
        totalSize,
        entryCount,
        oldestTimestamp,
        hitCount: metrics.hits,
        missCount: metrics.misses,
        hitRate: metrics.hitRate,
        cleanupCount: metrics.cleanups,
        lastCleanupDuration: metrics.lastCleanupDuration,
        memoryUsageRatio: totalSize / maxCacheSize,
      };
    } catch (error: unknown) {
      console.error("Error getting cache stats:", error);
      throw new CacheError(
        `Failed to get cache stats: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  /**
   * キャッシュの手動クリーンアップを実行
   */
  async cleanup(): Promise<void> {
    try {
      await this.cacheManager["cleanup"]();
    } catch (error: unknown) {
      console.error("Error during cache cleanup:", error);
      throw new CacheError(
        `Failed to cleanup cache: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }
}
