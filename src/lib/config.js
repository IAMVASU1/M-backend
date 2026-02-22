import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 4000),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  allowedEmails: (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean),
  signedUrlExpires: Number(process.env.SIGNED_URL_EXPIRES_SECONDS || 3600),
  bucket: process.env.BUCKET_NAME || "gallery",
  authSecret: process.env.AUTH_SECRET || "dev-auth-secret-change-me",
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS || 600),
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 30),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpSecure: String(process.env.SMTP_SECURE || "true").toLowerCase() !== "false",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "",
};

// if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
//   throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
// }
console.log("TEST_VAR", process.env.TEST_VAR);

console.log("ENV check:", {
  SUPABASE_URL: process.env.SUPABASE_URL,
  HAS_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME,
  ENV_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
});

if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
  // temporarily log all available environment variable names to see what Railway passed
  console.log("Available environment variables in Railway:", Object.keys(process.env));
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
}
