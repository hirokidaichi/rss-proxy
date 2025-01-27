import { gzip } from "https://deno.land/x/compress@v0.4.5/mod.ts";
import { compress as brotli } from "https://deno.land/x/brotli@v0.1.4/mod.ts";
import { Md5 } from "https://deno.land/std@0.110.0/hash/md5.ts";

export class ResponseHelper {
  // 圧縮の最小サイズ（バイト）
  private static readonly MIN_COMPRESS_SIZE = 1024; // 1KB
  // 圧縮の最大サイズ（バイト）
  private static readonly MAX_COMPRESS_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * XMLレスポンスを生成
   */
  static createXMLResponse(
    content: string,
    options: {
      status?: number;
      cacheHit?: boolean;
      timestamp?: number;
      compress?: boolean;
      maxAge?: number;
    } = {},
  ): Response {
    const contentBuffer = new TextEncoder().encode(content);
    const etag = new Md5().update(contentBuffer).toString();
    const maxAge = options.maxAge || 300; // デフォルト5分間

    const headers = new Headers({
      "Content-Type": "application/xml",
      "Cache-Control": `public, max-age=${maxAge}, must-revalidate`,
      "Vary": "Accept-Encoding, Accept, If-None-Match",
      "ETag": `"${etag}"`,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });

    if (options.cacheHit !== undefined) {
      headers.set("X-Cache", options.cacheHit ? "HIT" : "MISS");
    }

    if (options.timestamp !== undefined) {
      headers.set("X-Cache-Timestamp", options.timestamp.toString());
      headers.set("Last-Modified", new Date(options.timestamp).toUTCString());
    }

    // コンテンツサイズに基づいて圧縮を判断
    const shouldCompress = options.compress &&
      contentBuffer.length >= this.MIN_COMPRESS_SIZE &&
      contentBuffer.length <= this.MAX_COMPRESS_SIZE;

    if (shouldCompress) {
      // Brotli圧縮を試みる
      try {
        const compressed = brotli(contentBuffer);
        headers.set("Content-Encoding", "br");
        return new Response(compressed, {
          status: options.status || 200,
          headers,
        });
      } catch (error) {
        console.warn("Brotli compression failed, falling back to gzip:", error);
        // Brotli圧縮が失敗した場合はgzipにフォールバック
        const compressed = gzip(contentBuffer);
        headers.set("Content-Encoding", "gzip");
        return new Response(compressed, {
          status: options.status || 200,
          headers,
        });
      }
    }

    return new Response(content, {
      status: options.status || 200,
      headers,
    });
  }

  /**
   * HTMLレスポンスを生成
   */
  static createHTMLResponse(
    content: string,
    options: {
      status?: number;
      originalUrl?: string;
      compress?: boolean;
      csp?: boolean;
    } = {},
  ): Response {
    const contentBuffer = new TextEncoder().encode(content);
    const etag = new Md5().update(contentBuffer).toString();

    const headers = new Headers({
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store, must-revalidate",
      "Vary": "Accept-Encoding, Accept",
      "ETag": `"${etag}"`,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });

    if (options.csp) {
      headers.set(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' https:; script-src 'self'; style-src 'self' 'unsafe-inline'",
      );
    }

    if (options.originalUrl) {
      headers.set("X-Original-URL", options.originalUrl);
    }

    // コンテンツサイズに基づいて圧縮を判断
    const shouldCompress = options.compress &&
      contentBuffer.length >= this.MIN_COMPRESS_SIZE &&
      contentBuffer.length <= this.MAX_COMPRESS_SIZE;

    if (shouldCompress) {
      try {
        const compressed = brotli(contentBuffer);
        headers.set("Content-Encoding", "br");
        return new Response(compressed, {
          status: options.status || 200,
          headers,
        });
      } catch (error) {
        console.warn("Brotli compression failed, falling back to gzip:", error);
        const compressed = gzip(contentBuffer);
        headers.set("Content-Encoding", "gzip");
        return new Response(compressed, {
          status: options.status || 200,
          headers,
        });
      }
    }

    return new Response(content, {
      status: options.status || 200,
      headers,
    });
  }

  /**
   * エラーレスポンスを生成
   */
  static createErrorResponse(
    message: string,
    status: number,
    options: {
      json?: boolean;
    } = {},
  ): Response {
    const headers = new Headers({
      "Cache-Control": "no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    });

    if (options.json) {
      headers.set("Content-Type", "application/json");
      return new Response(
        JSON.stringify({ error: message, status }),
        { status, headers },
      );
    }

    headers.set("Content-Type", "text/plain");
    return new Response(message, { status, headers });
  }

  /**
   * 圧縮サポートを確認
   */
  static getCompressionType(request: Request): "br" | "gzip" | null {
    const acceptEncoding = request.headers.get("Accept-Encoding") || "";
    if (acceptEncoding.includes("br")) return "br";
    if (acceptEncoding.includes("gzip")) return "gzip";
    return null;
  }

  /**
   * If-None-Matchヘッダーをチェック
   */
  static isNotModified(request: Request, etag: string): boolean {
    const ifNoneMatch = request.headers.get("If-None-Match");
    return ifNoneMatch === `"${etag}"`;
  }

  /**
   * If-Modified-Sinceヘッダーをチェック
   */
  static isNotModifiedSince(request: Request, timestamp: number): boolean {
    const ifModifiedSince = request.headers.get("If-Modified-Since");
    if (!ifModifiedSince) {
      return false;
    }

    const ifModifiedSinceDate = new Date(ifModifiedSince).getTime();
    return timestamp <= ifModifiedSinceDate;
  }

  /**
   * 304 Not Modified レスポンスを生成
   */
  static createNotModifiedResponse(etag: string): Response {
    return new Response(null, {
      status: 304,
      headers: {
        "ETag": `"${etag}"`,
        "Cache-Control": "public, max-age=300, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  /**
   * 圧縮サポートを確認
   */
  static supportsCompression(request: Request): boolean {
    return this.getCompressionType(request) !== null;
  }
}
