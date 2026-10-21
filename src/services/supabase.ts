import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || (typeof process !== 'undefined' && process.env) || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://pyiljwilbxgkrkynmejg.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ROZJCtV4t4jTVMG3nYs0Hg_OYK-WBFc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
