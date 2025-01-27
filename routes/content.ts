import { Context } from "hono";
import { RSSRepository } from "../domain/rss/repository.ts";
import { ResponseHelper } from "../domain/rss/response_helper.ts";

const kv = await Deno.openKv();
const repository = new RSSRepository(kv);

export async function handleContent(contentURL: string, request: Request): Promise<Response> {
  // バリデーション
  try {
    new URL(contentURL);
  } catch {
    return ResponseHelper.createErrorResponse("Invalid contentURL", 400);
  }

  // URLが有効なリストに含まれているか確認
  const isValidUrl = await repository.isValidContentUrl(contentURL);
  if (!isValidUrl) {
    return ResponseHelper.createErrorResponse("URL not found in allowed list", 403);
  }

  try {
    // コンテンツの取得
    const response = await fetch(contentURL);
    if (!response.ok) {
      return ResponseHelper.createErrorResponse("Failed to fetch content", 502);
    }

    const content = await response.text();
    const contentType = response.headers.get("Content-Type") || "text/html";

    return ResponseHelper.createHTMLResponse(content, {
      originalUrl: contentURL,
      compress: ResponseHelper.supportsCompression(request)
    });
  } catch (error) {
    console.error("Error fetching content:", error);
    return ResponseHelper.createErrorResponse("Error fetching content", 502);
  }
}