# ER 図（デモ版）

最終更新: 2026-05-30

> **エディション**: デモ版（SQLite）
> 認証なし・セッションベース。マスタテーブルはリセット対象外。

---

```mermaid
erDiagram
    categories {
        integer id PK
        string  name
        string  slug
        datetime created_at
    }

    products {
        integer  id PK
        integer  category_id FK
        string   name
        text     description
        integer  price
        boolean  in_stock
        datetime created_at
    }

    sessions {
        integer  id PK
        string   session_key
        text     data
        datetime created_at
        datetime expires_at
    }

    cart_items {
        integer  id PK
        string   session_id
        integer  product_id FK
        integer  quantity
        integer  interval_days
        datetime created_at
    }

    orders {
        integer  id PK
        string   session_id
        string   name
        string   address
        string   phone
        integer  total_price
        datetime created_at
    }

    subscriptions {
        integer  id PK
        integer  order_id FK
        string   session_id
        integer  product_id FK
        integer  quantity
        integer  interval_days
        string   status
        date     next_delivery
        datetime created_at
        datetime updated_at
    }

    reset_logs {
        integer  id PK
        datetime executed_at
        string   tables_reset
        string   status
    }

    categories  ||--o{ products      : "has many"
    products    ||--o{ cart_items    : "referenced by"
    products    ||--o{ subscriptions : "referenced by"
    orders      ||--o{ subscriptions : "has many"
```

---

## テーブル定義

| テーブル | 初期件数 | リセット対象 | 備考 |
|---------|---------|------------|------|
| `categories` | 4件（固定） | 非対象 | マスタ |
| `products` | 12件（固定） | 非対象 | マスタ（在庫なし 1件含む） |
| `sessions` | 動的 | 対象 | Cookie session_key で識別 |
| `cart_items` | 動的 | 対象 | session_id で分離 |
| `orders` | 動的 | 対象 | session_id で分離 |
| `subscriptions` | 動的 | 対象 | status: active / paused / cancelled |
| `reset_logs` | 累積 | 非対象 | リセット実行ログ |

## バリデーション

| フィールド | ルール |
|-----------|--------|
| `cart_items.quantity` | 1〜5（整数） |
| `cart_items.interval_days` | 14 / 30 / 60 のいずれか |
| `orders.name` | 1〜100 文字 |
| `orders.address` | 1〜255 文字 |
| `orders.phone` | 数字のみ・10〜11 桁 |
| `subscriptions.status` | active → paused → active / cancelled |
