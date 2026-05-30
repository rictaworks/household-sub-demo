# household-sub-demo

世帯向けサブスクリプション管理デモアプリケーション。

---

## 自動ログイン（開発環境）

開発環境では認証をスキップして自動ログイン状態で起動できます。

```bash
# .env に以下を設定
DEV_AUTO_LOGIN=true
DEV_AUTO_LOGIN_EMAIL=dev@example.com
```

| 環境 | URL | 備考 |
|------|-----|------|
| フロントエンド（開発） | http://localhost:3000 | Next.js dev server |
| バックエンド API（開発） | http://localhost:3001 | Rails API server |
| フロントエンド（本番） | https://household-sub.rictaworks.jp | Vercel |
| バックエンド API（本番） | https://api.household-sub.rictaworks.jp | Render / Railway |

---

## ページ一覧

| ページ名 | URL | 説明 |
|---------|-----|------|
| トップページ | [/](http://localhost:3000/) | ランディング・サービス紹介 |
| ログイン | [/login](http://localhost:3000/login) | Google OAuth ログイン |
| ダッシュボード | [/dashboard](http://localhost:3000/dashboard) | サブスク一覧・概要 |
| サブスク登録 | [/subscriptions/new](http://localhost:3000/subscriptions/new) | 新規サブスク追加 |
| サブスク詳細 | [/subscriptions/:id](http://localhost:3000/subscriptions/:id) | 詳細・編集 |
| 世帯メンバー管理 | [/household](http://localhost:3000/household) | メンバー招待・管理 |
| 統計・分析 | [/analytics](http://localhost:3000/analytics) | 支出グラフ・分析 |
| 設定 | [/settings](http://localhost:3000/settings) | 通知・言語・プロフィール |
| 管理画面 | [/admin](http://localhost:3000/admin) | 管理者専用（日本語のみ） |

---

## API 一覧

API 仕様書: [SPEC/api.md](./SPEC/api.md)

| タイトル | エンドポイント URL | メソッド | 説明 |
|---------|-----------------|---------|------|
| ヘルスチェック | `/api/v1/health` | GET | サーバー稼働確認 |
| Google OAuth コールバック | `/api/v1/auth/google/callback` | GET | OAuth 認証コールバック |
| ログアウト | `/api/v1/auth/logout` | DELETE | セッション破棄 |
| サブスク一覧取得 | `/api/v1/subscriptions` | GET | 世帯のサブスク全件 |
| サブスク登録 | `/api/v1/subscriptions` | POST | 新規サブスク作成 |
| サブスク取得 | `/api/v1/subscriptions/:id` | GET | 単件取得 |
| サブスク更新 | `/api/v1/subscriptions/:id` | PATCH | 部分更新 |
| 世帯情報取得 | `/api/v1/households` | GET | 世帯情報 |
| メンバー招待 | `/api/v1/households/members` | POST | メンバー追加 |
| 統計取得 | `/api/v1/analytics/summary` | GET | 月次支出サマリー |
| ユーザー情報取得 | `/api/v1/users/me` | GET | 自分のプロフィール |
| ユーザー情報更新 | `/api/v1/users/me` | PATCH | プロフィール更新 |

---

## 技術スタック

| 層 | 技術 |
|----|------|
| フロントエンド | Next.js, TypeScript, Tailwind CSS |
| バックエンド | Ruby on Rails (API mode) |
| データベース | PostgreSQL |
| 認証 | Google OAuth 2.0 (Devise + OmniAuth) |
| テスト（BE） | RSpec |
| テスト（FE） | Jest, React Testing Library |
| E2E テスト | Playwright |
| デプロイ（FE） | Vercel |
| デプロイ（BE） | Render または Railway |
| アイコン | Font Awesome |
| 図解 | Mermaid |

---

## 開発環境セットアップ

詳細: [ENV/DEVELOPMENT.md](./ENV/DEVELOPMENT.md)

```bash
# リポジトリクローン後
cp .env.example .env
# .env を編集して環境変数を設定

# フロントエンド
cd frontend
npm install
npm run dev

# バックエンド
cd backend
bundle install
bin/rails db:create db:migrate db:seed
bin/rails server -p 3001
```

---

## ドキュメント

| ドキュメント | パス |
|------------|------|
| 開発環境 | [ENV/DEVELOPMENT.md](./ENV/DEVELOPMENT.md) |
| 本番環境 | [ENV/PRODUCTION.md](./ENV/PRODUCTION.md) |
| API 仕様書 | [SPEC/api.md](./SPEC/api.md) |
| ER 図 | [SPEC/er-diagram.md](./SPEC/er-diagram.md) |
| シーケンス図 | [SPEC/sequence.md](./SPEC/sequence.md) |
| タスク管理 | [TASKS/](./TASKS/) |
| バグ報告 | [DEBUG/](./DEBUG/) |
| 作業報告 | [WORK/](./WORK/) |
