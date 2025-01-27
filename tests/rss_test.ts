import { assertEquals, assertMatch } from "https://deno.land/std/testing/asserts.ts";
import { handleRSS } from "@routes/rss.ts";

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
    const response = await handleRSS("");
    assertEquals(response.status, 400);
  }
});

Deno.test({
  name: "RSS Handler - Invalid URL",
  fn: async () => {
    const response = await handleRSS("not-a-url");
    assertEquals(response.status, 400);
  }
});

Deno.test({
  name: "RSS Handler - Successful Response with Link Transformation",
  fn: async () => {
    // モックのフェッチ関数を設定
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(MOCK_RSS_CONTENT, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    };

    try {
      const response = await handleRSS(TEST_FEED_URL);
      assertEquals(response.status, 200);
      
      const contentType = response.headers.get("Content-Type");
      assertEquals(contentType, "application/xml");

      const content = await response.text();
      // 基本的なXML構造の確認
      assertMatch(content, /<rss.*?version="2\.0"/);
      assertMatch(content, /<title>Test Feed<\/title>/);

      // リンクの変換を確認
      assertMatch(content, /http:\/\/localhost:8000\/content\/\?contentURL=https%3A%2F%2Fexample.com%2Farticle1/);
      assertMatch(content, /http:\/\/localhost:8000\/content\/\?contentURL=https%3A%2F%2Fexample.com%2Farticle2/);

      // KVに保存された有効なURLリストを確認
      const kv = await Deno.openKv();
      const validUrls = await kv.get(["valid_urls", TEST_FEED_URL]);
      const urls = validUrls.value as string[];
      assertEquals(urls.includes("https://example.com/article1"), true);
      assertEquals(urls.includes("https://example.com/article2"), true);
      await kv.close();
    } finally {
      // オリジナルのフェッチ関数を復元
      globalThis.fetch = originalFetch;
    }
  }
});

Deno.test({
  name: "RSS Handler - Cache Test",
  fn: async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(MOCK_RSS_CONTENT, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    };

    try {
      // キャッシュをクリア
      const kv = await Deno.openKv();
      await kv.delete(["rss", TEST_FEED_URL]);
      await kv.close();

      // 1回目のリクエスト（キャッシュなし）
      const response1 = await handleRSS(TEST_FEED_URL);
      assertEquals(response1.headers.get("X-Cache"), "MISS");

      // 2回目のリクエスト（キャッシュあり）
      const response2 = await handleRSS(TEST_FEED_URL);
      assertEquals(response2.headers.get("X-Cache"), "HIT");

      // キャッシュの有効期限切れをシミュレート
      const kv2 = await Deno.openKv();
      const cachedData = await kv2.get(["rss", TEST_FEED_URL]);
      if (cachedData.value) {
        const value = cachedData.value as { content: string; timestamp: number };
        await kv2.set(["rss", TEST_FEED_URL], {
          content: value.content,
          timestamp: Date.now() - 6 * 60 * 1000, // 6分前
        });
      }
      await kv2.close();

      // 3回目のリクエスト（キャッシュ期限切れ）
      const response3 = await handleRSS(TEST_FEED_URL);
      assertEquals(response3.headers.get("X-Cache"), "MISS");
    } finally {
      // オリジナルのフェッチ関数を復元
      globalThis.fetch = originalFetch;
    }
  }
});

Deno.test({
  name: "RSS Handler - Parse Error",
  fn: async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response("Invalid XML Content", {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    };

    try {
      const response = await handleRSS(TEST_FEED_URL);
      assertEquals(response.status, 502, "Invalid XML should return 502 status");
      const content = await response.text();
      assertEquals(content, "Failed to parse RSS feed", "Error message should match");
    } finally {
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