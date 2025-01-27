import { RSSDocument, RSSChannel, RSSItem } from "./types.ts";

export class RSSTransformer {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:8000") {
    this.baseUrl = baseUrl;
  }

  /**
   * RSSドキュメント内のリンクを変換
   */
  transform(doc: RSSDocument): { transformed: RSSDocument; originalUrls: Set<string> } {
    const originalUrls = new Set<string>();
    const channel = doc.rss?.channel;

    if (!channel) {
      return { transformed: doc, originalUrls };
    }

    const transformedDoc = structuredClone(doc);
    const transformedChannel = transformedDoc.rss!.channel!;

    if (Array.isArray(transformedChannel.item)) {
      transformedChannel.item = transformedChannel.item.map(item => {
        const { transformedItem, originalUrl } = this.transformItem(item);
        if (originalUrl) {
          originalUrls.add(originalUrl);
        }
        return transformedItem;
      });
    } else if (transformedChannel.item) {
      const { transformedItem, originalUrl } = this.transformItem(transformedChannel.item);
      if (originalUrl) {
        originalUrls.add(originalUrl);
      }
      transformedChannel.item = transformedItem;
    }

    return { transformed: transformedDoc, originalUrls };
  }

  /**
   * RSSドキュメントをXML文字列に変換
   */
  toXmlString(doc: RSSDocument): string {
    const channel = doc.rss?.channel;
    if (!channel) {
      throw new Error("Invalid RSS document: missing channel");
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${this.escapeXml(channel.title || "")}</title>
    <link>${this.escapeXml(channel.link || "")}</link>
    <description>${this.escapeXml(channel.description || "")}</description>
    ${this.itemsToXmlString(channel)}
  </channel>
</rss>`;
  }

  /**
   * 個別のRSSアイテムのリンクを変換
   */
  private transformItem(item: RSSItem): { transformedItem: RSSItem; originalUrl: string | null } {
    if (!item.link) {
      return { transformedItem: { ...item }, originalUrl: null };
    }

    const originalUrl = item.link;
    const transformedItem = {
      ...item,
      link: `${this.baseUrl}/content/?contentURL=${encodeURIComponent(originalUrl)}`
    };

    return { transformedItem, originalUrl };
  }

  /**
   * RSSアイテムをXML文字列に変換
   */
  private itemsToXmlString(channel: RSSChannel): string {
    if (Array.isArray(channel.item)) {
      return channel.item
        .map(item => this.singleItemToXmlString(item))
        .join("\n    ");
    } else if (channel.item) {
      return this.singleItemToXmlString(channel.item);
    }
    return "";
  }

  /**
   * 単一のRSSアイテムをXML文字列に変換
   */
  private singleItemToXmlString(item: RSSItem): string {
    return `<item>
      <title>${this.escapeXml(item.title || "")}</title>
      <link>${this.escapeXml(item.link || "")}</link>
      <description>${this.escapeXml(item.description || "")}</description>
    </item>`;
  }

  /**
   * XML特殊文字をエスケープ
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}