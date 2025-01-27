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

## アーキテクチャ設計

### ドメイン層の構成

```
domain/rss/
├── types.ts          # ドメインの型定義
├── parser.ts         # RSSパーサー
├── transformer.ts    # リンク変換処理
├── repository.ts     # データアクセス層
├── cache_manager.ts  # キャッシュ管理
└── response_helper.ts # レスポンス生成
```

### データフロー

1. リクエスト受信
   - URLバリデーション
   - キャッシュチェック
   - 条件付きリクエスト評価

2. RSSフィード処理
   - フィード取得
   - XMLパース
   - リンク変換
   - キャッシュ保存

3. レスポンス生成
   - 圧縮処理
   - ヘッダー最適化
   - エラーハンドリング

### エラーハンドリング

- ValidationError: 入力値の検証エラー
- ParseError: XMLパースエラー
- CacheError: キャッシュ操作エラー

## パフォーマンスチューニング

### キャッシュ戦略

1. メモリ管理
   - 最大キャッシュサイズ: 50MB
   - 警告閾値: 80%使用時
   - LRUベースの自動クリーンアップ

2. キャッシュ制御
   - TTL: 5分
   - 条件付きリクエスト対応
   - ETag/Last-Modified対応

3. 圧縮設定
   - Brotli優先（フォールバック: Gzip）
   - 最小圧縮サイズ: 1KB
   - 最大圧縮サイズ: 10MB

### パフォーマンスメトリクス

- ヒット率の監視
- クリーンアップ頻度
- メモリ使用量
- レスポンス時間

## トラブルシューティング

### よくあるエラー

1. 400 Bad Request
   - 無効なURL形式
   - 必須パラメータの欠落
   - 解決策: URLのエンコーディングを確認

2. 403 Forbidden
   - 未許可のコンテンツURL
   - 解決策: RSSフィード経由でアクセス

3. 502 Bad Gateway
   - RSSフィードの取得失敗
   - 解決策: フィードのURLと可用性を確認

4. 504 Gateway Timeout
   - コンテンツ取得のタイムアウト
   - 解決策: ネットワーク状態を確認

### デバッグ方法

1. ログレベルの設定
```bash
export DEBUG=true
```

2. キャッシュの確認
```bash
deno task cache-stats
```

3. メトリクスの確認
```bash
deno task metrics
```

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
- セキュリティヘッダーの適用
  - Content-Security-Policy
  - X-Content-Type-Options
  - X-Frame-Options

## ライセンス

MIT
