# Vercel Deployment Setup

Your GitHub Actions workflow is ready to automatically deploy to Vercel on every push.

## Quick Setup (2 minutes)

1. **Create a Vercel account** (free)
   - Go to https://vercel.com
   - Sign up with GitHub

2. **Create a new project**
   - Click "Add New" → "Project"
   - Select `almailgroup/mascores`
   - Vercel will auto-detect the framework

3. **Get your tokens**
   - Go to Vercel Settings → Tokens
   - Create a token and copy it
   - Note your Org ID (in account settings)
   - Copy Project ID from project settings

4. **Add GitHub Secrets**
   - Go to GitHub repo → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `VERCEL_TOKEN` = your Vercel token
     - `VERCEL_ORG_ID` = your Vercel org ID
     - `VERCEL_PROJECT_ID` = your project ID
     - `VITE_SUPABASE_URL` = from your .env
     - `VITE_SUPABASE_PROJECT_ID` = from your .env
     - `VITE_SUPABASE_PUBLISHABLE_KEY` = from your .env

5. **Done!**
   - Next push to main automatically deploys
   - Live at `https://mascores.vercel.app`

That's it! Everything else is automatic.
