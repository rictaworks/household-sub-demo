import { isProductionLike } from "./env";

// 本番ではデバッグログを抑制し、開発・テストではフルトレースを出す（CLAUDE.md「デバッグ」節）。
export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export function createLogger(appEnv: string): Logger {
  const verbose = !isProductionLike(appEnv);
  return {
    debug(message, data) {
      if (verbose) console.debug(message, data ?? {});
    },
    warn(message, data) {
      console.warn(message, data ?? {});
    },
    error(message, data) {
      console.error(message, data ?? {});
    },
  };
}
