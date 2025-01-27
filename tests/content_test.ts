import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { handleContent } from "@routes/content.ts";

const TEST_CONTENT_URL = "https://example.com/article1";
const MOCK_HTML_CONTENT = `
<!DOCTYPE html>
<html>
  <head>
    <title>Test Article</title>
  </head>
  <body>
    <h1>Test Content</h1>
    <p>This is a test article content.</p>
  </body>
</html>`;

// テスト用のKVデータをセットアップ
async function setupTestData() {
  const kv = await Deno.openKv();
  await kv.set(["valid_urls", "test-feed"], [
    "https://example.com/article1",
    "https://example.com/article2"
  ]);
  await kv.close();
}

Deno.test("Content Handler - Setup", async () => {
  await setupTestData();
});

Deno.test("Content Handler - Missing URL", async () => {
  const response = await handleContent("");
  assertEquals(response.status, 400);
});

Deno.test("Content Handler - Invalid URL", async () => {
  const response = await handleContent("not-a-url");
  assertEquals(response.status, 400);
});

Deno.test("Content Handler - URL Not in Allowed List", async () => {
  const response = await handleContent("https://example.com/not-allowed");
  assertEquals(response.status, 403);
});

Deno.test("Content Handler - Successful Response", async () => {
  // モックのフェッチ関数を設定
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(MOCK_HTML_CONTENT, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  };

  try {
    const response = await handleContent(TEST_CONTENT_URL);
    assertEquals(response.status, 200);
    
    const contentType = response.headers.get("Content-Type");
    assertEquals(contentType, "text/html");

    const content = await response.text();
    assertEquals(content.includes("Test Content"), true);
    assertEquals(content.includes("test article content"), true);
  } finally {
    // オリジナルのフェッチ関数を復元
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Content Handler - Fetch Error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Network error");
  };

  try {
    const response = await handleContent(TEST_CONTENT_URL);
    assertEquals(response.status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Content Handler - Cleanup", async () => {
  const kv = await Deno.openKv();
  await kv.delete(["valid_urls", "test-feed"]);
  await kv.close();
});