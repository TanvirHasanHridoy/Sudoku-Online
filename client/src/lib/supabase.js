import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Clear, actionable runtime warning to help diagnose production builds
  // Common cause: environment variables not provided at build time (Vite)
  // Fix: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your
  // hosting provider's build environment or create an appropriate .env
  // before running `npm run build`.
  console.warn(
    '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Supabase client will be disabled.\n' +
      'If you expect authentication to work in production, set these env variables at build time.'
  );
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        // Override lock to prevent gotrue-js lock manager deadlocks in browser environments
        lock: async (name, acquireTimeout, fn) => fn(),
      },
    })
  : null;
