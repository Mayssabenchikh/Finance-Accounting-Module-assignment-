import { Request, Response, NextFunction } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Read environment variables at runtime, not at module load time
function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.error("Missing Supabase environment variables:");
    console.error("SUPABASE_URL:", url ? "✓ set" : "✗ missing");
    console.error("SUPABASE_ANON_KEY:", key ? "✓ set" : "✗ missing");
    return null;
  }
  
  return { url, key };
}

export interface AuthRequest extends Request {
  userId?: string;
  supabaseClient?: SupabaseClient<any>;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.substring(7);
    
    if (!token || token.trim() === "") {
      return res.status(401).json({ error: "Empty token" });
    }

    // Get Supabase configuration
    const config = getSupabaseConfig();
    if (!config) {
      return res.status(500).json({ error: "Server configuration error: Missing Supabase environment variables" });
    }
    
    // Verify the token first with a temporary client
    const tempClient = createClient(config.url, config.key);
    const { data: { user }, error: authError } = await tempClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Token verification error:", authError?.message);
      return res.status(401).json({ 
        error: "Invalid or expired token",
        details: authError?.message 
      });
    }

    // Create Supabase client with the JWT token for database queries
    // Using headers is the recommended approach for API usage
    // This ensures RLS policies apply correctly based on the token
    const supabase = createClient(config.url, config.key, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    req.userId = user.id;
    req.supabaseClient = supabase;
    
    next();
  } catch (error: any) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ 
      error: "Authentication failed",
      details: error.message 
    });
  }
}

