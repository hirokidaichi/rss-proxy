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
  size?: number; // コンテンツのサイズ（バイト）
  lastAccessed?: number; // 最後にアクセスされた時刻
}

export interface ValidURLList {
  urls: string[];
  timestamp: number;
}

export interface CacheStats {
  totalSize: number; // 全キャッシュの合計サイズ（バイト）
  entryCount: number; // キャッシュエントリー数
  oldestTimestamp: number; // 最も古いエントリーのタイムスタンプ
  hitCount: number; // キャッシュヒット数
  missCount: number; // キャッシュミス数
  hitRate: number; // キャッシュヒット率
  cleanupCount: number; // クリーンアップ実行回数
  lastCleanupDuration: number; // 最後のクリーンアップ所要時間（ミリ秒）
  memoryUsageRatio: number; // メモリ使用率
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  cleanups: number;
  lastCleanupDuration: number;
  hitRate: number;
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

export class CacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CacheError";
  }
}
