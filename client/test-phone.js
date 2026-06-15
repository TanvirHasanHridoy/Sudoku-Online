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
  const phone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
  const password = 'Password123!';
  console.log(`Trying to sign up user with phone=${phone}`);
  
  try {
    const { data, error } = await supabase.auth.signUp({
      phone,
      password,
    });

    if (error) {
      console.error('❌ Sign up failed:', error.message);
      console.error(error);
    } else {
      console.log('✅ Sign up succeeded!', data);
    }
  } catch (err) {
    console.error('❌ Error caught:', err);
  }
}

runTest();
