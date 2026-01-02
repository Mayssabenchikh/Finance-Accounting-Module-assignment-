import { beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Test configuration
export const SUPABASE_URL = process.env.SUPABASE_URL!;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

// Admin client for test setup (bypasses RLS)
export const adminClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// Helper to create test user
export async function createTestUser(email: string, password: string) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!;
}

// Helper to delete test user
export async function deleteTestUser(userId: string) {
  await adminClient.auth.admin.deleteUser(userId);
}

// Helper to create tenant
export async function createTestTenant(name: string) {
  const { data, error } = await adminClient
    .from("tenants")
    .insert({ name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Helper to join user to tenant
export async function joinUserToTenant(
  userId: string,
  tenantId: string,
  role: "read" | "write"
) {
  const { error } = await adminClient.from("tenant_users").insert({
    user_id: userId,
    tenant_id: tenantId,
    role,
  });
  if (error) throw error;
}

// Helper to get auth token for a user
export async function getAuthToken(email: string, password: string) {
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.session!.access_token;
}

// Cleanup function
export async function cleanupTestData(userIds: string[], tenantIds: string[]) {
  for (const userId of userIds) {
    try {
      await deleteTestUser(userId);
    } catch (err) {
      // Ignore cleanup errors
    }
  }
  for (const tenantId of tenantIds) {
    try {
      await adminClient.from("tenants").delete().eq("id", tenantId);
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

