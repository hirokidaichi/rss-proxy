import { Hono } from "hono";
import { logger } from "hono/middleware/logger/index.ts";
import { handleRSS } from "./routes/rss.ts";
import { handleContent } from "./routes/content.ts";
import { ResponseHelper } from "./domain/rss/response_helper.ts";

const app = new Hono();
const port = 8000;

// ロギングミドルウェアの追加
app.use("*", logger());

// RSSエンドポイント
app.get("/rss/", async (c) => {
  const feedURL = c.req.query("feedURL");
  if (!feedURL) {
    return ResponseHelper.createErrorResponse("Missing feedURL parameter", 400);
  }
  return await handleRSS(feedURL, c.req.raw);
});

// コンテンツエンドポイント
app.get("/content/", async (c) => {
  const contentURL = c.req.query("contentURL");
  if (!contentURL) {
    return ResponseHelper.createErrorResponse("Missing contentURL parameter", 400);
  }
  return await handleContent(contentURL, c.req.raw);
});

// エラーハンドリング
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return ResponseHelper.createErrorResponse("Internal Server Error", 500);
});

// 404ハンドリング
app.notFound((c) => ResponseHelper.createErrorResponse("Not Found", 404));

// サーバー起動時の情報表示
console.log(`Server is running on http://localhost:${port}`);
console.log("Available endpoints:");
console.log("- GET /rss/?feedURL=<url>     : Fetch and transform RSS feed");
console.log("- GET /content/?contentURL=<url>: Fetch content from allowed URLs");

Deno.serve({ port }, app.fetch);