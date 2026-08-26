# Create Your Own Supabase Project (Automated)

This guide will help you create a fresh, fully-configured Supabase project with all your data and OAuth setup - **no manual configuration needed**.

## Step 1: Sign Up for Supabase (Free)
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (or email)
4. Create a new organization

## Step 2: Create a New Project
1. Click "New Project"
2. Name it: `mascores`
3. Choose a password (save it)
4. Region: Choose closest to you
5. Click "Create new project"
6. Wait for database to initialize (~2 min)

## Step 3: Run Auto-Setup
Once your project is created:

1. Go to **Settings → API** and copy:
   - `Project URL`
   - `Anon key` (public)
   
2. Go to **Settings → Database → Connection Info** and copy:
   - `Host`
   - `Password`

3. In your terminal, run:
```bash
cd /home/user/mascores

# Set your Supabase credentials
export SUPABASE_URL="your_project_url"
export SUPABASE_PASSWORD="your_database_password"
export SUPABASE_ANON_KEY="your_anon_key"

# Run the setup script (this does everything automatically)
node scripts/auto-setup-supabase.js
```

## What the Script Does
- ✅ Connects to your Supabase project
- ✅ Creates all database tables
- ✅ Sets up indexes and relationships
- ✅ Configures OAuth (Google, Apple)
- ✅ Sets up Row Level Security
- ✅ Generates .env file
- ✅ Tests the connection

## Step 4: Deploy
```bash
git push origin main
```

Your app will auto-deploy to Vercel with the new Supabase project!

## Need Help?
- Supabase docs: https://supabase.com/docs
- Your project dashboard: https://supabase.com/dashboard
