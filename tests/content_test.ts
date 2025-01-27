import { expect } from "jsr:@std/expect";
import { handleContent } from "../routes/content.ts";

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
  await kv.set(["valid_urls", "test-feed"], {
    urls: [
      "https://example.com/article1",
      "https://example.com/article2"
    ],
    timestamp: Date.now()
  });
  await kv.close();
}

Deno.test("Content Handler - Setup", async () => {
  await setupTestData();
});

Deno.test("Content Handler - Missing URL", async () => {
  const request = new Request("http://localhost:8000/content");
  const response = await handleContent("", request);
  expect(response.status).toBe(400);
  await response.body?.cancel();
});

Deno.test("Content Handler - Invalid URL", async () => {
  const request = new Request("http://localhost:8000/content");
  const response = await handleContent("not-a-url", request);
  expect(response.status).toBe(400);
  await response.body?.cancel();
});

Deno.test("Content Handler - URL Not in Allowed List", async () => {
  const request = new Request("http://localhost:8000/content");
  const response = await handleContent("https://example.com/not-allowed", request);
  expect(response.status).toBe(403);
  await response.body?.cancel();
});

Deno.test("Content Handler - Successful Response", async () => {
  // モックのフェッチ関数を設定
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    return Promise.resolve(new Response(MOCK_HTML_CONTENT, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=UTF-8" },
    }));
  };

  try {
    const request = new Request("http://localhost:8000/content");
    const response = await handleContent(TEST_CONTENT_URL, request);
    expect(response.status).toBe(200);
    
    const contentType = response.headers.get("Content-Type");
    expect(contentType).toBe("text/html; charset=UTF-8");

    const content = await response.text();
    expect(content).toContain("Test Content");
    expect(content).toContain("test article content");
  } finally {
    // オリジナルのフェッチ関数を復元
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Content Handler - Fetch Error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    return Promise.reject(new Error("Network error"));
  };

  try {
    const request = new Request("http://localhost:8000/content");
    const response = await handleContent(TEST_CONTENT_URL, request);
    expect(response.status).toBe(502);
    await response.body?.cancel();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("Content Handler - Cleanup", async () => {
  const kv = await Deno.openKv();
  await kv.delete(["valid_urls", "test-feed"]);
  await kv.close();
});