import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import transactionsRouter from "../routes/transactions.js";
import {
  createTestUser,
  deleteTestUser,
  createTestTenant,
  joinUserToTenant,
  getAuthToken,
  cleanupTestData,
} from "./setup.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/transactions", transactionsRouter);

describe("Unauthorized Write", () => {
  let userId: string;
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    // Create test user
    userId = (await createTestUser("readonly@test.com", "password123")).id;

    // Create test tenant
    tenantId = await createTestTenant("Read Only Tenant");

    // Join user with read-only role
    await joinUserToTenant(userId, tenantId, "read");

    // Get auth token
    token = await getAuthToken("readonly@test.com", "password123");
  });

  afterAll(async () => {
    await cleanupTestData([userId], [tenantId]);
  });

  it("should prevent read-only user from creating transactions", async () => {
    const response = await request(app)
      .post("/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tenantId,
        type: "income",
        amount: 100.0,
        description: "Test transaction",
        category: "Salary",
        date: "2024-01-15",
      });

    // Should be blocked by RLS (403)
    expect(response.status).toBe(403);
    expect(response.body.error).toBeDefined();
  });
});

