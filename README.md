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

- Deno 1.40.0以上

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

## ドメイン層の設計

### モジュールの役割

- `types.ts`: RSSドメインの型定義
  - `RSSDocument`, `RSSChannel`, `RSSItem`などの基本型
  - エラー型の定義と型安全性の確保

- `parser.ts`: RSSフィードのパース処理
  - XMLからTypeScriptオブジェクトへの変換
  - バリデーションと型チェック
  - エラーハンドリングとエラーメッセージの生成

- `transformer.ts`: RSSフィードの変換処理
  - リンクの`/content`エンドポイントへの変換
  - XML生成と特殊文字のエスケープ処理
  - フィード形式の正規化

- `repository.ts`: データアクセスとキャッシュ管理
  - Deno KVを使用したキャッシュの実装
  - 有効なURLの管理とセキュリティチェック
  - キャッシュのクリーンアップ処理

- `cache_manager.ts`: キャッシュ戦略の実装
  - TTLベースのキャッシュ管理
  - メモリ使用量の最適化
  - 条件付きリクエストの処理

- `response_helper.ts`: レスポンス生成の共通処理
  - HTTPヘッダーの設定
  - エラーレスポンスの生成
  - 圧縮処理の制御

### データフロー

1. リクエスト受信
   - URLのバリデーション
   - キャッシュチェック

2. RSSフィード取得
   - 外部サーバーからのフィード取得
   - 条件付きリクエストの処理

3. パース処理
   - XMLのパース
   - 型変換とバリデーション

4. 変換処理
   - リンクの変換
   - フィードの正規化

5. キャッシュと応答
   - キャッシュへの保存
   - レスポンスヘッダーの設定
   - 圧縮処理

### エラーハンドリング

- バリデーションエラー (400 Bad Request)
  - 無効なURL形式
  - 必須パラメータの欠落

- 認証エラー (403 Forbidden)
  - 未承認のURLアクセス
  - セキュリティ制約違反

- 外部サービスエラー (502 Bad Gateway)
  - RSSフィード取得失敗
  - パース失敗

- タイムアウトエラー (504 Gateway Timeout)
  - 外部サービスの応答遅延
  - 処理時間超過

## パフォーマンスチューニング

### キャッシュ戦略

1. TTLベースのキャッシュ
   - RSSフィードは5分間キャッシュ
   - 条件付きリクエストによる304応答

2. メモリ管理
   - キャッシュサイズの制限
   - 定期的なクリーンアップ
   - メモリ使用量の監視

3. 最適化テクニック
   - 圧縮（Brotli/Gzip）の活用
   - キャッシュヘッダーの最適化
   - 条件付きリクエストの活用

## トラブルシューティング

### よくあるエラー

1. "Invalid URL format"
   - 原因: URLの形式が不正
   - 解決: 正しいURLエンコーディングを使用

2. "URL not found in allowed list"
   - 原因: 未承認のURLへのアクセス試行
   - 解決: RSSフィード経由でURLを取得

3. "Failed to fetch RSS feed"
   - 原因: 外部サービスへの接続失敗
   - 解決: ネットワーク接続を確認

4. "Parse error"
   - 原因: 無効なXML形式
   - 解決: フィードの形式を確認

### デバッグ方法

1. ログの確認
   - エラーメッセージの確認
   - スタックトレースの解析

2. テストの実行
   ```bash
   deno task test
   ```

3. 開発モードでの実行
   ```bash
   deno task dev
   ```

4. クライアントテスト
   ```bash
   deno run --allow-net scripts/client_test.js
   ```

## ライセンス

MIT
