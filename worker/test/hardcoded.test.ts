import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 旧 src/tests/test_hardcoded.py の移植と、CLAUDE.md の UI ルール（alert/confirm/prompt・絵文字の禁止）の検査。
const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = path.join(here, "..");

function listFiles(dir: string, extensions: string[]): string[] {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listFiles(full, extensions);
    return extensions.some((ext) => full.endsWith(ext)) ? [full] : [];
  });
}

function findViolations(files: string[], patterns: Array<{ pattern: RegExp; label: string }>): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf-8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { pattern, label } of patterns) {
        if (pattern.test(line)) {
          violations.push(`${path.relative(WORKER_ROOT, file)}:${index + 1} ${label}: ${line.trim()}`);
        }
      }
    });
  }
  return violations;
}

describe("ハードコード・UI ルールの検査", () => {
  it("サーバーコードに秘密値の直書きがない", () => {
    const files = listFiles(path.join(WORKER_ROOT, "src"), [".ts"]);
    const violations = findViolations(files, [
      { pattern: /secret\w*\s*[:=]\s*["'][^"']{8,}["']/i, label: "秘密値の直書き" },
      { pattern: /password\s*[:=]\s*["'][^"']+["']/i, label: "パスワードの直書き" },
      { pattern: /(api[_-]?key|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i, label: "API キー・トークンの直書き" },
    ]);
    expect(violations).toEqual([]);
  });

  it("フロントエンドに alert() / confirm() / prompt() がない", () => {
    const files = listFiles(path.join(WORKER_ROOT, "public"), [".js", ".html"]);
    const violations = findViolations(files, [
      { pattern: /\balert\s*\(/, label: "alert() 禁止" },
      { pattern: /\bconfirm\s*\(/, label: "confirm() 禁止" },
      { pattern: /\bprompt\s*\(/, label: "prompt() 禁止" },
    ]);
    expect(violations).toEqual([]);
  });

  it("フロントエンドとサーバーコードに絵文字がない", () => {
    const files = [
      ...listFiles(path.join(WORKER_ROOT, "public"), [".js", ".html"]),
      ...listFiles(path.join(WORKER_ROOT, "src"), [".ts"]),
    ];
    const violations = findViolations(files, [{ pattern: /\p{Extended_Pictographic}/u, label: "絵文字禁止" }]);
    expect(violations).toEqual([]);
  });

  // CSP（style-src 'self' / script-src 'self'）を保つため、インライン style 属性・インライン script を禁止する。
  it("インライン style 属性・インライン script がない（CSP）", () => {
    const jsViolations = findViolations(listFiles(path.join(WORKER_ROOT, "public"), [".js"]), [
      { pattern: /\bstyle\s*:\s*["'`]/, label: "style プロパティの直書き" },
      { pattern: /\bstyle\s*=\s*["']/, label: "style 属性の直書き" },
    ]);
    const htmlViolations = findViolations(listFiles(path.join(WORKER_ROOT, "public"), [".html"]), [
      { pattern: /\sstyle\s*=\s*["']/, label: "HTML のインライン style" },
      { pattern: /<script(?![^>]*\bsrc\s*=)[^>]*>/i, label: "インライン script" },
    ]);
    expect([...jsViolations, ...htmlViolations]).toEqual([]);
  });
});
