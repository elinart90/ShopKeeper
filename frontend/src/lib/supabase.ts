import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase client for Realtime subscriptions only.
 * Will be `null` if VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.
 *
 * IMPORTANT — Supabase RLS requirements:
 *   The anon role must have SELECT access on `sales` and `products` tables
 *   (filtered by `shop_id`) for postgres_changes to fire.
 *   In Supabase Dashboard → Authentication → Policies, ensure anon SELECT
 *   policies exist, or disable RLS on these two tables for development.
 *
 *   If you use a custom JWT_SECRET in the backend, configure it in:
 *   Supabase Dashboard → Settings → Auth → JWT Settings → Custom JWT secret
 *   so `supabase.realtime.setAuth(token)` is accepted.
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      })
    : null;

/** True when Realtime env vars are configured. */
export const isRealtimeEnabled = Boolean(supabase);
