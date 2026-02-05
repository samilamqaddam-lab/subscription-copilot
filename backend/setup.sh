#!/bin/bash

echo "🔧 Subscription Copilot - Gmail API Setup"
echo "=========================================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "✅ .env file found"
    source .env
    if [ -n "$GMAIL_CLIENT_ID" ] && [ "$GMAIL_CLIENT_ID" != "your-client-id.apps.googleusercontent.com" ]; then
        echo "✅ Credentials configured"
        echo ""
        echo "Starting server..."
        npm start
        exit 0
    fi
fi

echo ""
echo "📋 You need Gmail API credentials from Google Cloud Console."
echo ""
echo "Steps:"
echo "1. Go to: https://console.cloud.google.com/apis/credentials"
echo "2. Create a project (if needed)"
echo "3. Enable Gmail API"
echo "4. Create OAuth 2.0 credentials (Web application)"
echo "5. Add redirect URI: http://localhost:3001/auth/callback"
echo ""
echo "Opening Google Cloud Console in 3 seconds..."
sleep 3

# Open browser
if command -v open &> /dev/null; then
    open "https://console.cloud.google.com/apis/credentials"
elif command -v xdg-open &> /dev/null; then
    xdg-open "https://console.cloud.google.com/apis/credentials"
fi

echo ""
echo "Enter your credentials when ready (or Ctrl+C to cancel):"
echo ""

read -p "Client ID: " CLIENT_ID
read -p "Client Secret: " CLIENT_SECRET

# Create .env file
cat > .env << EOF
GMAIL_CLIENT_ID=$CLIENT_ID
GMAIL_CLIENT_SECRET=$CLIENT_SECRET
GMAIL_REDIRECT_URI=http://localhost:3001/auth/callback
PORT=3001
EOF

echo ""
echo "✅ .env file created!"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""
echo "🚀 Starting server..."
npm start
