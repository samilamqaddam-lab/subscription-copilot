# Gmail API Setup Guide

## 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Name it something like "Subscription Copilot"

## 2. Enable Gmail API

1. Go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click **Enable**

## 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (unless you have Google Workspace)
3. Fill in:
   - App name: `Subscription Copilot`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue**
5. **Scopes**: Add `https://www.googleapis.com/auth/gmail.readonly`
6. **Test users**: Add your Gmail address
7. Click **Save and Continue**

## 4. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Subscription Copilot Web`
5. Authorized redirect URIs:
   - `http://localhost:3001/auth/callback`
6. Click **Create**
7. **Copy** the Client ID and Client Secret

## 5. Configure Backend

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your credentials:
   ```
   GMAIL_CLIENT_ID=123456789-abc.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=GOCSPX-xxxxx
   GMAIL_REDIRECT_URI=http://localhost:3001/auth/callback
   ```

## 6. Install & Run

```bash
cd backend
npm install
npm start
```

Server runs on http://localhost:3001

## 7. Test

1. Open http://localhost:3001/auth/gmail
2. Copy the `authUrl` and open in browser
3. Authorize with your Google account
4. Check http://localhost:3001/auth/status (should show `connected: true`)
5. Scan: http://localhost:3001/api/scan-subscriptions

## Troubleshooting

### "Access blocked: This app's request is invalid"
- Check redirect URI matches exactly in Google Console

### "This app isn't verified"
- Normal for testing. Click "Advanced" → "Go to Subscription Copilot (unsafe)"
- Only you (test users) can use it until you verify the app

### "Token expired"
- Reconnect via /auth/gmail

## Production Notes

- Store tokens in database (not memory)
- Add proper session management
- Get Google verification for public use
- Use HTTPS
