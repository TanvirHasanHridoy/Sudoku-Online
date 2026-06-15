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
  console.log('Querying tables...');
  const { data, error } = await supabase.rpc('get_tables'); // Or try querying some system tables if allowed
  if (error) {
    console.warn('RPC get_tables failed, attempting direct schema query...', error.message);
    
    // Direct query via profiles just to see if we can do something else,
    // actually, let's try querying postgrest/swagger or another table if we can guess.
    // Let's try some common table names: 'guests', 'guest_profiles', 'rooms', 'games'
    const tables = ['profiles', 'friendships', 'guests', 'guest_profiles', 'rooms', 'games', 'settings'];
    for (const t of tables) {
      const { data: checkData, error: checkError } = await supabase.from(t).select('*').limit(1);
      if (checkError) {
        console.log(`❌ Table '${t}' does not exist or error:`, checkError.message);
      } else {
        console.log(`✅ Table '${t}' exists! Data snippet:`, checkData);
      }
    }
  } else {
    console.log('Tables:', data);
  }
}

runTest();
