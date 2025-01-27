import { Hono } from "hono";
import { logger } from "hono/middleware/logger/index.ts";
import { handleRSS } from "./routes/rss.ts";
import { handleContent } from "./routes/content.ts";

const app = new Hono();
const port = 8000;

// ロギングミドルウェアの追加
app.use("*", logger());

// RSSエンドポイント
app.get("/rss/", async (c) => {
  const feedURL = c.req.query("feedURL");
  if (!feedURL) {
    return c.text("Missing feedURL parameter", 400);
  }
  return await handleRSS(feedURL);
});

// コンテンツエンドポイント
app.get("/content/", async (c) => {
  const contentURL = c.req.query("contentURL");
  if (!contentURL) {
    return c.text("Missing contentURL parameter", 400);
  }
  return await handleContent(contentURL);
});

// エラーハンドリング
app.onError((err, c) => {
  console.error("Error:", err);
  return c.text("Internal Server Error", 500);
});

// 404ハンドリング
app.notFound((c) => c.text("Not Found", 404));

console.log(`Server is running on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);