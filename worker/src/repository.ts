import { TAX_RATE } from "./domain";

// すべての利用者データ参照は session_id で絞り込む（他セッションのレコードへの参照・操作を防ぐ）。
// SQL はすべてバインドパラメータを使う。

export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
}

export interface ProductRow {
  id: number;
  name: string;
  price: number;
  inStock: number;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
}

export interface CartLineRow {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  intervalDays: number;
}

export interface SubscriptionRow {
  id: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  intervalDays: number;
  status: string;
  nextDelivery: string | null;
}

export async function touchSession(db: D1Database, sessionId: string, nowIso: string): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO sessions (session_key, data, created_at) VALUES (?, '{}', ?)")
    .bind(sessionId, nowIso)
    .run();
}

export async function listCategories(db: D1Database): Promise<CategoryRow[]> {
  const result = await db
    .prepare("SELECT id, name, slug FROM categories ORDER BY id")
    .all<CategoryRow>();
  return result.results;
}

export async function listProducts(db: D1Database, categorySlug: string | null): Promise<ProductRow[]> {
  const select = `
    SELECT p.id, p.name, p.price, p.in_stock AS inStock,
           c.id AS categoryId, c.name AS categoryName, c.slug AS categorySlug
    FROM products p
    JOIN categories c ON c.id = p.category_id`;
  const statement =
    categorySlug === null
      ? db.prepare(`${select} ORDER BY p.id`)
      : db.prepare(`${select} WHERE c.slug = ? ORDER BY p.id`).bind(categorySlug);
  const result = await statement.all<ProductRow>();
  return result.results;
}

export async function findProduct(
  db: D1Database,
  productId: number,
): Promise<{ id: number; name: string; price: number; inStock: number } | null> {
  return db
    .prepare("SELECT id, name, price, in_stock AS inStock FROM products WHERE id = ?")
    .bind(productId)
    .first<{ id: number; name: string; price: number; inStock: number }>();
}

export async function listCartLines(db: D1Database, sessionId: string): Promise<CartLineRow[]> {
  const result = await db
    .prepare(
      `SELECT ci.id, ci.product_id AS productId, p.name AS productName, p.price AS unitPrice,
              ci.quantity, ci.interval_days AS intervalDays
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.session_id = ?
       ORDER BY ci.id`,
    )
    .bind(sessionId)
    .all<CartLineRow>();
  return result.results;
}

export async function findCartItemForProduct(
  db: D1Database,
  sessionId: string,
  productId: number,
  intervalDays: number,
): Promise<{ id: number; quantity: number } | null> {
  return db
    .prepare(
      "SELECT id, quantity FROM cart_items WHERE session_id = ? AND product_id = ? AND interval_days = ?",
    )
    .bind(sessionId, productId, intervalDays)
    .first<{ id: number; quantity: number }>();
}

