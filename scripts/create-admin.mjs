/**
 * Create a new admin user from scratch.
 *
 * Usage:
 *   node scripts/create-admin.mjs email@example.com password123 "Full Name"
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * in your .env.local (or as environment variables).
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const [email, password, fullName] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> [full_name]');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/create-admin.mjs admin@example.com MySecurePass123 "John Admin"');
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
  const name = fullName || email.split('@')[0];

  console.log(`Creating admin user: ${email}`);

  // 1. Create the auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authError) {
    console.error('Failed to create auth user:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`  Auth user created: ${userId}`);

  // 2. Create or update the profile with admin role
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      full_name: name,
      email,
      role: 'admin',
    },
    { onConflict: 'user_id' }
  );

  if (profileError) {
    console.error('Failed to create profile:', profileError.message);
    // Try to clean up the auth user
    await supabase.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  console.log('');
  console.log('✓ Admin user created successfully!');
  console.log(`  Email:    ${email}`);
  console.log(`  Name:     ${name}`);
  console.log(`  Role:     admin`);
  console.log(`  User ID:  ${userId}`);
  console.log('');
  console.log('  They can now sign in and access /admin');
}

main();
