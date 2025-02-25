import { parse } from "https://deno.land/x/xml@6.0.4/mod.ts";
import { ParseError, RSSDocument, ValidationError } from "./types.ts";

export class RSSParser {
  /**
   * XMLコンテンツをパースしてRSSドキュメントを返す
   */
  static async parse(content: string): Promise<RSSDocument> {
    if (!content.trim()) {
      throw new ValidationError("Empty content");
    }

    // XMLの基本的な形式チェック
    if (
      !content.trim().startsWith("<?xml") && !content.trim().startsWith("<rss")
    ) {
      throw new ValidationError(
        "Invalid XML format: Document must start with XML declaration or RSS tag",
      );
    }

    let doc: unknown;
    try {
      doc = await Promise.resolve(parse(content));
      console.log("Parsed document:", JSON.stringify(doc, null, 2));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error occurred";
      throw new ParseError(`Failed to parse XML: ${errorMessage}`);
    }

    if (!RSSParser.isValidRSSDocument(doc)) {
      throw new ValidationError(
        "Invalid RSS format: Document structure is invalid",
      );
    }

    return RSSParser.normalizeDocument(doc as RSSDocument);
  }

  /**
   * パースされたドキュメントがRSS形式として有効かチェック
   */
  private static isValidRSSDocument(doc: unknown): doc is RSSDocument {
    if (typeof doc !== "object" || doc === null) {
      return false;
    }

    const maybeRSS = doc as RSSDocument;

    // rssプロパティの存在チェック
    if (!maybeRSS.rss || typeof maybeRSS.rss !== "object") {
      return false;
    }

    // channelプロパティの存在チェック
    if (!maybeRSS.rss.channel || typeof maybeRSS.rss.channel !== "object") {
      return false;
    }

    // RSSの仕様では複数のchannelは許可されていない
    if (Array.isArray(maybeRSS.rss.channel)) {
      return false;
    }

    return true;
  }

  /**
   * RSSアイテムの形式が有効かチェック
   */
  private static isValidRSSItem(item: unknown): boolean {
    if (typeof item !== "object" || item === null) {
      return false;
    }
    return true;
  }

  /**
   * ドキュメントの値を正規化
   */
  private static normalizeDocument(doc: RSSDocument): RSSDocument {
    const channel = doc.rss?.channel;
    if (!channel) {
      return doc;
    }

    // チャンネルのプロパティを正規化
    channel.title = String(channel.title ?? "");
    channel.link = String(channel.link ?? "");
    channel.description = String(channel.description ?? "");

    // アイテムを正規化
    if (Array.isArray(channel.item)) {
      channel.item = channel.item.map((item) => ({
        title: String(item.title ?? ""),
        link: String(item.link ?? ""),
        description: String(item.description ?? ""),
        pubDate: String(item.pubDate ?? ""),
      }));
    } else if (channel.item) {
      channel.item = {
        title: String(channel.item.title ?? ""),
        link: String(channel.item.link ?? ""),
        description: String(channel.item.description ?? ""),
        pubDate: String(channel.item.pubDate ?? ""),
      };
    }

    return doc;
  }
}
