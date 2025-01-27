# TODO

## 概要

Deno で動作する API を作成する。\
API には以下の 2 つのエンドポイントを実装する:

1. `/rss/?feedURL=xxxx`
   - `feedURL` で指定された RSS を取得し、内容を中継(プロキシ)する
   - RSS 内のエントリに含まれるリンクを、サーバ内の `/content`
     エンドポイントへの URL に置き換える
   - レスポンスは Deno KV に 5 分間キャッシュする
2. `/content/?contentURL=xxxx`
   - `contentURL` で指定された URL が RSS に含まれる URL の場合のみ、その HTML
     を返す
   - キャッシュは行わない (都度 fetch する)

---

## 残タスク

### 1. 統合テストの追加

- [x] エンドポイントの統合テスト
  - [x] RSSエンドポイントの統合テスト
  - [x] Contentエンドポイントの統合テスト
  - [x] エラーケースの統合テスト

### 2. パフォーマンス最適化

- [ ] キャッシュ管理の改善
  - [ ] メモリ使用量の監視
  - [ ] 定期的なクリーンアップ
- [ ] レスポンスの最適化
  - [ ] 圧縮対応の検討
  - [ ] キャッシュヘッダーの最適化

### 3. コードの修正

#### テストコードの依存関係とメソッド名の修正

- [x] テストファイルのDenoの標準ライブラリバージョンを明示的に指定
  - [x] transformer_test.ts: `https://deno.land/std/testing/asserts.ts` →
        `https://deno.land/std@0.224.0/testing/asserts.ts`
  - [x] parser_test.ts: `https://deno.land/std/testing/asserts.ts` →
        `https://deno.land/std@0.224.0/testing/asserts.ts`
  - [x] repository_test.ts: `https://deno.land/std/testing/asserts.ts` →
        `https://deno.land/std@0.224.0/testing/asserts.ts`
- [x] repository_test.tsのメソッド名を修正
  - [x] `cleanupExpiredCache()` → `cleanup()`

### 4. ドキュメントの更新

- [x] ドメイン層の設計説明
  - [x] 各モジュールの役割
  - [x] データフロー
  - [x] エラーハンドリング
- [x] パフォーマンスチューニングガイド
  - [x] キャッシュ戦略
  - [x] メモリ管理
- [x] トラブルシューティングガイド
  - [x] よくあるエラー
  - [x] デバッグ方法

---

## 完了したタスク

### 1. ドメインロジックのリファクタリング

- [x] RSSドメインの型定義
  - [x] RSSDocument型
  - [x] RSSChannel型
  - [x] RSSItem型
  - [x] エラー型
- [x] RSSパーサーの実装
  - [x] XMLパース処理
  - [x] バリデーション処理
  - [x] エラーハンドリング
- [x] RSSトランスフォーマーの実装
  - [x] リンク変換処理
  - [x] XML生成処理
  - [x] 特殊文字のエスケープ処理
- [x] RSSリポジトリの実装
  - [x] キャッシュ管理
  - [x] 有効なURLの管理
  - [x] クリーンアップ処理

### 2. ドメインのテスト実装

- [x] パーサーのテスト
  - [x] 正常系テスト
  - [x] エラーケーステスト
  - [x] 特殊文字のテスト
- [x] トランスフォーマーのテスト
  - [x] リンク変換テスト
  - [x] XML生成テスト
  - [x] 特殊文字エスケープテスト
- [x] リポジトリのテスト
  - [x] キャッシュ操作テスト
  - [x] URLバリデーションテスト
  - [x] クリーンアップテスト

### 3. ルートハンドラーの更新

- [x] routes/rss.tsの更新
  - [x] RSSParserの利用
  - [x] RSSTransformerの利用
  - [x] RSSRepositoryの利用
  - [x] エラーハンドリングの改善
- [x] routes/content.tsの更新
  - [x] RSSRepositoryの利用
  - [x] エラーハンドリングの改善

### 4. 基本機能の実装

- [x] プロジェクトのディレクトリ構成
- [x] Denoの設定ファイル
- [x] 基本的なエンドポイント実装
- [x] クライアントテストスクリプト
- [x] git hookの設定
