import { expect } from "jsr:@std/expect";
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";
import { RSSDocument } from "../../domain/rss/types.ts";

const TEST_SERVER = "http://localhost:8000";
const TEST_FEED_URL = "https://techcrunch.com/feed/";

let serverProcess: Deno.ChildProcess | null = null;

async function startServer(): Promise<void> {
  // 既存のサーバープロセスを終了
  await stopServer();

  console.log("Starting server...");
  serverProcess = new Deno.Command("deno", {
    args: ["task", "start"],
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  // サーバーが起動するまで待機
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(TEST_SERVER);
      await response.body?.cancel();
      if (response.status === 404) { // 404は正常（ルートパスは未定義）
        console.log("Server started successfully");
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("Failed to start server");
}

async function stopServer(): Promise<void> {
  if (serverProcess) {
    console.log("Stopping server...");
    try {
      serverProcess.kill("SIGTERM");
      const status = await serverProcess.status;
      console.log(`Server stopped with status: ${status.code}`);
    } catch (error) {
      console.error("Error stopping server:", error);
    } finally {
      serverProcess = null;
    }
  }
}

// テスト実行前にサーバーを起動
Deno.test({
  name: "Integration Tests",
  ignore: true,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    try {
      await startServer();

      await t.step("RSS and Content Endpoints", async () => {
        // 1. RSSフィードの取得
        const rssResponse = await fetch(
          `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(TEST_FEED_URL)}`,
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
        const firstItemLink = firstItem.link;
        if (!firstItemLink) {
          throw new Error("First item link is missing");
        }
        expect(firstItemLink).toMatch(
          new RegExp(`${TEST_SERVER}/content/\\?contentURL=`),
        );

        // 3. コンテンツの取得
        const originalUrl = decodeURIComponent(
          firstItemLink.split("contentURL=")[1],
        );
        const contentResponse = await fetch(
          `${TEST_SERVER}/content/?contentURL=${
            encodeURIComponent(originalUrl)
          }`,
        );
        expect(contentResponse.status).toBe(200);

        const contentType = contentResponse.headers.get("Content-Type");
        expect(contentType).toMatch(/text\/html/);

        const content = await contentResponse.text();
        expect(content.length).toBeGreaterThan(0);

        // 4. キャッシュの確認
        const secondRssResponse = await fetch(
          `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(TEST_FEED_URL)}`,
        );
        expect(secondRssResponse.headers.get("X-Cache")).toBe("HIT");
        await secondRssResponse.body?.cancel();

        // 5. 不正なURLのテスト
        const invalidContentResponse = await fetch(
          `${TEST_SERVER}/content/?contentURL=${
            encodeURIComponent("https://example.com")
          }`,
        );
        expect(invalidContentResponse.status).toBe(403);
        await invalidContentResponse.body?.cancel();

        const invalidRssResponse = await fetch(
          `${TEST_SERVER}/rss/?feedURL=invalid-url`,
        );
        expect(invalidRssResponse.status).toBe(400);
        await invalidRssResponse.body?.cancel();
      });

      // サーバーを再起動してキャッシュをクリア
      await startServer();

      await t.step("Concurrent Requests", async () => {
        const requests = Array(5).fill(null).map(() =>
          fetch(
            `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(TEST_FEED_URL)}`,
          )
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
      });

      // サーバーを再起動してキャッシュをクリア
      await startServer();

      await t.step("RSS Feed Fetch Failure", async () => {
        const invalidFeedUrl =
          "https://invalid-domain-that-does-not-exist.com/feed.xml";
        const response = await fetch(
          `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(invalidFeedUrl)}`,
        );
        expect(response.status).toBe(502);
        const errorMessage = await response.text();
        expect(errorMessage).toBe("Failed to fetch RSS feed");
      });

      // サーバーを再起動してキャッシュをクリア
      await startServer();

      await t.step("Invalid RSS Format", async () => {
        const invalidRssUrl = "https://example.com/invalid-rss";
        const originalFetch = globalThis.fetch;
        try {
          globalThis.fetch = () => {
            return Promise.resolve(
              new Response("Not an XML content", {
                status: 200,
                headers: { "Content-Type": "text/plain" },
              }),
            );
          };

          const response = await fetch(
            `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(invalidRssUrl)}`,
          );
          expect(response.status).toBe(502);
          const errorMessage = await response.text();
          expect(errorMessage).toBe(
            "Invalid XML format: Document must start with XML declaration or RSS tag",
          );
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      // サーバーを再起動してキャッシュをクリア
      await startServer();

      await t.step("Content Fetch Timeout", async () => {
        const timeoutUrl = "https://example.com/timeout";
        const originalFetch = globalThis.fetch;
        try {
          globalThis.fetch = async () => {
            await new Promise((resolve) => setTimeout(resolve, 6000)); // 6秒待機
            throw new Error("Request timeout");
          };

          const response = await fetch(
            `${TEST_SERVER}/content/?contentURL=${
              encodeURIComponent(timeoutUrl)
            }`,
          );
          expect(response.status).toBe(502);
          const errorMessage = await response.text();
          expect(errorMessage).toBe("Request timeout");
        } finally {
          globalThis.fetch = originalFetch;
        }
      });
    } finally {
      await stopServer();
    }
  },
});
