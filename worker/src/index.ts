import { createApp } from "./app";
import type { Env } from "./env";
import { createLogger } from "./logger";
import { runDailyReset } from "./reset";

const app = createApp();

export default {
  fetch: app.fetch,

  // Cron（UTC 18:00 = JST 03:00）で動的データをリセットする。
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runDailyReset(env.DB, createLogger(env.APP_ENV));
  },
} satisfies ExportedHandler<Env>;
