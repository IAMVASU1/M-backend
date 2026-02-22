import { sbAdmin } from "../lib/supabase.js";
import { config } from "../lib/config.js";

export async function requireSession(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  
  if (!token) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  try {
    // Verify the Supabase JWT token
    const { data: { user }, error } = await sbAdmin.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    // Check if email is in allowed list (if configured)
    if (config.allowedEmails.length > 0) {
      const userEmail = (user.email || "").trim().toLowerCase();
      if (!config.allowedEmails.includes(userEmail)) {
        console.warn(`[requireSession] Unauthorized email attempted access: ${userEmail}`);
        return res.status(403).json({ error: "Email not authorized" });
      }
    }

    // Attach user info to request
    req.authToken = token;
    req.email = user.email;
    req.uid = user.id;
    req.user = user;
    req.sb = sbAdmin;
    
    next();
  } catch (error) {
    console.error('[requireSession] Error validating token:', error);
    return res.status(401).json({ error: "Invalid token" });
  }
}

