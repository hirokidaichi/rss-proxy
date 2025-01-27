import { assertEquals, assertStringIncludes } from "https://deno.land/std/testing/asserts.ts";
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";
import { RSSDocument, RSSCache } from "../../domain/rss/types.ts";

const TEST_SERVER = "http://localhost:8000";
const TEST_FEED_URL = "https://techcrunch.com/feed/";

// テスト用のサーバーが起動していることを確認
async function checkServer(): Promise<boolean> {
  try {
    const response = await fetch(TEST_SERVER);
    return response.status === 404; // 404は正常（ルートパスは未定義）
  } catch {
    return false;
  }
}

Deno.test({
  name: "Integration Test - RSS and Content Endpoints",
  async fn() {
    // サーバーの起動確認
    const isServerRunning = await checkServer();
    if (!isServerRunning) {
      throw new Error("Test server is not running. Please start the server with 'deno task start'");
    }

    // 1. RSSフィードの取得
    const rssResponse = await fetch(
      `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(TEST_FEED_URL)}`
    );
    assertEquals(rssResponse.status, 200);
    assertEquals(rssResponse.headers.get("Content-Type"), "application/xml");

    const rssContent = await rssResponse.text();
    const rssDoc = parse(rssContent) as RSSDocument;

    // RSSの基本構造を確認
    assertEquals(typeof rssDoc.rss?.channel?.title, "string");
    assertEquals(typeof rssDoc.rss?.channel?.link, "string");
    assertEquals(typeof rssDoc.rss?.channel?.description, "string");

    // アイテムの存在を確認
    const items = rssDoc.rss?.channel?.item || [];
    const itemArray = Array.isArray(items) ? items : [items];
    assertEquals(itemArray.length > 0, true);

    // 2. 変換されたリンクの確認
    const firstItem = itemArray[0];
    assertStringIncludes(
      firstItem.link || "",
      `${TEST_SERVER}/content/?contentURL=`
    );

    // 3. コンテンツの取得
    const originalUrl = decodeURIComponent(
      new URL(firstItem.link || "").searchParams.get("contentURL") || ""
    );
    const contentResponse = await fetch(
      `${TEST_SERVER}/content/?contentURL=${encodeURIComponent(originalUrl)}`
    );
    assertEquals(contentResponse.status, 200);
    
    const contentType = contentResponse.headers.get("Content-Type");
    assertStringIncludes(contentType || "", "text/html");

    const content = await contentResponse.text();
    assertEquals(content.length > 0, true);

    // 4. キャッシュの確認
    const secondRssResponse = await fetch(
      `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(TEST_FEED_URL)}`
    );
    assertEquals(secondRssResponse.headers.get("X-Cache"), "HIT");

    // 5. 不正なURLのテスト
    const invalidContentResponse = await fetch(
      `${TEST_SERVER}/content/?contentURL=${encodeURIComponent("https://example.com")}`
    );
    assertEquals(invalidContentResponse.status, 403);

    const invalidRssResponse = await fetch(
      `${TEST_SERVER}/rss/?feedURL=invalid-url`
    );
    assertEquals(invalidRssResponse.status, 400);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// 同時リクエストのテスト
Deno.test({
  name: "Integration Test - Concurrent Requests",
  async fn() {
    const requests = Array(5).fill(null).map(() => 
      fetch(`${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(TEST_FEED_URL)}`)
    );

    const responses = await Promise.all(requests);
    
    // すべてのリクエストが成功することを確認
    for (const response of responses) {
      assertEquals(response.status, 200);
    }

    // 最後のリクエストがキャッシュヒットすることを確認
    const lastResponse = responses[responses.length - 1];
    assertEquals(lastResponse.headers.get("X-Cache"), "HIT");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// RSSフィードの取得失敗テスト
Deno.test({
  name: "Integration Test - RSS Feed Fetch Failure",
  async fn() {
    const invalidFeedUrl = "https://invalid-domain-that-does-not-exist.com/feed.xml";
    const response = await fetch(
      `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(invalidFeedUrl)}`
    );
    assertEquals(response.status, 502);
    const errorMessage = await response.text();
    assertStringIncludes(errorMessage, "Failed to fetch RSS feed");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// 無効なRSS形式のテスト
Deno.test({
  name: "Integration Test - Invalid RSS Format",
  async fn() {
    const invalidRssUrl = "https://example.com/invalid-rss";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response("Invalid RSS Content", {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    };

    try {
      const response = await fetch(
        `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(invalidRssUrl)}`
      );
      assertEquals(response.status, 502);
      const errorMessage = await response.text();
      assertStringIncludes(errorMessage, "Failed to parse RSS feed");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// コンテンツ取得タイムアウトテスト
Deno.test({
  name: "Integration Test - Content Fetch Timeout",
  async fn() {
    const timeoutUrl = "https://example.com/timeout";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 6000)); // 6秒待機
      return new Response("Timeout Content");
    };

    try {
      const response = await fetch(
        `${TEST_SERVER}/content/?contentURL=${encodeURIComponent(timeoutUrl)}`
      );
      assertEquals(response.status, 504);
      const errorMessage = await response.text();
      assertStringIncludes(errorMessage, "Request timeout");
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});