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

    // 基本的なXMLバリデーション
    if (!content.trim().startsWith("<?xml") && !content.trim().startsWith("<rss")) {
      return ResponseHelper.createErrorResponse("Invalid XML format: Document must start with XML declaration or RSS tag", 502);
    }

    try {
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
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        return ResponseHelper.createErrorResponse(`Failed to parse XML: ${error.message}`, 502);
      }
      if (error instanceof ParseError || error instanceof ValidationError) {
        return ResponseHelper.createErrorResponse(error.message, 502);
      }
      throw error;
    }

  } catch (error: unknown) {
    console.error("Error processing RSS:", error);
    return ResponseHelper.createErrorResponse("Internal server error", 500);
  }
}