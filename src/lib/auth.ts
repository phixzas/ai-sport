import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const tokenLifetimeSeconds = 60 * 60 * 24 * 7;

export type AuthUser = { id: string; email: string };

function getTokenSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("AUTH_TOKEN_SECRET must contain at least 32 bytes.");
  }
  return secret;
}

export function assertAuthConfiguration() {
  getTokenSecret();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64) as Buffer;
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createAuthToken(user: AuthUser) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    iat: issuedAt,
    exp: issuedAt + tokenLifetimeSeconds,
  })).toString("base64url");
  const content = `${header}.${payload}`;
  const signature = createHmac("sha256", getTokenSecret()).update(content).digest("base64url");
  return `${content}.${signature}`;
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const [header, payload, signature, extra] = token.split(".");
    if (!header || !payload || !signature || extra) return null;
    const headerClaims = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as {
      alg?: unknown;
      typ?: unknown;
    };
    if (headerClaims.alg !== "HS256" || headerClaims.typ !== "JWT") return null;
    const content = `${header}.${payload}`;
    const expected = createHmac("sha256", getTokenSecret()).update(content).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      email?: unknown;
      exp?: unknown;
    };
    if (typeof claims.sub !== "string" || typeof claims.email !== "string" ||
        typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { id: claims.sub, email: claims.email };
  } catch {
    return null;
  }
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
