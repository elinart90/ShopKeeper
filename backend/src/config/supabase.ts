import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Supabase uses .supabase.co (not .supabase.com) – auto-fix common typo
let supabaseUrl = env.supabaseUrl || 'https://placeholder.supabase.co';
if (supabaseUrl.includes('.supabase.com')) {
  supabaseUrl = supabaseUrl.replace('.supabase.com', '.supabase.co');
}
const supabaseKey = env.supabaseServiceKey || 'placeholder-service-role-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseServiceKey);
