-- ============================================================
-- 013: Admin role support
--
-- Adds:
-- 1. An RLS policy so admins can read ALL profiles (needed for
--    the admin dashboard user list).
-- 2. An RLS policy so admins can read ALL contacts.
-- 3. A helper function to promote a user to admin by email.
-- ============================================================

-- Allow admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Allow admins to update any profile (e.g. change roles)
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Allow admins to view all contacts
DROP POLICY IF EXISTS "Admins can view all contacts" ON contacts;
CREATE POLICY "Admins can view all contacts" ON contacts
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- Function: promote_to_admin(target_email TEXT)
--
-- Promotes a user to admin role by their email address.
-- Must be called with service_role or by an existing admin.
--
-- Usage (from Supabase SQL editor or psql):
--   SELECT promote_to_admin('your-email@example.com');
-- ============================================================
CREATE OR REPLACE FUNCTION promote_to_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_rows INT;
BEGIN
  UPDATE profiles
  SET role = 'admin', updated_at = NOW()
  WHERE email = target_email;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RETURN 'No profile found with email: ' || target_email;
  END IF;

  RETURN 'Success: ' || target_email || ' is now an admin';
END;
$$;

-- Restrict function execution to service_role (or superuser)
REVOKE ALL ON FUNCTION promote_to_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION promote_to_admin(TEXT) FROM authenticated;
