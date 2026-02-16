"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupabaseConfigured = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("./env");
// Supabase uses .supabase.co (not .supabase.com) – auto-fix common typo
let supabaseUrl = env_1.env.supabaseUrl || 'https://placeholder.supabase.co';
if (supabaseUrl.includes('.supabase.com')) {
    supabaseUrl = supabaseUrl.replace('.supabase.com', '.supabase.co');
}
const supabaseKey = env_1.env.supabaseServiceKey || 'placeholder-service-role-key';
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});
exports.isSupabaseConfigured = Boolean(env_1.env.supabaseUrl && env_1.env.supabaseServiceKey);
//# sourceMappingURL=supabase.js.map