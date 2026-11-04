-- household-sub-demo: D1 初期スキーマ（SPEC/er-diagram.md が正）
-- 日時は ISO 8601 文字列（UTC）、配送日は YYYY-MM-DD（JST の日付）で保存する。

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  in_stock INTEGER NOT NULL DEFAULT 1 CHECK (in_stock IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Cookie の session_id を記録する（リセット対象）。
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  session_key TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT
);

CREATE TABLE cart_items (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 5),
  interval_days INTEGER NOT NULL CHECK (interval_days IN (14, 30, 60)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_cart_items_session ON cart_items(session_id);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  total_price INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_orders_session ON orders(session_id);

CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  session_id TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 5),
  interval_days INTEGER NOT NULL CHECK (interval_days IN (14, 30, 60)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  next_delivery TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_subscriptions_session ON subscriptions(session_id);

CREATE TABLE reset_logs (
  id INTEGER PRIMARY KEY,
  executed_at TEXT NOT NULL,
  tables_reset TEXT NOT NULL,
  status TEXT NOT NULL
);

-- マスタ（SPEC/er-diagram.md・src/seed.py と同一内容）
INSERT INTO categories (id, name, slug) VALUES
  (1, 'キッチン', 'kitchen'),
  (2, 'バスルーム', 'bathroom'),
  (3, 'トイレ', 'toilet'),
  (4, 'その他', 'other');

INSERT INTO products (id, category_id, name, price, in_stock) VALUES
  (1,  1, '食器用スポンジ（3個入り）',      298, 1),
  (2,  1, '食器用洗剤（詰替）',             198, 1),
  (3,  1, 'キッチンペーパー（200枚）',      398, 1),
  (4,  1, 'アルミホイル（30m）',            298, 1),
  (5,  2, '浴室用洗剤',                    348, 1),
  (6,  2, 'シャンプー（詰替）',             498, 1),
  (7,  2, 'ボディソープ（詰替）',           448, 1),
  (8,  3, 'トイレ用洗剤',                   298, 1),
  (9,  3, 'トイレットペーパー（12ロール）', 598, 1),
  (10, 4, 'ティッシュペーパー（5箱）',      498, 1),
  (11, 4, 'ゴミ袋（20枚入り）',             248, 1),
  (12, 4, '除菌ウェットシート（80枚）',     398, 0);
