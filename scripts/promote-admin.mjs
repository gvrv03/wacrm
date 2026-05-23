/**
 * Promote a user to admin by email.
 *
 * Usage:
 *   node scripts/promote-admin.mjs your-email@example.com
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * in your .env.local (or as environment variables).
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/promote-admin.mjs <email>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  // Check if profile exists
  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, email, role')
    .eq('email', email)
    .maybeSingle();

  if (findError) {
    console.error('Error looking up profile:', findError.message);
    process.exit(1);
  }

  if (!profile) {
    console.error(`No profile found with email: ${email}`);
    console.error('Make sure the user has signed in at least once.');
    process.exit(1);
  }

  if (profile.role === 'admin') {
    console.log(`${email} is already an admin.`);
    process.exit(0);
  }

  // Promote to admin
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'admin', updated_at: new Date().toISOString() })
    .eq('email', email);

  if (updateError) {
    console.error('Failed to update role:', updateError.message);
    process.exit(1);
  }

  console.log(`✓ ${profile.full_name || email} has been promoted to admin.`);
  console.log(`  They can now access /admin`);
}

main();
