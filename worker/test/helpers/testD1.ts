import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync as SqliteDatabase } from "node:sqlite";
import type { Hono } from "hono";
import type { AppEnv, Env } from "../../src/env";

// vitest の静的解析が node:sqlite を素通りできないため、ネイティブ require で取得する（外部パッケージ不要）。
const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.join(here, "..", "..", "migrations", "0001_init.sql");

interface D1Meta {
  changes: number;
  last_row_id: number;
  duration: number;
  rows_read: number;
  rows_written: number;
  size_after: number;
  changed_db: boolean;
}

interface D1Output {
  success: true;
  results: unknown[];
  meta: D1Meta;
}

function emptyMeta(): D1Meta {
  return {
    changes: 0,
    last_row_id: 0,
    duration: 0,
    rows_read: 0,
    rows_written: 0,
    size_after: 0,
    changed_db: false,
  };
}

// 本番の D1 と同じ prepare().bind().all()/first()/run()/batch() の形を node:sqlite の上に実装する。
// batch は BEGIN/COMMIT で囲み、D1 と同じく全件成功か全件取り消しにする。
class SqliteStatement {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly sql: string,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): SqliteStatement {
    return new SqliteStatement(this.db, this.sql, values);
  }

  execute(): D1Output {
    const statement = this.db.prepare(this.sql);
    const info = statement.run(...(this.values as never[]));
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
        duration: 0,
        rows_read: 0,
        rows_written: Number(info.changes),
        size_after: 0,
        changed_db: Number(info.changes) > 0,
      },
    };
  }

  async run(): Promise<D1Output> {
    return this.execute();
  }

  async all<T>(): Promise<{ results: T[]; success: true; meta: D1Meta }> {
    const rows = this.db.prepare(this.sql).all(...(this.values as never[])) as T[];
    return { results: rows, success: true, meta: emptyMeta() };
  }

  async first<T>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...(this.values as never[])) as T | undefined;
    return row ?? null;
  }
}

class SqliteD1 {
  constructor(private readonly db: SqliteDatabase) {}

  prepare(sql: string): SqliteStatement {
    return new SqliteStatement(this.db, sql);
  }

  async batch(statements: SqliteStatement[]): Promise<D1Output[]> {
    this.db.exec("BEGIN");
    try {
      const results = statements.map((statement) => statement.execute());
      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function createTestD1(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(readFileSync(MIGRATION_PATH, "utf-8"));
  return new SqliteD1(sqlite) as unknown as D1Database;
}

// テスト専用の署名鍵（本番・開発の値ではない）。
export const TEST_SESSION_SECRET = "test-only-session-secret-0123456789abcdef";

export function createTestEnv(appEnv = "test"): Env {
  return { DB: createTestD1(), APP_ENV: appEnv, SESSION_SECRET: TEST_SESSION_SECRET };
}

export interface ApiResponse {
  status: number;
  body: any;
  setCookie: string | null;
}

// Cookie を保持する簡易クライアント。別の利用者（別セッション）は new TestClient で作る。
export class TestClient {
  private cookie: string | undefined;

  constructor(
    private readonly app: Hono<AppEnv>,
    private readonly env: Env,
  ) {}

  async get(path: string): Promise<ApiResponse> {
    return this.send("GET", path);
  }

  async post(path: string, body?: unknown): Promise<ApiResponse> {
    return this.send("POST", path, body);
  }

  async postRaw(path: string, rawBody: string): Promise<ApiResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cookie) headers.Cookie = this.cookie;
    const response = await this.app.request(path, { method: "POST", headers, body: rawBody }, this.env);
    return this.toApiResponse(response);
  }

  private async send(method: string, path: string, body?: unknown): Promise<ApiResponse> {
    const headers: Record<string, string> = {};
    if (this.cookie) headers.Cookie = this.cookie;
    let payload: string | undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const response = await this.app.request(path, { method, headers, body: payload }, this.env);
    return this.toApiResponse(response);
  }

  private async toApiResponse(response: Response): Promise<ApiResponse> {
    const setCookie = response.headers.get("Set-Cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }
    const text = await response.text();
    return {
      status: response.status,
      body: text.length > 0 ? JSON.parse(text) : null,
      setCookie,
    };
  }
}
