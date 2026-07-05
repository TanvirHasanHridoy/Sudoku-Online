/* eslint-disable no-undef */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found. Run this from client folder.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const getEnvVar = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not found in .env');
  process.exit(1);
}

console.log('Connecting to Supabase at:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  console.log('\n--- 1. Testing Connection & Profiles ---');
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (profileErr) {
    console.error('❌ Failed to fetch profiles:', profileErr.message);
  } else {
    console.log(`✅ Profiles fetched successfully (${profiles.length} found):`);
    console.table(profiles.map(p => ({
      id: p.id,
      display_name: p.display_name,
      elo: p.elo,
      rank: p.rank
    })));
  }

  console.log('\n--- 2. Testing Friendships ---');
  const { data: friendships, error: friendErr } = await supabase
    .from('friendships')
    .select('*')
    .limit(5);

  if (friendErr) {
    console.error('❌ Failed to fetch friendships:', friendErr.message);
  } else {
    console.log(`✅ Friendships fetched successfully (${friendships.length} found):`);
    console.table(friendships);
  }
}

runTest();
