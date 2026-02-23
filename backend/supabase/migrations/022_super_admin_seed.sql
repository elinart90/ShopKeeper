-- Seed first platform super admin (safe + idempotent)
-- Update the email below before running in production.

DO $$
DECLARE
  v_seed_email TEXT := 'admin@shopkeeper.local';
  v_user_id UUID;
BEGIN
  SELECT u.id
  INTO v_user_id
  FROM public.users u
  WHERE LOWER(u.email) = LOWER(v_seed_email)
  LIMIT 1;

  -- No-op if the target user does not exist yet.
  IF v_user_id IS NULL THEN
    RAISE NOTICE '022_super_admin_seed: user not found for email %, skipping seed.', v_seed_email;
    RETURN;
  END IF;

  INSERT INTO public.platform_admins (user_id, role, is_active)
  VALUES (v_user_id, 'super_admin', true)
  ON CONFLICT (user_id) DO UPDATE
  SET
    role = EXCLUDED.role,
    is_active = true;
END $$;
