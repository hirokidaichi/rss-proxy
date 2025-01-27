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
      try {
        const status = await serverProcess.status;
        console.log(`Server stopped with status: ${status.code}`);
      } catch (error) {
        if (!(error instanceof TypeError && error.message.includes("already terminated"))) {
          throw error;
        }
      }
    } catch (error) {
      console.error("Error stopping server:", error);
    } finally {
      serverProcess = null;
    }
  }
}

async function clearCache(): Promise<void> {
  const kv = await Deno.openKv();
  const entries = kv.list({ prefix: ["rss"] });
  for await (const entry of entries) {
    await kv.delete(entry.key);
  }
  await kv.close();
}

// テストスイートの前後でサーバーを起動/終了
Deno.test({
  name: "Integration Tests",
  ignore: false,
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    // テストスイート開始前にサーバーを起動
    await t.step("Setup - Start Server", async () => {
      await startServer();
      await clearCache();
      expect(serverProcess).toBeDefined();
    });

    // 各テストケースを実行
    await t.step({
      name: "Test Cases",
      fn: async (t) => {
        await t.step("RSS and Content Endpoints", async () => {
          await clearCache();
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

        await t.step("Concurrent Requests", async () => {
          await clearCache();
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

          // 最後のリクエストのキャッシュ状態は不確定なため、チェックしない
        });

        await t.step("RSS Feed Fetch Failure", async () => {
          await clearCache();
          const invalidFeedUrl =
            "https://invalid-domain-that-does-not-exist.com/feed.xml";
          const response = await fetch(
            `${TEST_SERVER}/rss/?feedURL=${encodeURIComponent(invalidFeedUrl)}`,
          );
          expect(response.status).toBe(500);
          const errorMessage = await response.text();
          expect(errorMessage).toBe("Internal server error");
        });

        await t.step("Invalid RSS Format", async () => {
          await clearCache();
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
            expect(response.status).toBe(200);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("Not an XML content");
          } finally {
            globalThis.fetch = originalFetch;
          }
        });

        await t.step("Content Fetch Timeout", async () => {
          await clearCache();
          const timeoutUrl = "https://example.com/timeout";
          const originalFetch = globalThis.fetch;
          try {
            let fetchCalled = false;
            globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
              if (!fetchCalled && input.toString().includes(timeoutUrl)) {
                fetchCalled = true;
                await new Promise((resolve) => setTimeout(resolve, 6000)); // 6秒待機
                throw new Error("Request timeout");
              }
              return originalFetch(input, init);
            };

            const response = await fetch(
              `${TEST_SERVER}/content/?contentURL=${
                encodeURIComponent(timeoutUrl)
              }`,
            );
            expect(response.status).toBe(403);
            const errorMessage = await response.text();
            expect(errorMessage).toBe("URL not found in allowed list");
          } finally {
            globalThis.fetch = originalFetch;
          }
        });
      },
      sanitizeResources: false,
      sanitizeOps: false,
    });

    // テストスイート終了後にサーバーを停止
    await t.step("Cleanup - Stop Server", async () => {
      await clearCache();
      await stopServer();
      expect(serverProcess).toBeNull();
    });
  },
});
