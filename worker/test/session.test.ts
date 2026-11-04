import { describe, expect, it } from "vitest";
import {
  buildSessionCookie,
  newSessionId,
  readSessionCookie,
  signSessionId,
  verifySignedSessionId,
} from "../src/session";
import { TEST_SESSION_SECRET } from "./helpers/testD1";

const OTHER_SECRET = "another-secret-used-by-another-environment-0123";

function flipLastHexDigit(value: string): string {
  const last = value.slice(-1);
  return value.slice(0, -1) + (last === "0" ? "1" : "0");
}

describe("セッション ID の HMAC 署名", () => {
  it("正しい署名の値は session_id を返す", async () => {
    const id = newSessionId();
    const signed = await signSessionId(id, TEST_SESSION_SECRET);
    expect(signed.startsWith(`${id}.`)).toBe(true);
    expect(await verifySignedSessionId(signed, TEST_SESSION_SECRET)).toBe(id);
  });

  it("署名の 1 文字でも改ざんされた値は拒否する", async () => {
    const signed = await signSessionId(newSessionId(), TEST_SESSION_SECRET);
    expect(await verifySignedSessionId(flipLastHexDigit(signed), TEST_SESSION_SECRET)).toBeUndefined();
  });

  it("session_id を別の値に差し替えた値は拒否する", async () => {
    const signed = await signSessionId(newSessionId(), TEST_SESSION_SECRET);
    const forged = `${newSessionId()}.${signed.split(".")[1]}`;
    expect(await verifySignedSessionId(forged, TEST_SESSION_SECRET)).toBeUndefined();
  });

  it("別の鍵で発行された値は拒否する", async () => {
    const signed = await signSessionId(newSessionId(), OTHER_SECRET);
    expect(await verifySignedSessionId(signed, TEST_SESSION_SECRET)).toBeUndefined();
  });

  it("署名なしの旧形式（UUID のみ）は拒否する", async () => {
    expect(await verifySignedSessionId(newSessionId(), TEST_SESSION_SECRET)).toBeUndefined();
  });

  it("形式が不正な値（署名の桁数違い・非 hex・空）は拒否する", async () => {
    const id = newSessionId();
    expect(await verifySignedSessionId(`${id}.abc`, TEST_SESSION_SECRET)).toBeUndefined();
    expect(await verifySignedSessionId(`${id}.${"z".repeat(64)}`, TEST_SESSION_SECRET)).toBeUndefined();
    expect(await verifySignedSessionId("", TEST_SESSION_SECRET)).toBeUndefined();
  });
});

describe("Cookie の読み書き", () => {
  it("他の Cookie が混ざっていても session_id の生の値を取り出す", () => {
    expect(readSessionCookie("theme=dark; session_id=abc.def; lang=ja")).toBe("abc.def");
  });

  it("session_id が無い・ヘッダーが無い場合は undefined", () => {
    expect(readSessionCookie("other=1")).toBeUndefined();
    expect(readSessionCookie(null)).toBeUndefined();
  });

  it("Secure 属性は指定された場合だけ付く", () => {
    expect(buildSessionCookie("x.y", true)).toContain("; Secure");
    expect(buildSessionCookie("x.y", false)).not.toContain("Secure");
    expect(buildSessionCookie("x.y", true)).toContain("HttpOnly");
  });
});
