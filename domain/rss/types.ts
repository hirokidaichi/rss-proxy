/**
 * RSSのドメインモデルを定義
 */

export interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
}

export interface RSSChannel {
  title?: string;
  link?: string;
  description?: string;
  item?: RSSItem | RSSItem[];
}

export interface RSSDocument {
  rss?: {
    channel?: RSSChannel;
  };
}

export interface RSSCache {
  content: string;
  timestamp: number;
}

export interface ValidURLList {
  urls: Set<string>;
  timestamp: number;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}