-- ============================================================
-- 014: Fix infinite recursion in admin RLS policies
--
-- Migration 013 introduced policies that query the `profiles` table
-- from within a policy ON the `profiles` table, causing PostgreSQL
-- error 42P17 (infinite recursion). 
--
-- Fix: Remove the recursive policies. Admin access to all data is
-- handled via the service-role key in API routes (bypasses RLS).
-- Regular users only need to see their own data (original policies).
-- ============================================================

-- Remove the recursive policies from 013
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all contacts" ON contacts;

-- Restore the simple original policies (idempotent)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
