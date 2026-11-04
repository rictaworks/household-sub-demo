import { Hono } from "hono";
import type { AppEnv } from "../env";
import { AppError } from "../errors";
import { MESSAGES } from "../messages";
import { addDays, isIntervalOption, jstToday, taxIncluded } from "../domain";
import { parsePathId, readJsonObject } from "../http";
import {
  cancelSubscription,
  changeSubscriptionInterval,
  findOwnedSubscription,
  listVisibleSubscriptions,
  pauseSubscription,
  resumeSubscription,
} from "../repository";

export const subscriptionRoutes = new Hono<AppEnv>();

// 旧 GET /my-subs（解約済みを除く）
subscriptionRoutes.get("/my-subs", async (c) => {
  const rows = await listVisibleSubscriptions(c.env.DB, c.get("sessionId"));
  const subs = rows.map((row) => {
    const subtotal = row.unitPrice * row.quantity;
    return {
      id: row.id,
      productName: row.productName,
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      intervalDays: row.intervalDays,
      status: row.status,
      nextDelivery: row.nextDelivery,
      subtotal,
      total: taxIncluded(subtotal),
    };
  });
  return c.json({ subs });
});

subscriptionRoutes.post("/my-subs/:id/pause", async (c) => {
  const sessionId = c.get("sessionId");
  const subId = parsePathId(c.req.param("id"), MESSAGES.subNotFound);
  const sub = await findOwnedSubscription(c.env.DB, sessionId, subId);
  if (!sub) {
    throw new AppError(404, MESSAGES.subNotFound);
  }
  if (sub.status !== "active") {
    throw new AppError(400, MESSAGES.subPauseNotAllowed);
  }
  await pauseSubscription(c.env.DB, sessionId, sub.id, new Date().toISOString());
  return c.json({ ok: true });
});

subscriptionRoutes.post("/my-subs/:id/resume", async (c) => {
  const sessionId = c.get("sessionId");
  const subId = parsePathId(c.req.param("id"), MESSAGES.subNotFound);
  const sub = await findOwnedSubscription(c.env.DB, sessionId, subId);
  if (!sub) {
    throw new AppError(404, MESSAGES.subNotFound);
  }
  if (sub.status !== "paused") {
    throw new AppError(400, MESSAGES.subResumeNotAllowed);
  }
  const now = new Date();
  const nextDelivery = addDays(jstToday(now), sub.intervalDays);
  await resumeSubscription(c.env.DB, sessionId, sub.id, nextDelivery, now.toISOString());
  return c.json({ ok: true });
});

// 旧版と同じく、解約は状態を問わず実行する（論理削除）。
subscriptionRoutes.post("/my-subs/:id/cancel", async (c) => {
  const sessionId = c.get("sessionId");
  const subId = parsePathId(c.req.param("id"), MESSAGES.subNotFound);
  const sub = await findOwnedSubscription(c.env.DB, sessionId, subId);
  if (!sub) {
    throw new AppError(404, MESSAGES.subNotFound);
  }
  await cancelSubscription(c.env.DB, sessionId, sub.id, new Date().toISOString());
  return c.json({ ok: true });
});

subscriptionRoutes.post("/my-subs/:id/change-interval", async (c) => {
  const sessionId = c.get("sessionId");
  const body = await readJsonObject(c);
  const { intervalDays } = body;
  if (!isIntervalOption(intervalDays)) {
    throw new AppError(400, MESSAGES.invalidInterval);
  }
  const subId = parsePathId(c.req.param("id"), MESSAGES.subNotFound);
  const sub = await findOwnedSubscription(c.env.DB, sessionId, subId);
  if (!sub) {
    throw new AppError(404, MESSAGES.subNotFound);
  }
  if (sub.status !== "active") {
    throw new AppError(400, MESSAGES.subIntervalChangeNotAllowed);
  }
  const now = new Date();
  const nextDelivery = addDays(jstToday(now), intervalDays);
  await changeSubscriptionInterval(c.env.DB, sessionId, sub.id, intervalDays, nextDelivery, now.toISOString());
  return c.json({ ok: true });
});
