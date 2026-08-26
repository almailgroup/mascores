#!/bin/bash

echo "🔐 Supabase OAuth Setup Helper"
echo "=============================="
echo ""
echo "To get your Service Role Key:"
echo "1. Go to: https://supabase.com/dashboard"
echo "2. Click your project: 'ontmfbptthwipfzlywwh'"
echo "3. Settings → API → Copy 'Service role' key"
echo ""
echo "Then paste it below:"
echo ""
read -sp "Enter your Supabase Service Role Key: " SERVICE_KEY
echo ""
echo ""

PROJECT_ID="ontmfbptthwipfzlywwh"
API_URL="https://api.supabase.com/v1/projects/${PROJECT_ID}/auth/config"

# Get current config
echo "⏳ Fetching current OAuth config..."
CURRENT=$(curl -s -X GET "$API_URL" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json")

# Extract current redirect URIs and add new ones
NEW_CONFIG=$(cat <<EOF
{
  "auth": {
    "redirect_urls": [
      "https://mascores.vercel.app",
      "https://mascores.lovable.app",
      "http://localhost:3000",
      "http://localhost:5173"
    ]
  }
}
EOF
)

# Update config
echo "🔄 Updating OAuth redirect URIs..."
RESPONSE=$(curl -s -X PATCH "$API_URL" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "$NEW_CONFIG")

if echo "$RESPONSE" | grep -q "error"; then
  echo "❌ Error: $(echo $RESPONSE | grep -o '"message":"[^"]*' | cut -d'"' -f4)"
  exit 1
else
  echo "✅ OAuth redirect URIs updated successfully!"
  echo ""
  echo "✨ Your Google login should now work!"
  echo "🚀 Visit: https://mascores.vercel.app"
fi
