import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://zhsveazonqrutegeedvn.supabase.co";
const supabaseAnonKey = "REDACTED_SUPABASE_ANON_KEY";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Get all profiles (no RLS on profiles table for anon reads)
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, display_name, elo, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (pErr) {
    console.error("Error fetching profiles:", pErr.message);
  } else {
    console.log("\n=== RECENT PROFILES (last 20) ===");
    profiles.forEach(p => {
      console.log(`  ${p.display_name.padEnd(20)} | ${p.id} | created: ${p.created_at}`);
    });
  }

  // Try to get friendships (will likely be blocked by RLS with anon key)
  const { data: friendships, error: fErr } = await supabase
    .from('friendships')
    .select('*');

  if (fErr) {
    console.log("\n=== FRIENDSHIPS ===");
    console.log("  (RLS blocks anon access — expected)");
    console.log("  Error:", fErr.message);
  } else {
    console.log("\n=== FRIENDSHIPS ===");
    if (!friendships || friendships.length === 0) {
      console.log("  No friendships found (or RLS returned empty)");
    } else {
      friendships.forEach(f => {
        console.log(`  user_id: ${f.user_id} | friend_id: ${f.friend_id} | status: ${f.status}`);
      });
    }
  }
}

run();
