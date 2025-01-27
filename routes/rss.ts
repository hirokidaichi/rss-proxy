import { Context } from "hono";
import { RSSParser } from "../domain/rss/parser.ts";
import { RSSTransformer } from "../domain/rss/transformer.ts";
import { RSSRepository } from "../domain/rss/repository.ts";
import { ParseError, ValidationError } from "../domain/rss/types.ts";

const kv = await Deno.openKv();
const repository = new RSSRepository(kv);
const transformer = new RSSTransformer("http://localhost:8000");

export async function handleRSS(feedURL: string): Promise<Response> {
  // バリデーション
  try {
    new URL(feedURL);
  } catch {
    return new Response("Invalid feedURL", { status: 400 });
  }

  try {
    // キャッシュチェック
    const cached = await repository.getCachedContent(feedURL);
    if (cached) {
      return new Response(cached.content, {
        headers: {
          "Content-Type": "application/xml",
          "X-Cache": "HIT",
          "X-Cache-Timestamp": cached.timestamp.toString()
        }
      });
    }

    // RSSフィードの取得
    const response = await fetch(feedURL);
    if (!response.ok) {
      return new Response("Failed to fetch RSS feed", { status: 502 });
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

    return new Response(transformedContent, {
      headers: {
        "Content-Type": "application/xml",
        "X-Cache": "MISS",
        "X-Cache-Timestamp": Date.now().toString()
      }
    });
  } catch (error) {
    console.error("Error processing RSS:", error);

    if (error instanceof ValidationError) {
      return new Response(error.message, { status: 400 });
    }

    if (error instanceof ParseError) {
      return new Response(error.message, { status: 502 });
    }

    return new Response("Internal server error", { status: 500 });
  }
}