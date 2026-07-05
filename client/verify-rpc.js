import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = "d:\\Projects\\ALL AI RELATED STUFFS\\AntiGravity\\Sudoku Remote\\Sudoku-Online\\client\\.env";
const envContent = fs.readFileSync(envPath, 'utf8');
const getEnvVar = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const realUuid = "ffebce18-18cd-49d3-bde8-070409d57e64";
  console.log("Calling increment_game_started RPC with real user ID:", realUuid);
  const { data, error } = await supabase.rpc('increment_game_started', {
    user_uuid: realUuid
  });

  if (error) {
    console.error("❌ RPC Error:", error.message);
    console.error("Error Code:", error.code);
  } else {
    console.log("✅ RPC Success! Data returned:", data);
  }
}

run();
