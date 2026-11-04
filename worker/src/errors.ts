import type { ContentfulStatusCode } from "hono/utils/http-status";

// 利用者に返してよい業務エラー。予期しない例外は app.ts の onError で 500 に変換する。
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}
