import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Env } from "../src/env";
import { createLogger } from "../src/logger";
import { runDailyReset } from "../src/reset";
import { TestClient, createTestEnv } from "./helpers/testD1";

const silentLogger = createLogger("production");

let env: Env;

beforeEach(() => {
  env = createTestEnv();
});

async function countRows(db: D1Database, table: string): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

describe("日次リセット", () => {
  it("動的データだけを消し、マスタは残し、成功ログを記録する", async () => {
    const app = createApp();
    const client = new TestClient(app, env);
    await client.post("/api/cart/add", { productId: 1, quantity: 1, intervalDays: 30 });
    await client.post("/api/checkout", { name: "山田太郎", address: "東京都1-1", phone: "09012345678", website: "" });
    await client.post("/api/cart/add", { productId: 2, quantity: 1, intervalDays: 14 });
    expect(await countRows(env.DB, "orders")).toBe(1);
    expect(await countRows(env.DB, "subscriptions")).toBe(1);

    await runDailyReset(env.DB, silentLogger);

    expect(await countRows(env.DB, "orders")).toBe(0);
    expect(await countRows(env.DB, "subscriptions")).toBe(0);
    expect(await countRows(env.DB, "cart_items")).toBe(0);
    expect(await countRows(env.DB, "sessions")).toBe(0);
    expect(await countRows(env.DB, "categories")).toBe(4);
    expect(await countRows(env.DB, "products")).toBe(12);

    const log = await env.DB.prepare("SELECT status, tables_reset AS tablesReset FROM reset_logs").first<{ status: string; tablesReset: string }>();
    expect(log).toEqual({ status: "success", tablesReset: "sessions,cart_items,orders,subscriptions" });
  });

  it("リセット後もそれまでの Cookie でアクセスできる（空のカートとして扱う）", async () => {
    const app = createApp();
    const client = new TestClient(app, env);
    await client.post("/api/cart/add", { productId: 1, quantity: 1, intervalDays: 30 });
    await runDailyReset(env.DB, silentLogger);
    const res = await client.get("/api/cart");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  it("失敗時はエラーを記録して例外を再送出する", async () => {
    const failingDb = {
      prepare: (sql: string) => env.DB.prepare(sql),
      batch: async () => {
        throw new Error("simulated batch failure");
      },
    } as unknown as D1Database;

    await expect(runDailyReset(failingDb, silentLogger)).rejects.toThrow("simulated batch failure");
    const log = await env.DB.prepare("SELECT status FROM reset_logs").first<{ status: string }>();
    expect(log?.status).toBe("error");
  });
});
