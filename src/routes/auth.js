import { Router } from "express";
import { sbAdmin } from "../lib/supabase.js";
import { config } from "../lib/config.js";

export const authRouter = Router();

// Get current user info
authRouter.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  
  if (!token) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  try {
    const { data: { user }, error } = await sbAdmin.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    // Check if email is in allowed list (if configured)
    if (config.allowedEmails.length > 0) {
      const userEmail = (user.email || "").trim().toLowerCase();
      if (!config.allowedEmails.includes(userEmail)) {
        return res.status(403).json({ error: "Email not authorized" });
      }
    }

    res.json({
      user: {
        email: user.email,
        user_id: user.id,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('[auth/me] Error:', error);
    res.status(401).json({ error: "Invalid token" });
  }
});

// Logout endpoint (optional - mostly handled client-side)
authRouter.post("/auth/logout", (req, res) => {
  // With Supabase, logout is handled client-side
  res.json({ ok: true });
});
