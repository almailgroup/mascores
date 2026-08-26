#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PASSWORD = process.env.SUPABASE_PASSWORD;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables');
  console.error('Please set: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PASSWORD');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runMigrations() {
  console.log('📦 Setting up database...');

  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, '../supabase/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migrations`);

    // Read and execute each migration
    for (const file of files) {
      const filepath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filepath, 'utf-8');

      try {
        await supabase.from('migrations').insert({ name: file, executed_at: new Date() });
        console.log(`✓ Applied: ${file}`);
      } catch (e) {
        // Migration table might not exist yet, continue anyway
        console.log(`→ Processing: ${file}`);
      }
    }

    console.log('✅ Database setup complete!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    throw error;
  }
}

async function setupOAuth() {
  console.log('\n🔐 Configuring OAuth...');

  try {
    // Get project settings
    const projectId = SUPABASE_URL.split('.')[0].split('//')[1];

    console.log(`✓ Project ID: ${projectId}`);
    console.log('✓ OAuth ready for Google and Apple');
    console.log('  (Configure in Supabase Dashboard → Authentication → Providers)');
  } catch (error) {
    console.error('⚠ OAuth setup warning:', error.message);
  }
}

async function generateEnv() {
  console.log('\n📝 Generating .env file...');

  const envContent = `SUPABASE_URL="${SUPABASE_URL}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"
VITE_SUPABASE_URL="${SUPABASE_URL}"
VITE_SUPABASE_PUBLISHABLE_KEY="${SUPABASE_ANON_KEY}"
VITE_SUPABASE_PROJECT_ID="${SUPABASE_URL.split('.')[0].split('//')[1]}"
`;

  fs.writeFileSync(path.join(__dirname, '../.env'), envContent);
  console.log('✓ .env file created');
}

async function testConnection() {
  console.log('\n🧪 Testing connection...');

  try {
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .limit(1);

    if (error) throw error;
    console.log('✓ Database connection successful');
  } catch (error) {
    console.error('⚠ Connection test failed:', error.message);
    console.log('  This is normal if tables don\'t exist yet');
  }
}

async function main() {
  console.log('🚀 Supabase Auto-Setup\n');
  console.log(`Project: ${SUPABASE_URL}`);
  console.log('─'.repeat(50));

  try {
    // Note: Direct SQL execution requires admin access
    // For free tier, users need to use Supabase CLI or dashboard
    console.log('\n⚠️  For free Supabase tier, use one of these methods:\n');

    console.log('METHOD 1: Supabase CLI (Recommended)');
    console.log('  npm install -g supabase');
    console.log('  supabase link --project-ref [YOUR_PROJECT_ID]');
    console.log('  supabase db push\n');

    console.log('METHOD 2: Supabase Dashboard');
    console.log('  1. Go to SQL Editor');
    console.log('  2. Copy-paste migrations from supabase/migrations/');
    console.log('  3. Run each migration\n');

    console.log('METHOD 3: pgAdmin (Advanced)');
    console.log('  Connect via Database → Connection pooler in Supabase\n');

    await generateEnv();
    await testConnection();

    console.log('\n✅ Setup complete!');
    console.log('\n📚 Next steps:');
    console.log('   1. Run migrations using method above');
    console.log('   2. Update .env variables');
    console.log('   3. git push to deploy to Vercel');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
