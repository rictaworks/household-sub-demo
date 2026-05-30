# API 仕様書（デモ版）

最終更新: 2026-05-30

> **エディション**: デモ版
> バックエンド: Python / Flask — セッションベース・認証なし・SQLite

---

## 基本情報

| 項目 | 内容 |
|------|------|
| Base URL（開発） | `http://localhost:5000` |
| Base URL（デプロイ） | Render / Railway（無料枠） |
| 認証方式 | なし（Cookie セッション） |
| レスポンス形式 | HTML（Jinja2 テンプレート） |
| 文字コード | UTF-8 |

---

## 商品一覧

### GET /

商品一覧ページを表示します。

**クエリパラメータ:**

| パラメータ | 型 | 説明 |
|----------|-----|------|
| `category` | string | カテゴリ slug でフィルタ（`kitchen` / `bathroom` / `toilet` / `other`） |

**レスポンス:** 200 OK — 商品一覧 HTML

---

## カート

### GET /cart

カート内容を表示します。セッションに紐づく `cart_items` を取得。

**レスポンス:** 200 OK — カート HTML

---

### POST /cart/add

カートに商品を追加します。

**フォームパラメータ:**

| パラメータ | 型 | 必須 | バリデーション |
|----------|-----|------|-------------|
| `product_id` | integer | ✓ | 存在する商品・在庫あり |
| `quantity` | integer | ✓ | 1〜5 |
| `interval_days` | integer | ✓ | 14 / 30 / 60 のいずれか |

**レスポンス:**
- 302 Redirect → `/cart`（成功）
- 400 Bad Request（バリデーションエラー・在庫なし）

**備考:** 同一商品・同一間隔が既にカートにある場合は数量を加算（上限 5）

---

### POST /cart/update

カートアイテムの数量を変更します。

**フォームパラメータ:**

| パラメータ | 型 | 必須 | バリデーション |
|----------|-----|------|-------------|
| `item_id` | integer | ✓ | 自セッション所有のアイテム |
| `quantity` | integer | ✓ | 1〜5 |

**レスポンス:**
- 302 Redirect → `/cart`
- 400 / 404

---

### POST /cart/remove

カートアイテムを削除します。

**フォームパラメータ:**

| パラメータ | 型 | 必須 |
|----------|-----|------|
| `item_id` | integer | ✓ |

**レスポンス:** 302 Redirect → `/cart`

---

## 注文確定

### GET /checkout

注文フォームを表示します。カートが空の場合は `/` へリダイレクト。

**レスポンス:** 200 OK — 注文フォーム HTML

---

### POST /checkout

注文を確定してサブスクリプションを登録します。

**フォームパラメータ:**

| パラメータ | 型 | 必須 | バリデーション |
|----------|-----|------|-------------|
| `name` | string | ✓ | 1〜100 文字 |
| `address` | string | ✓ | 1〜255 文字 |
| `phone` | string | ✓ | 数字のみ・10〜11 桁 |
| `website` | string | — | ハニーポット：値があれば 400 を返す |

**成功時の処理:**
1. `orders` レコードを作成
2. カートアイテムごとに `subscriptions` レコードを作成（`status=active`、`next_delivery=注文日+interval_days`）
3. `cart_items` を全削除
4. 302 Redirect → `/checkout/complete`

**エラー時:**
- 400 — ハニーポット検知
- 200 — バリデーションエラー（フォーム再表示）

---

### GET /checkout/complete

注文完了画面を表示します。

**レスポンス:** 200 OK

---

## マイサブスク

### GET /my-subs

自セッションのサブスクリプション一覧（`cancelled` 除く）を表示します。

**レスポンス:** 200 OK — マイサブスク HTML

---

### POST /my-subs/\<id\>/pause

サブスクリプションを一時停止します。

**条件:** `status == "active"` であること

**処理:** `status = "paused"`, `next_delivery = NULL`

**レスポンス:**
- 302 Redirect → `/my-subs`
- 400 — ステータス不正
- 404 — 他セッションのリソース

---

### POST /my-subs/\<id\>/resume

一時停止中のサブスクリプションを再開します。

**条件:** `status == "paused"` であること

**処理:** `status = "active"`, `next_delivery = 再開日 + interval_days`

**レスポンス:** 302 Redirect → `/my-subs`

---

### POST /my-subs/\<id\>/cancel

サブスクリプションを解約します（論理削除）。

**処理:** `status = "cancelled"`

**レスポンス:** 302 Redirect → `/my-subs`

---

### POST /my-subs/\<id\>/change-interval

配送間隔を変更します。

**フォームパラメータ:**

| パラメータ | 型 | 必須 | バリデーション |
|----------|-----|------|-------------|
| `interval_days` | integer | ✓ | 14 / 30 / 60 のいずれか |

**処理:** `interval_days` を更新、`next_delivery = 変更日 + 新 interval_days`

**レスポンス:**
- 302 Redirect → `/my-subs`
- 400 — 間隔値不正・ステータス不正

---

## エラーレスポンス

HTML エラーページ（`templates/error.html`）を返します。

| HTTP ステータス | 説明 |
|--------------|------|
| 400 | バリデーションエラー・ハニーポット検知・不正なステータス遷移 |
| 404 | リソースが存在しない・他セッションのリソース |
