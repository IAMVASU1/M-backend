import crypto from "crypto";
import { config } from "./config.js";

const otpByEmail = new Map();
const lastOtpSentAtByEmail = new Map();
const revokedTokenHashes = new Map();

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailToUuid(email) {
  const hex = crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
  const base = hex.slice(0, 32).split("");
  base[12] = "4";
  const variant = (parseInt(base[16], 16) & 0x3) | 0x8;
  base[16] = variant.toString(16);
  return `${base.slice(0, 8).join("")}-${base.slice(8, 12).join("")}-${base.slice(12, 16).join("")}-${base.slice(16, 20).join("")}-${base.slice(20, 32).join("")}`;
}

function hashOtp(email, code) {
  return crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}:${String(code)}:${config.authSecret}`)
    .digest("hex");
}

function createOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function base64UrlDecodeToString(input) {
  return Buffer.from(String(input || ""), "base64url").toString("utf8");
}

function parseTokenPayload(tokenRaw, { verifySignature = true, verifyExpiry = true } = {}) {
  const token = String(tokenRaw || "").trim();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  try {
    const header = JSON.parse(base64UrlDecodeToString(headerB64));
    if (!header || header.alg !== "HS256" || header.typ !== "JWT") return null;

    if (verifySignature) {
      const data = `${headerB64}.${payloadB64}`;
      const expectedSig = crypto
        .createHmac("sha256", config.authSecret)
        .update(data)
        .digest("base64url");

      const expectedBuf = Buffer.from(expectedSig, "base64url");
      const actualBuf = Buffer.from(signatureB64, "base64url");
      if (expectedBuf.length !== actualBuf.length) return null;
      if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;
    }

    const payload = JSON.parse(base64UrlDecodeToString(payloadB64));
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.email !== "string" || typeof payload.userId !== "string") return null;
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;

    if (verifyExpiry && payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function createSessionToken({ email, userId, expiresAtMs }) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    email,
    userId,
    iat: nowSec,
    exp: Math.floor(expiresAtMs / 1000),
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${headerB64}.${payloadB64}`;
  const signatureB64 = crypto
    .createHmac("sha256", config.authSecret)
    .update(data)
    .digest("base64url");
  return `${data}.${signatureB64}`;
}

function cleanupExpired() {
  const now = Date.now();

  for (const [email, rec] of otpByEmail.entries()) {
    if (rec.expiresAt <= now) otpByEmail.delete(email);
  }
  for (const [tokenHashValue, expiresAt] of revokedTokenHashes.entries()) {
    if (expiresAt <= now) revokedTokenHashes.delete(tokenHashValue);
  }
}

function assertAllowedEmail(email) {
  if (!config.allowedEmails.length) return;
  if (!config.allowedEmails.includes(normalizeEmail(email))) {
    throw httpError(403, "Email not allowed");
  }
}

export function createOtpForEmail(emailRaw) {
  cleanupExpired();

  const email = normalizeEmail(emailRaw);
  assertAllowedEmail(email);

  const now = Date.now();
  const lastSentAt = lastOtpSentAtByEmail.get(email) || 0;
  const waitMs = config.otpResendCooldownSeconds * 1000;
  if (now - lastSentAt < waitMs) {
    throw httpError(429, "Please wait before requesting another code.");
  }

  const code = createOtpCode();
  otpByEmail.set(email, {
    email,
    codeHash: hashOtp(email, code),
    attempts: 0,
    expiresAt: now + config.otpTtlSeconds * 1000,
  });
  lastOtpSentAtByEmail.set(email, now);

  return {
    email,
    code,
    expiresAt: now + config.otpTtlSeconds * 1000,
  };
}

export function verifyOtpAndCreateSession(emailRaw, codeRaw) {
  cleanupExpired();

  const email = normalizeEmail(emailRaw);
  const code = String(codeRaw || "").trim();
  assertAllowedEmail(email);

  const rec = otpByEmail.get(email);
  if (!rec) throw httpError(401, "No active OTP. Request a new code.");
  if (rec.expiresAt <= Date.now()) {
    otpByEmail.delete(email);
    throw httpError(401, "OTP expired. Request a new code.");
  }

  rec.attempts += 1;
  if (rec.attempts > config.otpMaxAttempts) {
    otpByEmail.delete(email);
    throw httpError(429, "Too many incorrect attempts. Request a new code.");
  }

  const incomingHash = hashOtp(email, code);
  if (incomingHash !== rec.codeHash) {
    throw httpError(401, "Invalid OTP code.");
  }

  otpByEmail.delete(email);

  const createdAt = Date.now();
  const expiresAt = createdAt + config.sessionTtlSeconds * 1000;
  const userId = emailToUuid(email);
  const token = createSessionToken({
    email,
    userId,
    expiresAtMs: expiresAt,
  });

  return {
    token,
    email,
    userId,
    createdAt,
    expiresAt,
  };
}

export function getSessionByToken(tokenRaw) {
  cleanupExpired();
  const token = String(tokenRaw || "").trim();
  if (!token) return null;
  if (revokedTokenHashes.has(tokenHash(token))) return null;

  const payload = parseTokenPayload(token, { verifySignature: true, verifyExpiry: true });
  if (!payload) return null;

  return {
    token,
    email: payload.email,
    userId: payload.userId,
    createdAt: typeof payload.iat === "number" ? payload.iat * 1000 : Date.now(),
    expiresAt: payload.exp * 1000,
  };
}

export function invalidateSession(tokenRaw) {
  cleanupExpired();
  const token = String(tokenRaw || "").trim();
  if (!token) return;
  const payload = parseTokenPayload(token, { verifySignature: true, verifyExpiry: false });
  const expiresAt = payload?.exp ? payload.exp * 1000 : Date.now() + config.sessionTtlSeconds * 1000;
  revokedTokenHashes.set(tokenHash(token), expiresAt);
}

export function sessionResponse(session) {
  return {
    token: session.token,
    email: session.email,
    user_id: session.userId,
    expires_at: new Date(session.expiresAt).toISOString(),
  };
}
