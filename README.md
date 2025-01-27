# RSS Proxy

RSSフィードを中継し、フィード内のリンクを変換するDenoベースのプロキシサーバー。

## 機能

- RSSフィードの取得と中継
- フィード内のリンクを`/content`エンドポイントへの参照に変換
- コンテンツのプロキシ取得
- キャッシュ機能（RSSフィードのみ）
- セキュリティ対策（オープンリダイレクター防止）
- 高度な圧縮対応（Brotli, Gzip）
- パフォーマンス最適化（キャッシュ制御、メモリ管理）

## 必要条件

- Deno 1.38.0以上

## セットアップ

1. リポジトリのクローン:
```bash
git clone [repository-url]
cd rss-proxy
```

2. git hookの設定:
```bash
cp scripts/pre-commit .git/hooks/
chmod +x .git/hooks/pre-commit
```

## 開発サーバーの起動

```bash
deno task dev
```

サーバーは http://localhost:8000 で起動します。

## 使用方法

### RSSフィードの取得

```
GET /rss/?feedURL=https://example.com/feed.xml
```

- `feedURL`: 取得したいRSSフィードのURL
- レスポンスは5分間キャッシュされます
- フィード内のリンクは自動的に`/content`エンドポイントへの参照に変換されます
- ETagとLast-Modifiedによる条件付きリクエストをサポート
- Brotli/Gzip圧縮に対応

### コンテンツの取得

```
GET /content/?contentURL=https://example.com/article
```

- `contentURL`: 取得したいコンテンツのURL
- RSSフィード内に存在するURLのみアクセス可能
- キャッシュは行われません
- セキュリティヘッダーの適用（CSP, X-Frame-Options等）

## プロジェクト構成

```
.
├── domain/
│   └── rss/
│       ├── types.ts          # 型定義
│       ├── parser.ts         # RSSパーサー
│       ├── transformer.ts    # リンク変換
│       ├── repository.ts     # データアクセス
│       ├── cache_manager.ts  # キャッシュ管理
│       └── response_helper.ts # レスポンス生成
├── routes/
│   ├── rss.ts               # RSSエンドポイント
│   └── content.ts           # コンテンツエンドポイント
├── tests/
│   ├── integration/         # 統合テスト
│   └── unit/               # ユニットテスト
├── scripts/                 # 開発用スクリプト
├── main.ts                 # アプリケーションのエントリーポイント
└── deno.json              # Deno設定ファイル
```

## テスト

```bash
# すべてのテストを実行
deno task test

# クライアントテストの実行
deno run --allow-net scripts/client_test.js
```

## 技術スタック

- [Deno](https://deno.land/) - モダンなJavaScript/TypeScriptランタイム
- [Hono](https://hono.dev/) - 高速なWebフレームワーク
- [Deno KV](https://deno.land/manual/runtime/kv) - キー・バリューストレージ
- [Deno DOM](https://deno.land/x/deno_dom) - DOMパーサー

## セキュリティ

- オープンリダイレクター脆弱性の防止
  - `/content`エンドポイントは、RSSフィードで取得したURLのみにアクセス可能
  - URLの厳密な検証を実施
- セキュリティヘッダーの適用
  - Content-Security-Policy
  - X-Content-Type-Options
  - X-Frame-Options

## ライセンス

MIT
