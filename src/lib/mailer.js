import nodemailer from "nodemailer";
import { config } from "./config.js";

function assertMailerConfig() {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass || !config.smtpFrom) {
    const err = new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM.");
    err.status = 500;
    throw err;
  }
}

function createTransporter() {
  assertMailerConfig();
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
}

export async function sendOtpEmail({ to, code }) {
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: config.smtpFrom,
    to,
    subject: "Your Blush login code",
    text: `Your login code is ${code}. It expires in ${Math.floor(config.otpTtlSeconds / 60)} minutes.`,
    html: `
      <h2>Your Blush login code</h2>
      <p>Use this 6-digit code in the app:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
      <p>This code expires in ${Math.floor(config.otpTtlSeconds / 60)} minutes.</p>
    `,
  });
  return info;
}
