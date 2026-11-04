import { beforeEach, describe, expect, it } from "vitest";
import { taxIncluded } from "../src/domain";
import type { Env } from "../src/env";
import { insertCartItem, placeOrder } from "../src/repository";
import { createTestEnv } from "./helpers/testD1";

let env: Env;

beforeEach(() => {
  env = createTestEnv();
});

async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

const ORDER = { name: "山田太郎", address: "東京都渋谷区1-1-1", phone: "09012345678" };
const NOW = "2026-11-04T01:00:00.000Z";

describe("placeOrder（注文確定のバッチ）", () => {
  it("カートが空なら何も作らず null を返す（確認時点と確定時点がずれても不整合を残さない）", async () => {
    const result = await placeOrder(env.DB, "session-empty", ORDER, "2026-11-04", NOW);
    expect(result).toBeNull();
    expect(await count("orders")).toBe(0);
    expect(await count("subscriptions")).toBe(0);
  });

  it("税込金額は同じバッチ内の cart_items から集計され、明細と同じ order_id を指す", async () => {
    const sid = "session-batch";
    await insertCartItem(env.DB, sid, 1, 2, 14, NOW);
    await insertCartItem(env.DB, sid, 2, 1, 60, NOW);

    const orderId = await placeOrder(env.DB, sid, ORDER, "2026-11-04", NOW);
    expect(orderId).not.toBeNull();

    const order = await env.DB.prepare("SELECT total_price AS totalPrice FROM orders WHERE id = ?").bind(orderId).first<{ totalPrice: number }>();
    expect(order?.totalPrice).toBe(taxIncluded(298 * 2 + 198));

    const subs = await env.DB.prepare("SELECT order_id AS orderId FROM subscriptions WHERE session_id = ?").bind(sid).all<{ orderId: number }>();
    expect(subs.results.map((row) => row.orderId)).toEqual([orderId, orderId]);
    expect(await count("cart_items")).toBe(0);
  });
});
