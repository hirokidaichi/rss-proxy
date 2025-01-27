# RSS Proxy

RSSフィードを中継し、フィード内のリンクを変換するDenoベースのプロキシサーバー。

## 機能

- RSSフィードの取得と中継
- フィード内のリンクを`/content`エンドポイントへの参照に変換
- コンテンツのプロキシ取得
- キャッシュ機能（RSSフィードのみ）
- セキュリティ対策（オープンリダイレクター防止）

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

### コンテンツの取得

```
GET /content/?contentURL=https://example.com/article
```

- `contentURL`: 取得したいコンテンツのURL
- RSSフィード内に存在するURLのみアクセス可能
- キャッシュは行われません

## テスト

### ユニットテストの実行

```bash
deno task test
```

### クライアントテストの実行

```bash
deno run --allow-net scripts/client_test.js
```

## 技術スタック

- [Deno](https://deno.land/)
- [Hono](https://hono.dev/)
- [Deno KV](https://deno.land/manual/runtime/kv)
- [Deno DOM](https://deno.land/x/deno_dom)

## セキュリティ

- オープンリダイレクター脆弱性の防止
  - `/content`エンドポイントは、RSSフィードで取得したURLのみにアクセス可能
  - URLの厳密な検証を実施

## ライセンス

MIT
