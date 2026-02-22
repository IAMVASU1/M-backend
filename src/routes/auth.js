import { Router } from "express";
import { z } from "zod";
import {
  createOtpForEmail,
  getSessionByToken,
  invalidateSession,
  sessionResponse,
  verifyOtpAndCreateSession,
} from "../lib/authStore.js";
import { sendOtpEmail } from "../lib/mailer.js";

export const authRouter = Router();

authRouter.post("/auth/request-otp", async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    console.log(`[auth] OTP requested for email: ${body.email}`);
    const otp = createOtpForEmail(body.email);
    console.log(`[auth] OTP created, attempting to send email...`);
    const mailInfo = await sendOtpEmail({ to: otp.email, code: otp.code });
    const sentTo = Array.isArray(mailInfo?.accepted) && mailInfo.accepted.length
      ? String(mailInfo.accepted[0]).toLowerCase()
      : otp.email;
    console.info(`[auth] OTP requested=${otp.email} mail_sent_to=${sentTo}`);
    res.json({
      ok: true,
      email: otp.email,
      sent_to: sentTo,
      expires_at: new Date(otp.expiresAt).toISOString(),
    });
  } catch (e) {
    console.error(`[auth] Error in request-otp:`, e.message);
    next(e);
  }
});

authRouter.post("/auth/verify-otp", async (req, res, next) => {
  try {
    const body = z.object({
      email: z.string().email(),
      code: z.string().regex(/^\d{6}$/),
    }).parse(req.body);

    const session = verifyOtpAndCreateSession(body.email, body.code);
    res.json({ session: sessionResponse(session) });
  } catch (e) {
    next(e);
  }
});

authRouter.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing Bearer token" });
  const session = getSessionByToken(token);
  if (!session) return res.status(401).json({ error: "Invalid or expired session" });

  res.json({
    user: {
      email: session.email,
      user_id: session.userId,
      expires_at: new Date(session.expiresAt).toISOString(),
    },
  });
});

authRouter.post("/auth/logout", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.json({ ok: true });
  invalidateSession(token);
  res.json({ ok: true });
});
