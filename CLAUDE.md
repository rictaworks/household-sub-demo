# household-sub-demo — CLAUDE.md

> このファイルはプロジェクト全体のルールと仕様を定義します。
> すべてのエージェント・開発者はこのファイルを最初に読むこと。

---

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | household-sub-demo |
| 種別 | 世帯向けサブスクリプション管理デモ |
| ドメイン | household-sub.rictaworks.jp（予定） |
| フロントエンド | Next.js → Vercel（無料枠） |
| バックエンド | Ruby on Rails API → Render または Railway（無料枠） |
| DB | PostgreSQL |
| 認証 | Google OAuth 2.0 |
| 多言語 | ja / en / fr / zh / ru / es / ar |

---

## アーキテクチャ

```
[Browser]
    |
[Next.js Frontend] ─── Vercel
    |
[Rails API] ─── Render/Railway
    |
[PostgreSQL]
```

規模拡大時はマイクロサービス / API Gateway / メッセージングを検討する。
FastAPI（AI・画像処理）、Gin（高速並列・リアルタイム）で補完可。

---

## ブランチ戦略

- **main ブランチでの直接作業禁止**
- `src/*` 以外の変更（docs, config, ルートファイル等）は main への push を許可
- `src/*` の変更は **必ず PR を作成**すること
- PR 本文には非エンジニア向けユーザーテスト手順を日本語で丁寧に記載する

---

## TDD フロー（厳守）

```
plan → red test（失敗するテストを書く） → coding → green test（テストを通す）
```

| 対象 | フレームワーク |
|------|-------------|
| Rails バックエンド | RSpec |
| Next.js フロントエンド | Jest + React Testing Library |
| E2E / UI 確認 | Playwright |
| フロント確認（CLI） | curl, wget --mirror |

---

## ディレクトリ構造

```
/
├── src/                  # アプリケーションコード（PR必須）
├── TASKS/                # タスク管理
├── DEBUG/                # バグ報告
├── CLIENT/               # クライアント要望
├── WORK/                 # 作業報告
├── ENV/
│   ├── DEVELOPMENT.md    # 開発環境
│   └── PRODUCTION.md     # 本番環境
├── SPEC/                 # 仕様書・図（ER図, DFD, シーケンス図 等）
├── DELETE/               # ゴミ箱
└── test/
    └── pr***/            # PR 番号ごとのテスト
```

---

## コーディング規則

### 構造
- 制御構文・条件構文以外はクラスまたは関数に書く
- グローバル変数禁止（セキュリティリスク）
- 文字列リテラルは設定ファイルまたは DB に分離する
- ハードコードが残っていないかチェックするテストを書く

### 例外処理
- フォールバック禁止。例外処理をしっかり書く
- `try/catch` で握りつぶさず、ログ出力 → 適切な HTTP ステータスを返す

### デバッグ
- デバッグトレース可能なコードを書く
- 本番ではデバッグログを抑制し、開発環境ではフルトレース出力

### コメント
- WHY が非自明な場合のみコメントを書く
- コード自体が説明になるよう命名する

### UI
- ネイティブ `alert()` / `confirm()` / `prompt()` 禁止（プロジェクト全体）
- デフォルトアイコンは Font Awesome を使用
- 絵文字禁止

---

## 環境変数

`.env` ファイルを参照すること。ハードコード禁止。
環境判定（development / test / production）を必ず実装し分岐する。
テスト可能にするため、開発環境は認証済み状態に分岐できるようにする。

---

## 多言語対応

- **当初から多言語で開発する**
- 対応言語: 日本語・英語・フランス語・中国語・ロシア語・スペイン語・アラビア語
- 管理画面（Admin）は日本語のみ
- 文字列リテラルはロケールファイルに分離する

---

## セキュリティ

commit 前に必ず security review を実施する。

参照ファイル:
- `.claude/OWASP10.md` — OWASP Top 10 チェック
- `.claude/QC10.md` — 品質管理 10 項目
- `.claude/CC.md` — コンプライアンスチェック

---

## ライブラリ・OSS 方針

- 安全で保守コストの低いライブラリを選ぶ
- 車輪の再発明を避け、オリジナルコードを最小限に保つ
- 依存関係は定期的に更新し脆弱性をチェックする

---

## 図解（Mermaid）

仕様書・ER図・DFD・シーケンス図・クラス図・状態遷移図・ユースケース図は
`SPEC/` ディレクトリで Mermaid 形式で管理・更新する。

---

## エージェント一覧

| エージェント | ロール |
|-------------|--------|
| director | 全体方針・意思決定 |
| project-manager | タスク管理・進捗管理 |
| designer | UI/UX デザイン（CRAP原則, Figma連携） |
| debugger | バグ調査・修正 |
| tester | テスト作成・実行（TDD） |
| data-scientist | データ分析・AI 機能 |
| deployer | デプロイ・インフラ管理 |
| writer | ライティング・多言語対応 |
| service-manager | サービス管理・監視 |

エージェント定義: `.claude/agents/`

---

## 参照ファイル

| ファイル | 内容 |
|---------|------|
| `.claude/OWASP10.md` | OWASP Top 10 |
| `.claude/QC10.md` | 品質管理チェックリスト |
| `.claude/CC.md` | コンプライアンスチェック |
| `.claude/TM.md` | テストメソッド・フレームワーク |
| `.claude/CRAP.md` | デザイン原則 |
| `.claude/development-principles.md` | 開発原則（YAGNI, KISS, DRY, SOLID） |
