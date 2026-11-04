import type { Context } from "hono";
import type { AppEnv } from "./env";
import { AppError } from "./errors";
import { createLogger } from "./logger";
import { MESSAGES } from "./messages";

export type JsonObject = Record<string, unknown>;

// JSON ボディを読む。壊れた JSON・配列・非オブジェクトは 400 にする。
export async function readJsonObject(c: Context<AppEnv>): Promise<JsonObject> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch (error) {
    createLogger(c.env.APP_ENV).debug("request body is not valid JSON", { message: String(error) });
    throw new AppError(400, MESSAGES.invalidInput);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(400, MESSAGES.invalidInput);
  }
  return body as JsonObject;
}

export function trimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// パスの :id を正の整数として解釈する。不正な値は存在しないリソースとして 404 にする（旧 Flask の <int:sub_id> と同じ）。
export function parsePathId(raw: string, notFoundMessage: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(404, notFoundMessage);
  }
  return value;
}
