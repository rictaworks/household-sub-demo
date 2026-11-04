// 旧 Flask 版は署名付き Cookie（SECRET_KEY）だった。新版も session_id に HMAC-SHA256 の署名を付け、
// 署名が合わない値（改ざん・他環境の鍵で発行された値・署名なしの旧形式）は新しいセッションとして扱う。
const COOKIE_NAME = "session_id";
const COOKIE_MAX_AGE_SECONDS = 86400;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();

// Cookie の生の値（"<uuid>.<署名>"）を返す。検証はしない。
export function readSessionCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === COOKIE_NAME) {
      return rest.join("=");
    }
  }
  return undefined;
}

export function newSessionId(): string {
  return crypto.randomUUID();
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function signSessionId(sessionId: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(sessionId));
  return `${sessionId}.${toHex(signature)}`;
}

// 署名が正しければ session_id を返す。WebCrypto の verify は定数時間比較。
export async function verifySignedSessionId(value: string, secret: string): Promise<string | undefined> {
  const dot = value.lastIndexOf(".");
  if (dot < 0) return undefined;
  const sessionId = value.slice(0, dot);
  const signatureHex = value.slice(dot + 1);
  if (!UUID_PATTERN.test(sessionId) || !SIGNATURE_PATTERN.test(signatureHex)) return undefined;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    fromHex(signatureHex),
    encoder.encode(sessionId),
  );
  return valid ? sessionId : undefined;
}

export function buildSessionCookie(signedValue: string, secure: boolean): string {
  const attributes = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${COOKIE_MAX_AGE_SECONDS}`];
  if (secure) attributes.push("Secure");
  return `${COOKIE_NAME}=${signedValue}; ${attributes.join("; ")}`;
}
