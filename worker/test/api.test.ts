import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { addDays, jstToday, taxIncluded } from "../src/domain";
import type { Env } from "../src/env";
import { MESSAGES } from "../src/messages";
import { TestClient, createTestEnv } from "./helpers/testD1";

const CHECKOUT_FORM = {
  name: "山田太郎",
  address: "東京都渋谷区1-1-1",
  phone: "09012345678",
  website: "",
};

let env: Env;
let app: ReturnType<typeof createApp>;
let client: TestClient;

beforeEach(() => {
  env = createTestEnv();
  app = createApp();
  client = new TestClient(app, env);
});

async function countRows(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

async function addToCart(c: TestClient, productId: number, quantity: number, intervalDays: number) {
  return c.post("/api/cart/add", { productId, quantity, intervalDays });
}

async function placeOrder(c: TestClient, productId = 1, intervalDays = 30) {
  await addToCart(c, productId, 1, intervalDays);
  return c.post("/api/checkout", CHECKOUT_FORM);
}

async function firstSubId(c: TestClient): Promise<number> {
  const res = await c.get("/api/my-subs");
  return res.body.subs[0].id as number;
}

describe("GET /api/health と Cookie 発行", () => {
  it("health は 200 を返す", async () => {
    const res = await client.get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("初回アクセスで HttpOnly・SameSite=Lax の session_id を発行し、test 環境では Secure を付けない", async () => {
    const res = await client.get("/api/cart");
    expect(res.setCookie).toMatch(/^session_id=[0-9a-f-]{36}\.[0-9a-f]{64}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=86400$/);
  });

  it("2 回目以降は既存の Cookie を再発行しない", async () => {
    await client.get("/api/cart");
    const res = await client.get("/api/cart");
    expect(res.setCookie).toBeNull();
  });

  it("本番環境では Secure を付ける", async () => {
    const prodEnv = createTestEnv("production");
    const res = await new TestClient(app, prodEnv).get("/api/cart");
    expect(res.setCookie).toContain("; Secure");
  });

  it("UUID でない Cookie 値は無効として扱い、新しい値を発行する", async () => {
    const res = await app.request("/api/cart", { headers: { Cookie: "session_id=not-a-uuid" } }, env);
    expect(res.headers.get("Set-Cookie")).toMatch(/^session_id=[0-9a-f-]{36}\.[0-9a-f]{64};/);
  });
});

describe("商品一覧 GET /api/products", () => {
  it("カテゴリ 4 件・商品 12 件を返し、在庫なしは 1 件", async () => {
    const res = await client.get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(4);
    expect(res.body.products).toHaveLength(12);
    const outOfStock = res.body.products.filter((p: { inStock: boolean }) => !p.inStock);
    expect(outOfStock.map((p: { id: number }) => p.id)).toEqual([12]);
    expect(res.body.intervalOptions).toEqual([14, 30, 60]);
    expect(res.body.quantityMax).toBe(5);
  });

  it("category で絞り込める", async () => {
    const res = await client.get("/api/products?category=kitchen");
    expect(res.body.selectedCategory).toBe("kitchen");
    expect(res.body.products.map((p: { name: string }) => p.name)).toContain("食器用スポンジ（3個入り）");
    expect(res.body.products.map((p: { name: string }) => p.name)).not.toContain("浴室用洗剤");
  });

  it("未知の category は全件を返し selectedCategory は null", async () => {
    const res = await client.get("/api/products?category=nonexistent");
    expect(res.status).toBe(200);
    expect(res.body.selectedCategory).toBeNull();
    expect(res.body.products).toHaveLength(12);
  });
});

describe("カート", () => {
  it("空のカートは合計 0 件", async () => {
    const res = await client.get("/api/cart");
    expect(res.body).toEqual({ items: [], count: 0, subtotal: 0, total: 0 });
  });

  it("商品を追加すると税抜小計と税込合計が返る", async () => {
    expect((await addToCart(client, 1, 2, 30)).status).toBe(200);
    const res = await client.get("/api/cart");
    expect(res.body.count).toBe(1);
    expect(res.body.items[0]).toMatchObject({ productName: "食器用スポンジ（3個入り）", quantity: 2, intervalDays: 30, subtotal: 596 });
    expect(res.body.subtotal).toBe(596);
    expect(res.body.total).toBe(taxIncluded(596));
  });

  it("税込は小数点以下切り捨て（旧版と同じ）", async () => {
    await addToCart(client, 2, 1, 30);
    const res = await client.get("/api/cart");
    expect(res.body.total).toBe(217);
  });

  it("同一商品・同一間隔は数量を加算し上限 5 で止める", async () => {
    await addToCart(client, 1, 3, 30);
    await addToCart(client, 1, 4, 30);
    const res = await client.get("/api/cart");
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(5);
  });

  it("同一商品でも間隔が違えば別の行になる", async () => {
    await addToCart(client, 1, 1, 14);
    await addToCart(client, 1, 1, 60);
    const res = await client.get("/api/cart");
    expect(res.body.items).toHaveLength(2);
  });

  it.each([
    ["数量 6", { productId: 1, quantity: 6, intervalDays: 30 }],
    ["数量 0", { productId: 1, quantity: 0, intervalDays: 30 }],
    ["間隔 7 日", { productId: 1, quantity: 1, intervalDays: 7 }],
    ["商品 ID が文字列", { productId: "1", quantity: 1, intervalDays: 30 }],
    ["商品 ID が小数", { productId: 1.5, quantity: 1, intervalDays: 30 }],
  ])("入力値が不正（%s）なら 400", async (_label, body) => {
    const res = await client.post("/api/cart/add", body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MESSAGES.invalidInput);
  });

  it("在庫なし商品は 400", async () => {
    const res = await addToCart(client, 12, 1, 30);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MESSAGES.productUnavailable);
  });

  it("存在しない商品は 400", async () => {
    const res = await addToCart(client, 999, 1, 30);
    expect(res.status).toBe(400);
  });

  it("壊れた JSON は 400", async () => {
    const res = await client.postRaw("/api/cart/add", "{not json");
    expect(res.status).toBe(400);
  });

  it("数量を変更できる", async () => {
    await addToCart(client, 1, 1, 30);
    const { body } = await client.get("/api/cart");
    const itemId = body.items[0].id as number;
    const res = await client.post("/api/cart/update", { itemId, quantity: 3 });
    expect(res.status).toBe(200);
    expect((await client.get("/api/cart")).body.items[0].quantity).toBe(3);
  });

  it("数量変更で範囲外は 400、他セッションのアイテムは 404", async () => {
    await addToCart(client, 1, 1, 30);
    const itemId = (await client.get("/api/cart")).body.items[0].id as number;
    expect((await client.post("/api/cart/update", { itemId, quantity: 6 })).status).toBe(400);

    const other = new TestClient(app, env);
    expect((await other.post("/api/cart/update", { itemId, quantity: 2 })).status).toBe(404);
    expect((await client.get("/api/cart")).body.items[0].quantity).toBe(1);
  });

  it("削除できる。他セッションのアイテムは 404 で削除されない", async () => {
    await addToCart(client, 1, 1, 30);
    const itemId = (await client.get("/api/cart")).body.items[0].id as number;

    const other = new TestClient(app, env);
    expect((await other.post("/api/cart/remove", { itemId })).status).toBe(404);
    expect((await client.get("/api/cart")).body.items).toHaveLength(1);

    expect((await client.post("/api/cart/remove", { itemId })).status).toBe(200);
    expect((await client.get("/api/cart")).body.items).toHaveLength(0);
  });
});

describe("注文 /api/checkout", () => {
  it("カートが空なら GET・POST とも 409", async () => {
    expect((await client.get("/api/checkout")).status).toBe(409);
    expect((await client.post("/api/checkout", CHECKOUT_FORM)).status).toBe(409);
  });

  it("GET はカート内容と税込合計を返す", async () => {
    await addToCart(client, 1, 2, 30);
    const res = await client.get("/api/checkout");
    expect(res.status).toBe(200);
    expect(res.body.subtotal).toBe(596);
    expect(res.body.total).toBe(655);
  });

  it("ハニーポットに値があれば 400 で注文は作られない", async () => {
    await addToCart(client, 1, 1, 30);
    const res = await client.post("/api/checkout", { ...CHECKOUT_FORM, website: "bot-value" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MESSAGES.honeypotDetected);
    expect(await countRows("orders")).toBe(0);
  });

  it("入力エラーは 400 と理由の配列を返し、注文は作らない", async () => {
    await addToCart(client, 1, 1, 30);
    const res = await client.post("/api/checkout", { ...CHECKOUT_FORM, name: "", phone: "090-1234-5678" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MESSAGES.orderValidationFailed);
    expect(res.body.errors).toEqual([MESSAGES.nameLength, MESSAGES.phoneFormat]);
    expect(await countRows("orders")).toBe(0);
  });

  it("注文確定で orders・subscriptions が作られ、カートは空になる", async () => {
    await addToCart(client, 1, 2, 14);
    await addToCart(client, 2, 1, 60);
    const res = await client.post("/api/checkout", CHECKOUT_FORM);
    expect(res.status).toBe(201);
    expect(typeof res.body.orderId).toBe("number");

    const order = await env.DB.prepare("SELECT id, total_price AS totalPrice FROM orders").first<{ id: number; totalPrice: number }>();
    expect(order?.id).toBe(res.body.orderId);
    expect(order?.totalPrice).toBe(taxIncluded(298 * 2 + 198));

    const subs = await env.DB
      .prepare("SELECT order_id AS orderId, product_id AS productId, interval_days AS intervalDays, status, next_delivery AS nextDelivery FROM subscriptions ORDER BY product_id")
      .all<{ orderId: number; productId: number; intervalDays: number; status: string; nextDelivery: string }>();
    expect(subs.results).toHaveLength(2);
    for (const sub of subs.results) {
      expect(sub.orderId).toBe(res.body.orderId);
      expect(sub.status).toBe("active");
      expect(sub.nextDelivery).toBe(addDays(jstToday(new Date()), sub.intervalDays));
    }
    expect((await client.get("/api/cart")).body.items).toHaveLength(0);
  });
});

describe("マイサブスク", () => {
  it("注文後に一覧へ表示され、税込金額を持つ", async () => {
    await placeOrder(client, 1, 30);
    const res = await client.get("/api/my-subs");
    expect(res.body.subs).toHaveLength(1);
    expect(res.body.subs[0]).toMatchObject({ productName: "食器用スポンジ（3個入り）", status: "active", intervalDays: 30, subtotal: 298, total: 327 });
  });

  it("一時停止すると next_delivery が空になり、停止中の再停止は 400", async () => {
    await placeOrder(client);
    const id = await firstSubId(client);
    expect((await client.post(`/api/my-subs/${id}/pause`)).status).toBe(200);
    const subs = (await client.get("/api/my-subs")).body.subs;
    expect(subs[0]).toMatchObject({ status: "paused", nextDelivery: null });
    expect((await client.post(`/api/my-subs/${id}/pause`)).status).toBe(400);
  });

  it("再開すると今日（JST）+ 間隔日が次回配送日になり、有効中の再開は 400", async () => {
    await placeOrder(client, 1, 14);
    const id = await firstSubId(client);
    expect((await client.post(`/api/my-subs/${id}/resume`)).status).toBe(400);
    await client.post(`/api/my-subs/${id}/pause`);
    expect((await client.post(`/api/my-subs/${id}/resume`)).status).toBe(200);
    const sub = (await client.get("/api/my-subs")).body.subs[0];
    expect(sub).toMatchObject({ status: "active", nextDelivery: addDays(jstToday(new Date()), 14) });
  });

  it("配送間隔を変更すると次回配送日も更新される。不正な間隔は 400、停止中は 400", async () => {
    await placeOrder(client, 1, 30);
    const id = await firstSubId(client);
    expect((await client.post(`/api/my-subs/${id}/change-interval`, { intervalDays: 7 })).status).toBe(400);
    expect((await client.post(`/api/my-subs/${id}/change-interval`, { intervalDays: 60 })).status).toBe(200);
    const sub = (await client.get("/api/my-subs")).body.subs[0];
    expect(sub).toMatchObject({ intervalDays: 60, nextDelivery: addDays(jstToday(new Date()), 60) });

    await client.post(`/api/my-subs/${id}/pause`);
    expect((await client.post(`/api/my-subs/${id}/change-interval`, { intervalDays: 14 })).status).toBe(400);
  });

  it("解約すると一覧から消える（論理削除）", async () => {
    await placeOrder(client);
    const id = await firstSubId(client);
    expect((await client.post(`/api/my-subs/${id}/cancel`)).status).toBe(200);
    expect((await client.get("/api/my-subs")).body.subs).toHaveLength(0);
    const row = await env.DB.prepare("SELECT status FROM subscriptions WHERE id = ?").bind(id).first<{ status: string }>();
    expect(row?.status).toBe("cancelled");
  });

  it("他セッションのサブスクは一覧に出ず、操作は 404", async () => {
    await placeOrder(client);
    const id = await firstSubId(client);
    const other = new TestClient(app, env);
    expect((await other.get("/api/my-subs")).body.subs).toHaveLength(0);
    expect((await other.post(`/api/my-subs/${id}/pause`)).status).toBe(404);
    expect((await other.post(`/api/my-subs/${id}/resume`)).status).toBe(404);
    expect((await other.post(`/api/my-subs/${id}/cancel`)).status).toBe(404);
    expect((await other.post(`/api/my-subs/${id}/change-interval`, { intervalDays: 14 })).status).toBe(404);
    expect((await client.get("/api/my-subs")).body.subs[0].status).toBe("active");
  });

  it("存在しない ID や数字でない ID は 404", async () => {
    expect((await client.post("/api/my-subs/99999/pause")).status).toBe(404);
    expect((await client.post("/api/my-subs/abc/pause")).status).toBe(404);
  });
});

describe("未定義のルート", () => {
  it("未定義の API パスは JSON の 404", async () => {
    const res = await client.get("/api/unknown");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(MESSAGES.apiNotFound);
  });
});
