import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Env } from "../src/env";
import { MESSAGES } from "../src/messages";
import { createTestEnv } from "./helpers/testD1";

let env: Env;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  env = createTestEnv();
  app = createApp();
});

afterEach(() => {
  vi.restoreAllMocks();
});

interface Sent {
  status: number;
  body: any;
  setCookie: string | null;
  cookie: string | null; // 今回の応答で発行された Cookie（"session_id=..." 部分のみ）
}

async function send(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string; env?: Env } = {},
): Promise<Sent> {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.Cookie = options.cookie;
  let payload: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(options.body);
  }
  const res = await app.request(
    path,
    { method: options.method ?? "GET", headers, body: payload },
    options.env ?? env,
  );
  const setCookie = res.headers.get("Set-Cookie");
  const text = await res.text();
  return {
    status: res.status,
    body: text.length > 0 ? JSON.parse(text) : null,
    setCookie,
    cookie: setCookie ? (setCookie.split(";")[0] ?? null) : null,
  };
}

describe("セッション Cookie の改ざん・鍵違い", () => {
  it("改ざんされた Cookie は拒否され、新しいセッションが発行される（以前のカートは見えない）", async () => {
    const added = await send("/api/cart/add", { method: "POST", body: { productId: 1, quantity: 1, intervalDays: 30 } });
    const cookie = added.cookie as string;

    const valid = await send("/api/cart", { cookie });
    expect(valid.body.count).toBe(1);

    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith("0") ? "1" : "0"}`;
    const forged = await send("/api/cart", { cookie: tampered });
    expect(forged.body.count).toBe(0);
    expect(forged.setCookie).toMatch(/^session_id=[0-9a-f-]{36}\.[0-9a-f]{64};/);
  });

  it("別の署名鍵で発行された Cookie は受け入れない", async () => {
    const foreignEnv: Env = { ...createTestEnv(), SESSION_SECRET: "another-environment-secret-0123456789" };
    const foreign = await send("/api/cart", { env: foreignEnv });

    const check = await send("/api/cart", { cookie: foreign.cookie as string });
    expect(check.setCookie).not.toBeNull();
    expect(check.cookie).not.toBe(foreign.cookie);
  });

  it("署名なしの旧形式（UUID のみ）の Cookie は受け入れない", async () => {
    const legacy = await send("/api/cart", { cookie: "session_id=123e4567-e89b-42d3-a456-426614174000" });
    expect(legacy.setCookie).toMatch(/^session_id=[0-9a-f-]{36}\.[0-9a-f]{64};/);
  });

  it("SESSION_SECRET が空なら既定値で代用せず 500 を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const noSecretEnv: Env = { ...createTestEnv(), SESSION_SECRET: "" };
    const res = await send("/api/cart", { env: noSecretEnv });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: MESSAGES.internalError });
  });
});

describe("API レスポンスのセキュリティヘッダー", () => {
  it("正常応答・エラー応答とも CSP・nosniff・no-store が付く", async () => {
    const ok = await app.request("/api/products", {}, env);
    expect(ok.headers.get("Content-Security-Policy")).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(ok.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(ok.headers.get("Cache-Control")).toBe("no-store");

    const ng = await send("/api/cart/add", { method: "POST", body: {} });
    expect(ng.status).toBe(400);
    const ngRaw = await app.request("/api/cart/add", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } }, env);
    expect(ngRaw.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("ハニーポットの記録", () => {
  it("検知ログに session_id を含めず、honeypot の警告だけを出す", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const added = await send("/api/cart/add", { method: "POST", body: { productId: 1, quantity: 1, intervalDays: 30 } });
    const cookie = added.cookie as string;
    const sessionId = (cookie.split("=")[1] ?? "").split(".")[0] ?? "";
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

    const res = await send("/api/checkout", {
      method: "POST",
      cookie,
      body: { name: "山田", address: "東京", phone: "09012345678", website: "bot" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(MESSAGES.honeypotDetected);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls[0]);
    expect(logged).toContain("honeypot triggered");
    expect(logged).not.toContain(sessionId);
    expect(logged).not.toContain("sessionId");
  });
});
