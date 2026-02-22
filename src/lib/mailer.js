import { Resend } from "resend";
import { config } from "./config.js";

function assertMailerConfig() {
  if (!config.resendApiKey) {
    const err = new Error("Resend is not configured. Set RESEND_API_KEY environment variable.");
    err.status = 500;
    throw err;
  }
}

function createResendClient() {
  assertMailerConfig();
  return new Resend(config.resendApiKey);
}

export async function sendOtpEmail({ to, code }) {
  console.log(`[mailer] Attempting to send OTP email to: ${to}`);
  console.log(`[mailer] Resend Config: from=${config.resendFromEmail}`);
  
  const resend = createResendClient();
  
  try {
    const data = await resend.emails.send({
      from: config.resendFromEmail,
      to,
      subject: "Your Gallery login code",
      html: `
        <h2>Your Gallery login code</h2>
        <p>Use this 6-digit code in the app:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
        <p>This code expires in ${Math.floor(config.otpTtlSeconds / 60)} minutes.</p>
      `,
    });
    console.log(`[mailer] Email sent successfully. ID: ${data.id}`);
    return { messageId: data.id, accepted: [to] };
  } catch (error) {
    console.error(`[mailer] Failed to send email:`, error.message);
    console.error(`[mailer] Error details:`, error);
    throw error;
  }
}
