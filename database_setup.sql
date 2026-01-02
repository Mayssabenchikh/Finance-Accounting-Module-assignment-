-- Complete Database Setup Script
-- Run this in your Supabase SQL Editor to set up the entire database schema
-- This script includes: tables, RLS policies, helper functions, and the create_tenant_and_join function

-- ============================================
-- Step 1: Create ENUM types
-- ============================================

-- Drop types if they exist (for clean reinstall)
DROP TYPE IF EXISTS public.tx_type CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- Create ENUM types
CREATE TYPE public.tx_type AS ENUM ('income', 'expense');
CREATE TYPE public.user_role AS ENUM ('read', 'write');

-- ============================================
-- Step 2: Create tables
-- ============================================

-- Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

-- Tenant users (membership + roles)
CREATE TABLE IF NOT EXISTS public.tenant_users (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'read',
  PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_users_user_idx ON public.tenant_users(user_id);

-- Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  description text,
  category text NOT NULL,
  date date NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_tenant_date_idx ON public.transactions(tenant_id, date);

-- Documents table (optional)
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_transaction_idx ON public.documents(transaction_id);

-- ============================================
-- Step 3: Enable Row Level Security
-- ============================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 4: Create helper functions (to avoid RLS recursion)
-- ============================================

-- Helper function: Check if user is a member of a tenant
CREATE OR REPLACE FUNCTION public.user_is_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_is_tenant_member(uuid) TO authenticated;

-- Helper function: Check if user has write role
CREATE OR REPLACE FUNCTION public.user_has_write_role(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_users
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND role = 'write'
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_write_role(uuid) TO authenticated;

-- ============================================
-- Step 5: Create RLS policies for tenants
-- ============================================

DROP POLICY IF EXISTS "tenants: select for members" ON public.tenants;
CREATE POLICY "tenants: select for members"
ON public.tenants
FOR SELECT
USING (public.user_is_tenant_member(id));

-- ============================================
-- Step 6: Create RLS policies for tenant_users
-- ============================================

DROP POLICY IF EXISTS "tenant_users: select for members" ON public.tenant_users;

-- Users can see their own entries in tenant_users (to know their role)
CREATE POLICY "tenant_users: select for members"
ON public.tenant_users
FOR SELECT
USING (user_id = auth.uid());

-- ============================================
-- Step 7: Create RLS policies for transactions
-- ============================================

DROP POLICY IF EXISTS "transactions: select for members" ON public.transactions;
DROP POLICY IF EXISTS "transactions: insert for writers" ON public.transactions;

CREATE POLICY "transactions: select for members"
ON public.transactions
FOR SELECT
USING (public.user_is_tenant_member(tenant_id));

CREATE POLICY "transactions: insert for writers"
ON public.transactions
FOR INSERT
WITH CHECK (public.user_has_write_role(tenant_id));

-- ============================================
-- Step 8: Create RLS policies for documents
-- ============================================

DROP POLICY IF EXISTS "documents: select for members" ON public.documents;
DROP POLICY IF EXISTS "documents: insert for writers" ON public.documents;

-- Users can view documents for transactions they have access to
CREATE POLICY "documents: select for members"
ON public.documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = documents.transaction_id
      AND public.user_is_tenant_member(t.tenant_id)
  )
);

-- Users with write role can add documents to transactions
CREATE POLICY "documents: insert for writers"
ON public.documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = documents.transaction_id
      AND public.user_has_write_role(t.tenant_id)
  )
);

-- ============================================
-- Step 9: Create tenant creation function
-- ============================================

CREATE OR REPLACE FUNCTION public.create_tenant_and_join(tenant_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Insert new tenant
  INSERT INTO public.tenants (name)
  VALUES (tenant_name)
  RETURNING id INTO new_tenant_id;

  -- Join the user to the tenant with 'write' role
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (new_tenant_id, current_user_id, 'write')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  RETURN new_tenant_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_tenant_and_join(text) TO authenticated;

