import { Hono } from "hono";
import type { AppEnv } from "../env";
import { AppError } from "../errors";
import { MESSAGES } from "../messages";
import { jstToday, taxIncluded, validateOrderForm } from "../domain";
import { createLogger } from "../logger";
import { readJsonObject, trimmedString } from "../http";
import { listCartLines, placeOrder } from "../repository";

export const checkoutRoutes = new Hono<AppEnv>();

// 旧 GET /checkout（カートが空なら 409。フロントは /cart へ戻す）
checkoutRoutes.get("/checkout", async (c) => {
  const lines = await listCartLines(c.env.DB, c.get("sessionId"));
  if (lines.length === 0) {
    throw new AppError(409, MESSAGES.cartEmpty);
  }
  const items = lines.map((line) => ({
    id: line.id,
    productName: line.productName,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    intervalDays: line.intervalDays,
    subtotal: line.unitPrice * line.quantity,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  return c.json({ items, subtotal, total: taxIncluded(subtotal) });
});

// 旧 POST /checkout。ハニーポット → カート確認 → 入力検証 → 注文確定の順。
checkoutRoutes.post("/checkout", async (c) => {
  const sessionId = c.get("sessionId");
  const body = await readJsonObject(c);

  const honeypot = body.website;
  if (honeypot !== undefined && honeypot !== null && honeypot !== "") {
    // 検知の記録には利用者を特定する値（session_id）を含めない。
    createLogger(c.env.APP_ENV).warn("honeypot triggered", {
      ip: c.req.header("CF-Connecting-IP") ?? null,
    });
    throw new AppError(400, MESSAGES.honeypotDetected);
  }

  const lines = await listCartLines(c.env.DB, sessionId);
  if (lines.length === 0) {
    throw new AppError(409, MESSAGES.cartEmpty);
  }

  const form = {
    name: trimmedString(body.name),
    address: trimmedString(body.address),
    phone: trimmedString(body.phone),
  };
  const errors = validateOrderForm(form);
  if (errors.length > 0) {
    throw new AppError(400, MESSAGES.orderValidationFailed, errors);
  }

  // 金額と明細は placeOrder が同じバッチ内で集計する。ここで読んだ lines は空判定だけに使う。
  const now = new Date();
  const orderId = await placeOrder(c.env.DB, sessionId, form, jstToday(now), now.toISOString());
  if (orderId === null) {
    throw new AppError(409, MESSAGES.cartEmpty);
  }
  return c.json({ orderId }, 201);
});
