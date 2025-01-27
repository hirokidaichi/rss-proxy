import { expect } from "jsr:@std/expect";
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";
import { RSSDocument } from "../../domain/rss/types.ts";

const TEST_SERVER = "http://localhost:8000";
const TEST_FEED_URL = "https://techcrunch.com/feed/";

// テスト用のサーバーが起動していることを確認
async function checkServer(): Promise<boolean> {
  try {
    const response = await fetch(TEST_SERVER);
    await response.body?.cancel();
    return response.status === 404; // 404は正常（ルートパスは未定義）
  } catch {
    return false;
  }
}

// インテグレーションテストは一時的にスキップ
// サーバーの起動が必要なため、CIで実行する際は別途設定が必要
Deno.test({
  name: "Integration Test - RSS and Content Endpoints",
  ignore: false,
  fn: async () => {
    // サーバーの起動確認
    const isServerRunning = await checkServer();
    if (!isServerRunning) {
      throw new Error("Test server is not running. Please start the server with 'deno task start'");
    }

    // 1. RSSフィードの取得
    const rssResponse = await fetch(
      `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(TEST_FEED_URL)}`
    );
    expect(rssResponse.status).toBe(200);
    expect(rssResponse.headers.get("Content-Type")).toBe("application/xml");

    const rssContent = await rssResponse.text();
    const rssDoc = parse(rssContent) as RSSDocument;

    // RSSの基本構造を確認
    expect(typeof rssDoc.rss?.channel?.title).toBe("string");
    expect(typeof rssDoc.rss?.channel?.link).toBe("string");
    expect(typeof rssDoc.rss?.channel?.description).toBe("string");

    // アイテムの存在を確認
    const items = rssDoc.rss?.channel?.item || [];
    const itemArray = Array.isArray(items) ? items : [items];
    expect(itemArray.length).toBeGreaterThan(0);

    // 2. 変換されたリンクの確認
    const firstItem = itemArray[0];
    expect(firstItem.link).toMatch(new RegExp(`${TEST_SERVER}/content/\\?contentURL=`));

    // 3. コンテンツの取得
    const originalUrl = decodeURIComponent(
      new URL(firstItem.link || "").searchParams.get("contentURL") || ""
    );
    const contentResponse = await fetch(
      `${TEST_SERVER}/content/?contentURL=${encodeURIComponent(originalUrl)}`
    );
    expect(contentResponse.status).toBe(200);
    
    const contentType = contentResponse.headers.get("Content-Type");
    expect(contentType).toMatch(/text\/html/);

    const content = await contentResponse.text();
    expect(content.length).toBeGreaterThan(0);

    // 4. キャッシュの確認
    const secondRssResponse = await fetch(
      `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(TEST_FEED_URL)}`
    );
    expect(secondRssResponse.headers.get("X-Cache")).toBe("HIT");
    await secondRssResponse.body?.cancel();

    // 5. 不正なURLのテスト
    const invalidContentResponse = await fetch(
      `${TEST_SERVER}/content/?contentURL=${encodeURIComponent("https://example.com")}`
    );
    expect(invalidContentResponse.status).toBe(403);
    await invalidContentResponse.body?.cancel();

    const invalidRssResponse = await fetch(
      `${TEST_SERVER}/rss/?feedURL=invalid-url`
    );
    expect(invalidRssResponse.status).toBe(400);
    await invalidRssResponse.body?.cancel();
  }
});

// 同時リクエストのテスト
Deno.test({
  name: "Integration Test - Concurrent Requests",
  ignore: true,
  fn: async () => {
    const requests = Array(5).fill(null).map(() => 
      fetch(`${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(TEST_FEED_URL)}`)
    );

    const responses = await Promise.all(requests);
    
    // すべてのリクエストが成功することを確認
    for (const response of responses) {
      expect(response.status).toBe(200);
      await response.body?.cancel();
    }

    // 最後のリクエストがキャッシュヒットすることを確認
    const lastResponse = responses[responses.length - 1];
    expect(lastResponse.headers.get("X-Cache")).toBe("HIT");
  }
});

// RSSフィードの取得失敗テスト
Deno.test({
  name: "Integration Test - RSS Feed Fetch Failure",
  ignore: true,
  fn: async () => {
    const invalidFeedUrl = "https://invalid-domain-that-does-not-exist.com/feed.xml";
    const response = await fetch(
      `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(invalidFeedUrl)}`
    );
    expect(response.status).toBe(502);
    const errorMessage = await response.text();
    expect(errorMessage).toMatch(/Failed to fetch RSS feed/);
  }
});

// 無効なRSS形式のテスト
Deno.test({
  name: "Integration Test - Invalid RSS Format",
  ignore: true,
  fn: async () => {
    const invalidRssUrl = "https://example.com/invalid-rss";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      return Promise.resolve(new Response("Invalid RSS Content", {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      }));
    };

    try {
      const response = await fetch(
        `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(invalidRssUrl)}`
      );
      expect(response.status).toBe(502);
      const errorMessage = await response.text();
      expect(errorMessage).toMatch(/Failed to parse RSS feed/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

// コンテンツ取得タイムアウトテスト
Deno.test({
  name: "Integration Test - Content Fetch Timeout",
  ignore: true,
  fn: async () => {
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
      expect(response.status).toBe(504);
      const errorMessage = await response.text();
      expect(errorMessage).toMatch(/Request timeout/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});