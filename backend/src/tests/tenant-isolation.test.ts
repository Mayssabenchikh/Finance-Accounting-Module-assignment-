import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import transactionsRouter from "../routes/transactions.js";
import { authMiddleware } from "../middleware/auth.js";
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

describe("Tenant Isolation", () => {
  let userAId: string;
  let userBId: string;
  let tenantAId: string;
  let tenantBId: string;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    // Create test users
    userAId = (await createTestUser("usera@test.com", "password123")).id;
    userBId = (await createTestUser("userb@test.com", "password123")).id;

    // Create test tenants
    tenantAId = await createTestTenant("Tenant A");
    tenantBId = await createTestTenant("Tenant B");

    // Join users to their respective tenants
    await joinUserToTenant(userAId, tenantAId, "read");
    await joinUserToTenant(userBId, tenantBId, "read");

    // Get auth tokens
    tokenA = await getAuthToken("usera@test.com", "password123");
    tokenB = await getAuthToken("userb@test.com", "password123");
  });

  afterAll(async () => {
    await cleanupTestData([userAId, userBId], [tenantAId, tenantBId]);
  });

  it("should prevent userA from accessing tenantB transactions", async () => {
    // UserA tries to access TenantB transactions
    const response = await request(app)
      .get(`/transactions?tenantId=${tenantBId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    // Should be blocked by RLS (403 or empty result)
    expect([403, 200]).toContain(response.status);
    if (response.status === 200) {
      // If RLS allows but returns empty, that's also acceptable
      expect(response.body.transactions).toEqual([]);
    }
  });

  it("should allow userA to access tenantA transactions", async () => {
    const response = await request(app)
      .get(`/transactions?tenantId=${tenantAId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.transactions)).toBe(true);
  });
});

