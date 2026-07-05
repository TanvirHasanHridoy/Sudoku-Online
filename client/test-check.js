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

async function test() {
  const nameToCheck = 'Just_Hridoy';
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", nameToCheck.trim());

  console.log('Query result for Just_Hridoy:');
  console.log('data:', data);
  console.log('error:', error);
}

test();
