import { expect } from "jsr:@std/expect";
import { handleRSS } from "../routes/rss.ts";
import { ValidURLList } from "../domain/rss/types.ts";

const TEST_FEED_URL = "https://example.com/feed.xml";
const MOCK_RSS_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>Test Description</description>
    <item>
      <title>Test Item 1</title>
      <link>https://example.com/article1</link>
      <description>Test Item Description 1</description>
    </item>
    <item>
      <title>Test Item 2</title>
      <link>https://example.com/article2</link>
      <description>Test Item Description 2</description>
    </item>
  </channel>
</rss>`;

// テスト用のKVデータをクリーンアップ
async function cleanupTestData() {
  const kv = await Deno.openKv();
  await kv.delete(["rss", TEST_FEED_URL]);
  await kv.delete(["valid_urls", TEST_FEED_URL]);
  await kv.close();
}

Deno.test({
  name: "RSS Handler - Setup",
  fn: async () => {
    await cleanupTestData();
  }
});

Deno.test({
  name: "RSS Handler - Missing URL",
  fn: async () => {
    const request = new Request("http://localhost:8000/rss");
    const response = await handleRSS("", request);
    expect(response.status).toBe(400);
    await response.body?.cancel();
  }
});

Deno.test({
  name: "RSS Handler - Invalid URL",
  fn: async () => {
    const request = new Request("http://localhost:8000/rss");
    const response = await handleRSS("not-a-url", request);
    expect(response.status).toBe(400);
    await response.body?.cancel();
  }
});

Deno.test({
  name: "RSS Handler - Successful Response with Link Transformation",
  fn: async () => {
    // モックのフェッチ関数を設定
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      return Promise.resolve(new Response(MOCK_RSS_CONTENT, {
        status: 200
      }));
    };

    try {
      const request = new Request("http://localhost:8000/rss");
      const response = await handleRSS(TEST_FEED_URL, request);
      expect(response.status).toBe(200);
      
      const contentType = response.headers.get("Content-Type");
      expect(contentType).toBe("application/xml");

      const content = await response.text();
      // 基本的なXML構造の確認
      expect(content).toMatch(/<rss.*?version="2\.0"/);
      expect(content).toMatch(/<title>Test Feed<\/title>/);

      // リンクの変換を確認
      expect(content).toMatch(/http:\/\/localhost:8000\/content\/\?contentURL=https%3A%2F%2Fexample.com%2Farticle1/);
      expect(content).toMatch(/http:\/\/localhost:8000\/content\/\?contentURL=https%3A%2F%2Fexample.com%2Farticle2/);

      // KVに保存された有効なURLリストを確認
      const kv = await Deno.openKv();
      const validUrls = await kv.get<ValidURLList>(["valid_urls", TEST_FEED_URL]);
      const urls = validUrls.value?.urls ?? [];
      expect(urls).toContain("https://example.com/article1");
      expect(urls).toContain("https://example.com/article2");
      await kv.close();
    } finally {
      // オリジナルのフェッチ関数を復元
      globalThis.fetch = originalFetch;
    }
  }
});

Deno.test({
  name: "RSS Handler - Cleanup",
  fn: async () => {
    await cleanupTestData();
  }
});