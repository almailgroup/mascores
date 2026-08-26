# Fix Google OAuth Login

## Quick Fix (1 minute)

1. **Get your Service Role Key:**
   - Go to https://supabase.com/dashboard
   - Select project `ontmfbptthwipfzlywwh`
   - Click Settings → API
   - Copy the "Service role secret" key

2. **Run this command in your terminal:**

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/ontmfbptthwipfzlywwh/auth/config" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "auth": {
      "redirect_urls": [
        "https://mascores.vercel.app",
        "https://mascores.lovable.app",
        "http://localhost:3000",
        "http://localhost:5173"
      ]
    }
  }'
```

Replace `YOUR_SERVICE_ROLE_KEY` with your actual key.

3. **Done!**
   - Google login should now work
   - Visit https://mascores.vercel.app

## What This Does
Adds your Vercel domain to Supabase's allowed OAuth redirect URIs so Google can redirect users back to your site after login.
