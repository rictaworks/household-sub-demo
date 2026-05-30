# API 仕様書

最終更新: 2026-05-30

---

## 基本情報

| 項目 | 内容 |
|------|------|
| Base URL（開発） | `http://localhost:3001/api/v1` |
| Base URL（本番） | `https://api.household-sub.rictaworks.jp/api/v1` |
| 認証方式 | Bearer Token（JWT）/ セッション Cookie |
| レスポンス形式 | JSON |
| 文字コード | UTF-8 |

---

## 認証

### GET /auth/google

Google OAuth 認証を開始します。

### GET /auth/google/callback

Google OAuth コールバック。認証成功後、JWT を発行してフロントエンドへリダイレクトします。

### DELETE /auth/logout

セッションを破棄してログアウトします。

---

## ヘルスチェック

### GET /health

サーバーの稼働状態を確認します。

**レスポンス:**
```json
{
  "status": "ok",
  "db": "connected",
  "version": "1.0.0",
  "env": "production"
}
```

---

## サブスクリプション

### GET /subscriptions

世帯のサブスクリプション一覧を取得します。

**クエリパラメータ:**
| パラメータ | 型 | 説明 |
|----------|-----|------|
| `page` | integer | ページ番号（デフォルト: 1） |
| `per_page` | integer | 件数（デフォルト: 20） |
| `category` | string | カテゴリフィルター |

**レスポンス:**
```json
{
  "subscriptions": [
    {
      "id": 1,
      "name": "Netflix",
      "amount": 1490,
      "currency": "JPY",
      "billing_cycle": "monthly",
      "next_billing_date": "2026-06-15",
      "category": "entertainment"
    }
  ],
  "total": 10,
  "page": 1,
  "per_page": 20
}
```

### POST /subscriptions

新規サブスクリプションを登録します。

**リクエストボディ:**
```json
{
  "subscription": {
    "name": "Netflix",
    "amount": 1490,
    "currency": "JPY",
    "billing_cycle": "monthly",
    "next_billing_date": "2026-06-15",
    "category": "entertainment"
  }
}
```

### GET /subscriptions/:id

指定したサブスクリプションの詳細を取得します。

### PATCH /subscriptions/:id

サブスクリプション情報を更新します。

---

## 世帯

### GET /households

世帯情報とメンバー一覧を取得します。

### POST /households/members

世帯に新しいメンバーを招待します。

**リクエストボディ:**
```json
{
  "member": {
    "email": "member@example.com",
    "role": "member"
  }
}
```

---

## 統計

### GET /analytics/summary

月次支出サマリーを取得します。

**クエリパラメータ:**
| パラメータ | 型 | 説明 |
|----------|-----|------|
| `year` | integer | 年（例: 2026） |
| `month` | integer | 月（例: 5） |

---

## ユーザー

### GET /users/me

ログイン中のユーザー情報を取得します。

### PATCH /users/me

ユーザー情報を更新します。

---

## エラーレスポンス形式

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "認証が必要です",
    "details": {}
  }
}
```

| HTTP ステータス | エラーコード | 説明 |
|--------------|-----------|------|
| 400 | `BAD_REQUEST` | リクエスト不正 |
| 401 | `UNAUTHORIZED` | 未認証 |
| 403 | `FORBIDDEN` | アクセス権限なし |
| 404 | `NOT_FOUND` | リソースが存在しない |
| 422 | `UNPROCESSABLE_ENTITY` | バリデーションエラー |
| 500 | `INTERNAL_SERVER_ERROR` | サーバー内部エラー |
