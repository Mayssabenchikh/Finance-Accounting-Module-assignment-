import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /summary?tenantId=...
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

    // Fetch all transactions for the tenant - RLS will enforce tenant isolation
    const { data, error } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("tenant_id", tenantId);

    if (error) {
      console.error("Supabase error in GET /summary:", error);
      const statusCode = error.code === "42501" || error.message.includes("permission") ? 403 : 400;
      return res.status(statusCode).json({ 
        error: error.message || "Failed to fetch summary",
        code: error.code 
      });
    }

    // Calculate totals
    let totalIncome = 0;
    let totalExpense = 0;

    (data || []).forEach((transaction) => {
      if (transaction.type === "income") {
        totalIncome += Number(transaction.amount);
      } else {
        totalExpense += Number(transaction.amount);
      }
    });

    const balance = totalIncome - totalExpense;

    return res.json({
      totalIncome,
      totalExpense,
      balance,
    });
  } catch (error: any) {
    console.error("Error in GET /summary:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

export default router;

