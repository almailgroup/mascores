#!/usr/bin/env node

const https = require('https');

// Your Supabase details
const PROJECT_ID = 'ontmfbptthwipfzlywwh';
const VERCEL_URL = 'https://mascores.vercel.app';
const LOVABLE_URL = 'https://mascores.lovable.app';

// Get service role key from environment
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.error('\nTo get your service role key:');
  console.error('1. Go to https://supabase.com/dashboard');
  console.error('2. Select your project "ontmfbptthwipfzlywwh"');
  console.error('3. Settings → API → Service Role Key (copy it)');
  console.error('\nThen run:');
  console.error(`SUPABASE_SERVICE_ROLE_KEY="your_key_here" node scripts/setup-oauth.js`);
  process.exit(1);
}

const redirectUris = [
  VERCEL_URL,
  LOVABLE_URL,
  'http://localhost:3000',
  'http://localhost:5173',
];

const data = JSON.stringify({
  auth: {
    external: {
      google: {
        enabled: true,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        secret: process.env.GOOGLE_CLIENT_SECRET || '',
      },
      apple: {
        enabled: true,
        client_id: process.env.APPLE_CLIENT_ID || '',
        secret: process.env.APPLE_CLIENT_SECRET || '',
      },
    },
  },
});

console.log('🔄 Updating Supabase OAuth redirect URIs...');
console.log(`   Project: ${PROJECT_ID}`);
console.log(`   Adding redirect URIs:`);
redirectUris.forEach(uri => console.log(`   - ${uri}`));

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_ID}`,
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ OAuth redirect URIs updated successfully!');
      console.log('\n✨ Your site should now work with Google OAuth');
      console.log(`   Visit: ${VERCEL_URL}`);
    } else {
      console.error(`❌ Error: Status ${res.statusCode}`);
      console.error(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  process.exit(1);
});

req.write(data);
req.end();
