import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const getEnvVar = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  console.log('Fetching functions from PostgREST openapi spec...');
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`);
    const spec = await res.json();
    console.log('Paths defined in REST API:');
    const paths = Object.keys(spec.paths || {});
    const rpcs = paths.filter(p => p.startsWith('/rpc/'));
    console.log('RPC functions found:', rpcs);
    for (const rpc of rpcs) {
      console.log(`RPC ${rpc}:`, spec.paths[rpc]);
    }
  } catch (err) {
    console.error('❌ Failed to fetch openapi spec:', err);
  }
}

runTest();