export async function insertCartItem(
  db: D1Database,
  sessionId: string,
  productId: number,
  quantity: number,
  intervalDays: number,
  nowIso: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO cart_items (session_id, product_id, quantity, interval_days, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(sessionId, productId, quantity, intervalDays, nowIso)
    .run();
}

export async function setCartItemQuantity(db: D1Database, itemId: number, quantity: number): Promise<void> {
  await db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").bind(quantity, itemId).run();
}

export async function findOwnedCartItem(
  db: D1Database,
  sessionId: string,
  itemId: number,
): Promise<{ id: number } | null> {
  return db
    .prepare("SELECT id FROM cart_items WHERE id = ? AND session_id = ?")
    .bind(itemId, sessionId)
    .first<{ id: number }>();
}

export async function deleteCartItem(db: D1Database, itemId: number): Promise<void> {
  await db.prepare("DELETE FROM cart_items WHERE id = ?").bind(itemId).run();
}

export interface NewOrder {
  name: string;
  address: string;
  phone: string;
}

// 注文・サブスク登録・カート削除を 1 トランザクション（D1 の batch）で行う。
// 税込金額も明細も同じバッチ内の cart_items から集計するため、確認時点と確定時点の値がずれない。
// subscriptions は同じバッチ内の orders 挿入直後の last_insert_rowid() を order_id に使う。
// カートが空（バッチ内で 0 件）なら何も作らず null を返す。
export async function placeOrder(
  db: D1Database,
  sessionId: string,
  order: NewOrder,
  todayJst: string,
  nowIso: string,
): Promise<number | null> {
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO orders (session_id, name, address, phone, total_price, created_at)
         SELECT ?, ?, ?, ?, CAST(cart.subtotal * ? AS INTEGER), ?
         FROM (
           SELECT SUM(p.price * ci.quantity) AS subtotal, COUNT(*) AS lines
           FROM cart_items ci
           JOIN products p ON p.id = ci.product_id
           WHERE ci.session_id = ?
         ) AS cart
         WHERE cart.lines > 0`,
      )
      .bind(sessionId, order.name, order.address, order.phone, TAX_RATE, nowIso, sessionId),
    db
      .prepare(
        `INSERT INTO subscriptions
           (order_id, session_id, product_id, quantity, interval_days, status, next_delivery, created_at, updated_at)
         SELECT last_insert_rowid(), ci.session_id, ci.product_id, ci.quantity, ci.interval_days, 'active',
                date(?, '+' || ci.interval_days || ' days'), ?, ?
         FROM cart_items ci
         WHERE ci.session_id = ?
         ORDER BY ci.id`,
      )
      .bind(todayJst, nowIso, nowIso, sessionId),
    db.prepare("DELETE FROM cart_items WHERE session_id = ?").bind(sessionId),
  ]);
  const orderInsert = results[0];
  if (!orderInsert || orderInsert.meta.changes === 0) {
    return null;
  }
  return orderInsert.meta.last_row_id;
}

export async function listVisibleSubscriptions(db: D1Database, sessionId: string): Promise<SubscriptionRow[]> {
  const result = await db
    .prepare(
      `SELECT s.id, p.name AS productName, p.price AS unitPrice, s.quantity,
              s.interval_days AS intervalDays, s.status, s.next_delivery AS nextDelivery
       FROM subscriptions s
       JOIN products p ON p.id = s.product_id
       WHERE s.session_id = ? AND s.status != 'cancelled'
       ORDER BY s.id DESC`,
    )
    .bind(sessionId)
    .all<SubscriptionRow>();
  return result.results;
}

export async function findOwnedSubscription(
  db: D1Database,
  sessionId: string,
  subId: number,
): Promise<{ id: number; status: string; intervalDays: number } | null> {
  return db
    .prepare("SELECT id, status, interval_days AS intervalDays FROM subscriptions WHERE id = ? AND session_id = ?")
    .bind(subId, sessionId)
    .first<{ id: number; status: string; intervalDays: number }>();
}

export async function pauseSubscription(db: D1Database, sessionId: string, subId: number, nowIso: string): Promise<void> {
  await db
    .prepare("UPDATE subscriptions SET status = 'paused', next_delivery = NULL, updated_at = ? WHERE id = ? AND session_id = ?")
    .bind(nowIso, subId, sessionId)
    .run();
}

export async function resumeSubscription(
  db: D1Database,
  sessionId: string,
  subId: number,
  nextDelivery: string,
  nowIso: string,
): Promise<void> {
  await db
    .prepare("UPDATE subscriptions SET status = 'active', next_delivery = ?, updated_at = ? WHERE id = ? AND session_id = ?")
    .bind(nextDelivery, nowIso, subId, sessionId)
    .run();
}

export async function cancelSubscription(db: D1Database, sessionId: string, subId: number, nowIso: string): Promise<void> {
  await db
    .prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ? AND session_id = ?")
    .bind(nowIso, subId, sessionId)
    .run();
}

export async function changeSubscriptionInterval(
  db: D1Database,
  sessionId: string,
  subId: number,
  intervalDays: number,
  nextDelivery: string,
  nowIso: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE subscriptions SET interval_days = ?, next_delivery = ?, updated_at = ? WHERE id = ? AND session_id = ?",
    )
    .bind(intervalDays, nextDelivery, nowIso, subId, sessionId)
    .run();
}
