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
  const email = 'sudoku.guest.test.464659@gmail.com';
  const password = 'Password123!';
  console.log(`Trying to sign in with email=${email}`);
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('❌ Sign in failed:', error.message);
      console.error(error);
    } else {
      console.log('✅ Sign in succeeded!');
      console.log('User ID:', data.user?.id);
      console.log('Session exists:', !!data.session);
    }
  } catch (err) {
    console.error('❌ Error caught:', err);
  }
}

runTest();
