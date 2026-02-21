import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const sbAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

