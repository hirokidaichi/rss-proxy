import { Context } from "hono";
import { RSSRepository } from "../domain/rss/repository.ts";

const kv = await Deno.openKv();
const repository = new RSSRepository(kv);

export async function handleContent(contentURL: string): Promise<Response> {
  // バリデーション
  try {
    new URL(contentURL);
  } catch {
    return new Response("Invalid contentURL", { 
      status: 400,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }

  // URLが有効なリストに含まれているか確認
  const isValidUrl = await repository.isValidContentUrl(contentURL);
  if (!isValidUrl) {
    return new Response("URL not found in allowed list", { 
      status: 403,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }

  try {
    // コンテンツの取得
    const response = await fetch(contentURL);
    if (!response.ok) {
      return new Response("Failed to fetch content", { 
        status: 502,
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }

    const content = await response.text();
    const contentType = response.headers.get("Content-Type") || "text/html";

    return new Response(content, {
      headers: { 
        "Content-Type": contentType,
        "X-Original-URL": contentURL
      },
    });
  } catch (error) {
    console.error("Error fetching content:", error);
    return new Response("Error fetching content", { 
      status: 502,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }
}