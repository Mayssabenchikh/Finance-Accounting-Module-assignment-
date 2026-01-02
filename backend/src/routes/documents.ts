import { Router, Response } from "express";
import { z } from "zod";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// Validation schemas
const createDocumentSchema = z.object({
  transactionId: z.string().uuid(),
  fileUrl: z.string()
    .url("File URL must be a valid URL (http:// or https://)")
    .min(1)
    .refine(
      (url) => !url.startsWith("file://"),
      "Local file URLs (file://) are not allowed. Please use an HTTP or HTTPS URL."
    )
    .refine(
      (url) => url.startsWith("http://") || url.startsWith("https://"),
      "URL must start with http:// or https://"
    ),
});

// POST /documents
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const validation = createDocumentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid input", 
        details: validation.error.errors 
      });
    }

    const { transactionId, fileUrl } = validation.data;
    const supabase = req.supabaseClient!;

    // Insert document - RLS will enforce tenant isolation and role permissions
    const { data, error } = await supabase
      .from("documents")
      .insert({
        transaction_id: transactionId,
        file_url: fileUrl,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase error in POST /documents:", error);
      const statusCode = error.code === "42501" || error.message.includes("permission") ? 403 : 400;
      return res.status(statusCode).json({ 
        error: error.message || "Failed to create document",
        code: error.code 
      });
    }

    return res.status(201).json({ id: data.id });
  } catch (error: any) {
    console.error("Error in POST /documents:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

// GET /documents?transactionId=...
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const transactionId = req.query.transactionId as string;
    
    if (!transactionId || typeof transactionId !== "string") {
      return res.status(400).json({ error: "transactionId query parameter is required" });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(transactionId)) {
      return res.status(400).json({ error: "Invalid transactionId format" });
    }

    const supabase = req.supabaseClient!;

    // Query documents - RLS will enforce tenant isolation
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error in GET /documents:", error);
      const statusCode = error.code === "42501" || error.message.includes("permission") ? 403 : 400;
      return res.status(statusCode).json({ 
        error: error.message || "Failed to fetch documents",
        code: error.code 
      });
    }

    return res.json({ documents: data || [] });
  } catch (error: any) {
    console.error("Error in GET /documents:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

export default router;

