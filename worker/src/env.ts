export interface Env {
  DB: D1Database;
  APP_ENV: string;
  // Cookie 署名鍵。値はリポジトリに書かない（ローカルは .dev.vars、本番は wrangler secret put）。
  SESSION_SECRET: string;
}

export type AppVariables = {
  sessionId: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

// 本番扱いは「development / test 以外すべて」とする。設定漏れで Secure 属性や本番向けの挙動が外れないようにするため。
export function isProductionLike(appEnv: string): boolean {
  return appEnv !== "development" && appEnv !== "test";
}
