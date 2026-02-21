import { getSessionByToken } from "../lib/authStore.js";
import { sbAdmin } from "../lib/supabase.js";

export function requireSession(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Missing Bearer token" });

  const session = getSessionByToken(token);
  if (!session) return res.status(401).json({ error: "Invalid or expired session" });

  req.authToken = token;
  req.email = session.email;
  req.uid = session.userId;
  req.session = session;
  req.sb = sbAdmin;
  next();
}

