import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import transactionsRouter from "./routes/transactions.js";
import summaryRouter from "./routes/summary.js";
import documentsRouter from "./routes/documents.js";

dotenv.config();

const app = express();

// CORS configuration - allow frontend origin
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// API routes
app.use("/transactions", transactionsRouter);
app.use("/summary", summaryRouter);
app.use("/documents", documentsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
