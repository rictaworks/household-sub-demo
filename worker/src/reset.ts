import type { Logger } from "./logger";

// 旧 scheduler.reset_demo_db と同じ対象（マスタ categories・products と reset_logs は対象外）。
const RESET_TABLES_LABEL = "sessions,cart_items,orders,subscriptions";

// 子テーブルから順に削除する（外部キー制約のため）。batch は 1 トランザクションで実行される。
export async function runDailyReset(db: D1Database, logger: Logger, now: Date = new Date()): Promise<void> {
  const executedAt = now.toISOString();
  try {
    await db.batch([
      db.prepare("DELETE FROM subscriptions"),
      db.prepare("DELETE FROM orders"),
      db.prepare("DELETE FROM cart_items"),
      db.prepare("DELETE FROM sessions"),
      db
        .prepare("INSERT INTO reset_logs (executed_at, tables_reset, status) VALUES (?, ?, 'success')")
        .bind(executedAt, RESET_TABLES_LABEL),
    ]);
    logger.debug("daily reset completed", { executedAt });
  } catch (error) {
    logger.error("daily reset failed", { executedAt, message: String(error) });
    try {
      await db
        .prepare("INSERT INTO reset_logs (executed_at, tables_reset, status) VALUES (?, ?, 'error')")
        .bind(executedAt, RESET_TABLES_LABEL)
        .run();
    } catch (logError) {
      logger.error("failed to record reset failure", { message: String(logError) });
    }
    throw error;
  }
}
