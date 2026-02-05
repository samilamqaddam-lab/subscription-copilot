# Subscription Copilot Backend

Backend API server with Gmail and Bank integrations for automatic subscription detection.

## Features

- 📧 **Gmail Integration** - Scan receipts from your inbox
- 🏦 **Plaid Integration** - Connect US bank accounts
- 🇪🇺 **Nordigen Integration** - Connect EU bank accounts
- 🔍 **Auto-detection** - Find recurring charges automatically
- 💾 **JSON Storage** - Simple file-based persistence (can upgrade to PostgreSQL)

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Setup Configuration

Run the interactive setup:

```bash
npm run setup
```

Or manually copy `.env.example` to `.env` and fill in your credentials.

### 3. Start Server

```bash
npm start
```

Server will run on http://localhost:3000

### 4. Development Mode

```bash
npm run dev
```

Uses nodemon for auto-reload.

## API Endpoints

### Health Check
```
GET /health
```

### Gmail Integration
```
GET /api/connect/gmail
→ Returns Gmail OAuth URL

GET /api/connect/gmail/callback?code=...
→ Exchanges code for token and scans emails
```

### Plaid Integration (US)
```
POST /api/connect/plaid/link-token
→ Creates Plaid Link token

POST /api/connect/plaid/exchange
Body: { publicToken }
→ Exchanges token and detects subscriptions
```

### Nordigen Integration (EU)
```
POST /api/connect/nordigen/init
Body: { country: "DE" }
→ Initializes bank connection

GET /api/connect/nordigen/transactions
→ Fetches and analyzes transactions
```

### Subscriptions CRUD
```
GET /api/subscriptions
→ List all subscriptions

POST /api/subscriptions
Body: { name, price, currency, billing, ... }
→ Create subscription

PUT /api/subscriptions/:id
Body: { price, ... }
→ Update subscription

DELETE /api/subscriptions/:id
→ Delete subscription
```

### Sync
```
POST /api/sync
→ Re-scan all connected sources
```

## Getting API Credentials

### Gmail API

1. Go to https://console.cloud.google.com
2. Create new project
3. Enable Gmail API
4. Create OAuth 2.0 Client ID
5. Add redirect URI: `http://localhost:3000/api/connect/gmail/callback`
6. Download credentials

### Plaid (US Banking)

1. Sign up at https://plaid.com
2. Go to dashboard
3. Get Client ID and Secret
4. Use `sandbox` environment for testing

Test credentials (sandbox):
- Any username/password works
- Select "First Platypus Bank"

### Nordigen (EU Banking)

1. Sign up at https://nordigen.com
2. Go to dashboard
3. Get Secret ID and Secret Key
4. Free tier: 100 requests/day

## Project Structure

```
backend/
├── server.js                 # Express app
├── package.json              # Dependencies
├── setup.js                  # Interactive setup script
├── .env                      # Configuration (create from .env.example)
├── config/
│   ├── gmail.js             # Gmail API integration
│   ├── plaid.js             # Plaid API integration
│   └── nordigen.js          # Nordigen API integration
├── routes/
│   ├── auth.js              # Session management
│   ├── connect.js           # Integration endpoints
│   ├── subscriptions.js     # CRUD operations
│   └── sync.js              # Re-scan endpoint
└── data/
    └── subscriptions.json   # File-based storage
```

## Security Notes

- Session secret is auto-generated during setup
- Tokens stored in memory (sessions)
- CORS restricted to frontend URL
- Use HTTPS in production
- Never commit `.env` to git

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use PostgreSQL instead of JSON file
- [ ] Set up proper session store (Redis/Memcached)
- [ ] Enable HTTPS
- [ ] Add rate limiting
- [ ] Implement proper logging
- [ ] Add user authentication
- [ ] Set up monitoring

## Troubleshooting

### Gmail OAuth fails
- Check redirect URI matches exactly
- Ensure Gmail API is enabled
- Verify credentials are correct

### Plaid Link doesn't open
- Check PLAID_ENV is set to `sandbox`
- Verify Client ID and Secret
- Try different bank in sandbox

### Nordigen connection fails
- Check Secret ID and Key
- Verify country code (DE, FR, etc.)
- Ensure free tier hasn't exceeded limit

## Upgrade to PostgreSQL

1. Install pg:
```bash
npm install pg
```

2. Set DATABASE_URL in .env:
```
DATABASE_URL=postgresql://user:pass@localhost/subscriptions
```

3. Create tables:
```sql
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    billing VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    next_billing DATE,
    notes TEXT,
    source VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE connections (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

4. Update routes to use PostgreSQL instead of JSON file

## License

MIT
