import { Router, Response } from "express";
import { z } from "zod";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// Validation schemas
const createTransactionSchema = z.object({
  tenantId: z.string().uuid(),
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().min(1), // Category is required
});

// POST /transactions
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const validation = createTransactionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid input", 
        details: validation.error.errors 
      });
    }

    const { tenantId, type, amount, description, date, category } = validation.data;
    const supabase = req.supabaseClient!;
    const userId = req.userId!;

    // Insert transaction - RLS will enforce tenant isolation and role permissions
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        tenant_id: tenantId,
        type,
        amount,
        description,
        date,
        category,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      // RLS/permission errors typically return 403 or 400
      const statusCode = error.code === "42501" || error.message.includes("permission") ? 403 : 400;
      return res.status(statusCode).json({ 
        error: error.message || "Failed to create transaction" 
      });
    }

    return res.status(201).json({ id: data.id });
  } catch (error: any) {
    console.error("Error in POST /transactions:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

// GET /transactions?tenantId=...
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    if (!tenantId || typeof tenantId !== "string") {
      return res.status(400).json({ error: "tenantId query parameter is required" });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenantId format" });
    }

    const supabase = req.supabaseClient!;

    // Query transactions - RLS will enforce tenant isolation
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error in GET /transactions:", error);
      const statusCode = error.code === "42501" || error.message.includes("permission") ? 403 : 400;
      return res.status(statusCode).json({ 
        error: error.message || "Failed to fetch transactions",
        code: error.code 
      });
    }

    return res.json({ transactions: data || [] });
  } catch (error: any) {
    console.error("Error in GET /transactions:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

export default router;

