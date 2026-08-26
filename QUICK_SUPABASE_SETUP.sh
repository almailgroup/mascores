#!/bin/bash

echo "🚀 Mascores Supabase Auto-Setup"
echo "=================================="
echo ""
echo "This will create and configure your own Supabase project."
echo ""

# Step 1: Create Supabase project
echo "Step 1: Create a Supabase Project"
echo "---------------------------------"
echo "1. Go to: https://supabase.com/dashboard"
echo "2. Click 'New Project'"
echo "3. Name: mascores"
echo "4. Set a password (save it)"
echo "5. Wait for it to initialize (~2 minutes)"
echo ""
echo "Once created, continue below..."
echo ""

# Step 2: Get credentials
echo "Step 2: Get Your Credentials"
echo "----------------------------"
echo "From your Supabase project:"
echo "  1. Settings → API"
echo "  2. Copy 'Project URL' and paste below"
read -p "Enter Project URL: " PROJECT_URL

echo ""
echo "  3. Copy 'anon public' key and paste below"
read -p "Enter Anon Key: " ANON_KEY

echo ""
echo "Now install Supabase CLI..."
echo ""

# Step 3: Install Supabase CLI
if ! command -v supabase &> /dev/null; then
  echo "⬇️  Installing Supabase CLI..."
  npm install -g supabase
fi

# Step 4: Link project
PROJECT_ID=$(echo $PROJECT_URL | grep -oP '(?<=https://)\w+' | head -1)

echo ""
echo "⏳ Linking to your Supabase project..."
supabase link --project-ref $PROJECT_ID

# Step 5: Push migrations
echo ""
echo "📦 Applying database migrations..."
supabase db push

# Step 6: Update .env
echo ""
echo "📝 Updating .env file..."
cat > .env << EOF
SUPABASE_PROJECT_ID="$PROJECT_ID"
SUPABASE_URL="$PROJECT_URL"
SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
VITE_SUPABASE_URL="$PROJECT_URL"
VITE_SUPABASE_PROJECT_ID="$PROJECT_ID"
VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
EOF

# Step 7: Setup OAuth
echo ""
echo "🔐 Setting up OAuth..."
echo ""
echo "To enable Google and Apple login:"
echo "  1. Go to: https://supabase.com/dashboard"
echo "  2. Select your 'mascores' project"
echo "  3. Authentication → Providers → Google"
echo "     - Add your Google OAuth credentials"
echo "  4. Authentication → Providers → Apple"
echo "     - Add your Apple OAuth credentials"
echo ""
echo "Redirect URIs to add:"
echo "  - https://mascores.vercel.app"
echo "  - http://localhost:5173"
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. npm run dev (test locally)"
echo "  2. git push (deploy to Vercel)"
echo ""
