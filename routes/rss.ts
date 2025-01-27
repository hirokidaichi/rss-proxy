import { RSSParser } from "../domain/rss/parser.ts";
import { RSSTransformer } from "../domain/rss/transformer.ts";
import { RSSRepository } from "../domain/rss/repository.ts";
import { ResponseHelper } from "../domain/rss/response_helper.ts";
import { ParseError, ValidationError } from "../domain/rss/types.ts";

const kv = await Deno.openKv();
const repository = new RSSRepository(kv);
const transformer = new RSSTransformer("http://localhost:8000");

export async function handleRSS(feedURL: string, request: Request): Promise<Response> {
  // バリデーション
  try {
    new URL(feedURL);
  } catch {
    return ResponseHelper.createErrorResponse("Invalid feedURL", 400);
  }

  try {
    // キャッシュチェック
    const cached = await repository.getCachedContent(feedURL);
    if (cached) {
      // If-Modified-Sinceヘッダーのチェック
      if (ResponseHelper.isNotModifiedSince(request, cached.timestamp)) {
        return new Response(null, { status: 304 });
      }

      return ResponseHelper.createXMLResponse(cached.content, {
        cacheHit: true,
        timestamp: cached.timestamp,
        compress: ResponseHelper.supportsCompression(request)
      });
    }

    // RSSフィードの取得
    const response = await fetch(feedURL);
    if (!response.ok) {
      return ResponseHelper.createErrorResponse("Failed to fetch RSS feed", 502);
    }

    const content = await response.text();

    // RSSのパースと変換
    const doc = await RSSParser.parse(content);
    const { transformed, originalUrls } = transformer.transform(doc);
    const transformedContent = transformer.toXmlString(transformed);

    // 有効なURLリストを保存
    await repository.saveValidUrls(feedURL, originalUrls);

    // キャッシュに保存
    await repository.cacheContent(feedURL, transformedContent);

    const timestamp = Date.now();
    return ResponseHelper.createXMLResponse(transformedContent, {
      cacheHit: false,
      timestamp,
      compress: ResponseHelper.supportsCompression(request)
    });

  } catch (error) {
    console.error("Error processing RSS:", error);

    if (error instanceof ValidationError) {
      return ResponseHelper.createErrorResponse(error.message, 400);
    }

    if (error instanceof ParseError) {
      return ResponseHelper.createErrorResponse(error.message, 502);
    }

    return ResponseHelper.createErrorResponse("Internal server error", 500);
  }
}