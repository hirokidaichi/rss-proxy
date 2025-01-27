import { assertEquals, assertNotEquals } from "https://deno.land/std/testing/asserts.ts";
import { RSSRepository } from "../repository.ts";
import { RSSCache, ValidURLList } from "../types.ts";

const TEST_FEED_URL = "https://example.com/feed.xml";
const TEST_CONTENT = "Test RSS Content";
const TEST_URLS = new Set(["https://example.com/article1", "https://example.com/article2"]);

// テスト用のKVインスタンスを作成
async function createTestKv(): Promise<Deno.Kv> {
  return await Deno.openKv();
}

// テストデータをクリーンアップ
async function cleanupTestData(kv: Deno.Kv) {
  const rssEntries = kv.list({ prefix: ["rss"] });
  for await (const entry of rssEntries) {
    await kv.delete(entry.key);
  }

  const urlEntries = kv.list({ prefix: ["valid_urls"] });
  for await (const entry of urlEntries) {
    await kv.delete(entry.key);
  }
}

Deno.test({
  name: "RSSRepository - Setup",
  fn: async () => {
    const kv = await createTestKv();
    await cleanupTestData(kv);
    await kv.close();
  }
});

Deno.test({
  name: "RSSRepository - Cache Content",
  fn: async () => {
    const kv = await createTestKv();
    const repository = new RSSRepository(kv);

    try {
      // コンテンツをキャッシュ
      await repository.cacheContent(TEST_FEED_URL, TEST_CONTENT);

      // キャッシュされたコンテンツを取得
      const cached = await repository.getCachedContent(TEST_FEED_URL);
      assertEquals(cached?.content, TEST_CONTENT);
      assertNotEquals(cached?.timestamp, undefined);
    } finally {
      await cleanupTestData(kv);
      await kv.close();
    }
  }
});

Deno.test({
  name: "RSSRepository - Cache Expiration",
  fn: async () => {
    const kv = await createTestKv();
    const repository = new RSSRepository(kv);

    try {
      // 期限切れのキャッシュを作成
      const expiredCache: RSSCache = {
        content: TEST_CONTENT,
        timestamp: Date.now() - 6 * 60 * 1000 // 6分前
      };
      await kv.set(["rss", TEST_FEED_URL], expiredCache);

      // 期限切れのキャッシュを取得
      const cached = await repository.getCachedContent(TEST_FEED_URL);
      assertEquals(cached, null);

      // キャッシュが削除されていることを確認
      const result = await kv.get(["rss", TEST_FEED_URL]);
      assertEquals(result.value, null);
    } finally {
      await cleanupTestData(kv);
      await kv.close();
    }
  }
});

Deno.test({
  name: "RSSRepository - Valid URLs Management",
  fn: async () => {
    const kv = await createTestKv();
    const repository = new RSSRepository(kv);

    try {
      // 有効なURLリストを保存
      await repository.saveValidUrls(TEST_FEED_URL, TEST_URLS);

      // URLの有効性を確認
      const isValid1 = await repository.isValidContentUrl("https://example.com/article1");
      const isValid2 = await repository.isValidContentUrl("https://example.com/invalid");

      assertEquals(isValid1, true);
      assertEquals(isValid2, false);
    } finally {
      await cleanupTestData(kv);
      await kv.close();
    }
  }
});

Deno.test({
  name: "RSSRepository - Cleanup Expired Cache",
  fn: async () => {
    const kv = await createTestKv();
    const repository = new RSSRepository(kv);

    try {
      // 有効なキャッシュを作成
      const validCache: RSSCache = {
        content: TEST_CONTENT,
        timestamp: Date.now()
      };
      await kv.set(["rss", "valid-feed"], validCache);

      // 期限切れのキャッシュを作成
      const expiredCache: RSSCache = {
        content: TEST_CONTENT,
        timestamp: Date.now() - 6 * 60 * 1000 // 6分前
      };
      await kv.set(["rss", "expired-feed"], expiredCache);

      // 期限切れのURLリストを作成
      const expiredUrls: ValidURLList = {
        urls: new Set(["https://example.com/expired"]),
        timestamp: Date.now() - 6 * 60 * 1000
      };
      await kv.set(["valid_urls", "expired-feed"], expiredUrls);

      // クリーンアップを実行
      await repository.cleanupExpiredCache();

      // 有効なキャッシュは残っているか確認
      const validResult = await kv.get(["rss", "valid-feed"]);
      assertNotEquals(validResult.value, null);

      // 期限切れのキャッシュは削除されているか確認
      const expiredResult = await kv.get(["rss", "expired-feed"]);
      assertEquals(expiredResult.value, null);

      // 期限切れのURLリストは削除されているか確認
      const expiredUrlsResult = await kv.get(["valid_urls", "expired-feed"]);
      assertEquals(expiredUrlsResult.value, null);
    } finally {
      await cleanupTestData(kv);
      await kv.close();
    }
  }
});

Deno.test({
  name: "RSSRepository - Cleanup",
  fn: async () => {
    const kv = await createTestKv();
    await cleanupTestData(kv);
    await kv.close();
  }
});