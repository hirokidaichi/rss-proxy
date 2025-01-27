import { RSSCache, ValidURLList } from "./types.ts";

export class RSSRepository {
  private kv: Deno.Kv;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5分

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  /**
   * RSSコンテンツのキャッシュを取得
   */
  async getCachedContent(feedUrl: string): Promise<RSSCache | null> {
    const cacheKey = ["rss", feedUrl];
    const result = await this.kv.get<RSSCache>(cacheKey);
    
    if (!result.value) {
      return null;
    }

    // キャッシュの有効期限チェック
    if (Date.now() - result.value.timestamp > RSSRepository.CACHE_DURATION) {
      await this.kv.delete(cacheKey);
      return null;
    }

    return result.value;
  }

  /**
   * RSSコンテンツをキャッシュに保存
   */
  async cacheContent(feedUrl: string, content: string): Promise<void> {
    const cacheKey = ["rss", feedUrl];
    const cache: RSSCache = {
      content,
      timestamp: Date.now(),
    };

    await this.kv.set(cacheKey, cache);
  }

  /**
   * 有効なURLリストを保存
   */
  async saveValidUrls(feedUrl: string, urls: Set<string>): Promise<void> {
    const key = ["valid_urls", feedUrl];
    const validUrlList: ValidURLList = {
      urls,
      timestamp: Date.now(),
    };

    await this.kv.set(key, validUrlList);
  }

  /**
   * URLが有効なリストに含まれているか確認
   */
  async isValidContentUrl(contentUrl: string): Promise<boolean> {
    const validUrlsEntries = this.kv.list<ValidURLList>({ prefix: ["valid_urls"] });
    
    for await (const entry of validUrlsEntries) {
      if (entry.value.urls.has(contentUrl)) {
        return true;
      }

      // 期限切れのエントリーを削除
      if (Date.now() - entry.value.timestamp > RSSRepository.CACHE_DURATION) {
        await this.kv.delete(entry.key);
      }
    }

    return false;
  }

  /**
   * 期限切れのキャッシュをクリーンアップ
   */
  async cleanupExpiredCache(): Promise<void> {
    const now = Date.now();

    // RSSキャッシュのクリーンアップ
    const rssEntries = this.kv.list<RSSCache>({ prefix: ["rss"] });
    for await (const entry of rssEntries) {
      if (now - entry.value.timestamp > RSSRepository.CACHE_DURATION) {
        await this.kv.delete(entry.key);
      }
    }

    // 有効なURLリストのクリーンアップ
    const urlEntries = this.kv.list<ValidURLList>({ prefix: ["valid_urls"] });
    for await (const entry of urlEntries) {
      if (now - entry.value.timestamp > RSSRepository.CACHE_DURATION) {
        await this.kv.delete(entry.key);
      }
    }
  }
}