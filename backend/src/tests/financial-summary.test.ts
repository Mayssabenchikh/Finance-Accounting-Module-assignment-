import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import transactionsRouter from "../routes/transactions.js";
import summaryRouter from "../routes/summary.js";
import {
  createTestUser,
  deleteTestUser,
  createTestTenant,
  joinUserToTenant,
  getAuthToken,
  cleanupTestData,
  adminClient,
} from "./setup.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/transactions", transactionsRouter);
app.use("/summary", summaryRouter);

describe("Financial Summary", () => {
  let userId: string;
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    // Create test user
    userId = (await createTestUser("writer@test.com", "password123")).id;

    // Create test tenant
    tenantId = await createTestTenant("Summary Test Tenant");

    // Join user with write role
    await joinUserToTenant(userId, tenantId, "write");

    // Get auth token
    token = await getAuthToken("writer@test.com", "password123");

    // Create test transactions using admin client to bypass RLS for setup
    await adminClient.from("transactions").insert([
      {
        tenant_id: tenantId,
        type: "income",
        amount: 1000.0,
        description: "Test Income 1",
        category: "Salary",
        date: "2024-01-15",
        created_by: userId,
      },
      {
        tenant_id: tenantId,
        type: "income",
        amount: 500.0,
        description: "Test Income 2",
        category: "Freelance",
        date: "2024-01-16",
        created_by: userId,
      },
      {
        tenant_id: tenantId,
        type: "expense",
        amount: 200.0,
        description: "Test Expense 1",
        category: "Food",
        date: "2024-01-17",
        created_by: userId,
      },
      {
        tenant_id: tenantId,
        type: "expense",
        amount: 300.0,
        description: "Test Expense 2",
        category: "Transport",
        date: "2024-01-18",
        created_by: userId,
      },
    ]);
  });

  afterAll(async () => {
    // Clean up transactions
    await adminClient.from("transactions").delete().eq("tenant_id", tenantId);
    await cleanupTestData([userId], [tenantId]);
  });

  it("should calculate correct financial summary", async () => {
    const response = await request(app)
      .get(`/summary?tenantId=${tenantId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("totalIncome");
    expect(response.body).toHaveProperty("totalExpense");
    expect(response.body).toHaveProperty("balance");

    // Expected: income = 1000 + 500 = 1500, expense = 200 + 300 = 500, balance = 1000
    expect(response.body.totalIncome).toBe(1500.0);
    expect(response.body.totalExpense).toBe(500.0);
    expect(response.body.balance).toBe(1000.0);
  });
});

