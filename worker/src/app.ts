import { Hono } from "hono";
import { type AppEnv, isProductionLike } from "./env";
import { AppError } from "./errors";
import { createLogger } from "./logger";
import { MESSAGES } from "./messages";
import { touchSession } from "./repository";
import {
  buildSessionCookie,
  newSessionId,
  readSessionCookie,
  signSessionId,
  verifySignedSessionId,
} from "./session";
import { cartRoutes } from "./routes/cart";
import { catalogRoutes } from "./routes/catalog";
import { checkoutRoutes } from "./routes/checkout";
import { subscriptionRoutes } from "./routes/subscriptions";

// API は JSON だけを返す。ブラウザに解釈させない（スクリプト実行・フレーム埋め込み・MIME 推測・キャッシュを禁止）。
const API_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
};

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // session_id は HMAC で署名して Cookie に入れる。署名が合わなければ新しいセッションを発行する。
  // 署名鍵が無い場合は既定値で代用せず、例外（500）にする（鍵なしで発行された Cookie を受け入れないため）。
  app.use("/api/*", async (c, next) => {
    for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) {
      c.header(name, value);
    }
    const secret = c.env.SESSION_SECRET;
    if (!secret) {
      throw new Error("SESSION_SECRET is not configured");
    }

    const rawCookie = readSessionCookie(c.req.header("Cookie") ?? null);
    const existing = rawCookie === undefined ? undefined : await verifySignedSessionId(rawCookie, secret);
    const sessionId = existing ?? newSessionId();
    await touchSession(c.env.DB, sessionId, new Date().toISOString());
    c.set("sessionId", sessionId);
    await next();

    if (existing === undefined) {
      const signed = await signSessionId(sessionId, secret);
      c.header("Set-Cookie", buildSessionCookie(signed, isProductionLike(c.env.APP_ENV)));
    }
  });

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.route("/api", catalogRoutes);
  app.route("/api", cartRoutes);
  app.route("/api", checkoutRoutes);
  app.route("/api", subscriptionRoutes);

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: MESSAGES.apiNotFound }, 404);
    }
    return c.text("Not Found", 404);
  });

  app.onError((error, c) => {
    if (error instanceof AppError) {
      createLogger(c.env.APP_ENV).debug("request rejected", {
        path: c.req.path,
        status: error.status,
        message: error.message,
      });
      return c.json({ error: error.message, errors: error.details }, error.status);
    }
    createLogger(c.env.APP_ENV).error("unhandled error", {
      path: c.req.path,
      message: error.message,
      stack: error.stack,
    });
    return c.json({ error: MESSAGES.internalError }, 500);
  });

  return app;
}
