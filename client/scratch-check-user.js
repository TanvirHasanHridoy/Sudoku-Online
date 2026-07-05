import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://zhsveazonqrutegeedvn.supabase.co";
const supabaseAnonKey = "REDACTED_SUPABASE_ANON_KEY";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const targetId = "8ce1746e-bebd-4366-9020-a1e580a192ec";
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetId)
    .single();

  if (error) {
    console.error("Error fetching target profile:", error);
    return;
  }

  console.log("Profile details for ID:", targetId);
  console.log(data);
}

run();
