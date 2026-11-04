import { Hono } from "hono";
import type { AppEnv } from "../env";
import { AppError } from "../errors";
import { MESSAGES } from "../messages";
import { QUANTITY_MAX, isIntervalOption, isPositiveInteger, isQuantity, taxIncluded } from "../domain";
import { readJsonObject } from "../http";
import {
  deleteCartItem,
  findCartItemForProduct,
  findOwnedCartItem,
  findProduct,
  insertCartItem,
  listCartLines,
  setCartItemQuantity,
} from "../repository";

export const cartRoutes = new Hono<AppEnv>();

// 旧 GET /cart
cartRoutes.get("/cart", async (c) => {
  const lines = await listCartLines(c.env.DB, c.get("sessionId"));
  const items = lines.map((line) => ({
    id: line.id,
    productId: line.productId,
    productName: line.productName,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    intervalDays: line.intervalDays,
    subtotal: line.unitPrice * line.quantity,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  return c.json({
    items,
    count: items.length,
    subtotal,
    total: taxIncluded(subtotal),
  });
});

// 旧 POST /cart/add。同一商品・同一間隔は数量を加算（上限 5）。
cartRoutes.post("/cart/add", async (c) => {
  const sessionId = c.get("sessionId");
  const body = await readJsonObject(c);
  const { productId, quantity, intervalDays } = body;
  if (!isPositiveInteger(productId) || !isQuantity(quantity) || !isIntervalOption(intervalDays)) {
    throw new AppError(400, MESSAGES.invalidInput);
  }

  const product = await findProduct(c.env.DB, productId);
  if (!product || product.inStock !== 1) {
    throw new AppError(400, MESSAGES.productUnavailable);
  }

  const existing = await findCartItemForProduct(c.env.DB, sessionId, productId, intervalDays);
  if (existing) {
    await setCartItemQuantity(c.env.DB, existing.id, Math.min(existing.quantity + quantity, QUANTITY_MAX));
  } else {
    await insertCartItem(c.env.DB, sessionId, productId, quantity, intervalDays, new Date().toISOString());
  }
  return c.json({ ok: true });
});

// 旧 POST /cart/update
cartRoutes.post("/cart/update", async (c) => {
  const sessionId = c.get("sessionId");
  const body = await readJsonObject(c);
  const { itemId, quantity } = body;
  if (!isPositiveInteger(itemId) || !isQuantity(quantity)) {
    throw new AppError(400, MESSAGES.invalidInput);
  }

  const item = await findOwnedCartItem(c.env.DB, sessionId, itemId);
  if (!item) {
    throw new AppError(404, MESSAGES.itemNotFound);
  }
  await setCartItemQuantity(c.env.DB, item.id, quantity);
  return c.json({ ok: true });
});

// 旧 POST /cart/remove
cartRoutes.post("/cart/remove", async (c) => {
  const sessionId = c.get("sessionId");
  const body = await readJsonObject(c);
  const { itemId } = body;
  if (!isPositiveInteger(itemId)) {
    throw new AppError(400, MESSAGES.invalidInput);
  }

  const item = await findOwnedCartItem(c.env.DB, sessionId, itemId);
  if (!item) {
    throw new AppError(404, MESSAGES.itemNotFound);
  }
  await deleteCartItem(c.env.DB, item.id);
  return c.json({ ok: true });
});
