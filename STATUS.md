# Subscription Copilot - Project Status

**Last Updated:** 2026-02-06 00:39 CET

## Live URLs
- **Frontend:** https://subscription-copilot.onrender.com/
- **Backend:** https://subscription-copilot-api.onrender.com/
- **Repo:** https://github.com/samilamqaddam-lab/subscription-copilot.git

## Current State: MVP Working ✅

### What Works
- [x] Gmail OAuth authentication
- [x] Email scanning for subscriptions (up to 2000 emails)
- [x] Price extraction from receipts (text + HTML emails)
- [x] Service name detection and mapping
- [x] Category detection (Entertainment, AI Tools, Developer, etc.)
- [x] localStorage persistence (key: `subs_v3`)
- [x] Original prototype design (gradient theme, sidebar, KPIs)
- [x] Debug endpoint for troubleshooting

### Recent Fixes (2026-02-06)
1. **HTML Email Parsing** - Receipts from Anthropic/Stripe are HTML-only, now extracted properly
2. **Payment Processor Blacklist** - PayPal, Klarna, Stripe, Revolut filtered out
3. **Stricter Billing Keywords** - Removed "purchase" (matched promos), added specific phrases
4. **No Default Prices** - Prices only from actual receipts, not hardcoded
5. **Removed 100 Email Limit** - Now scans up to 2000 emails with pagination

## Known Issues / TODO

### Detection Accuracy
- [ ] Some receipts still show "unknown" price - need to verify HTML parsing works
- [ ] Cycle detection (monthly/yearly) may be wrong - needs more testing
- [ ] Test with more email providers (not just Gmail)

### Features to Add
- [ ] Bank integration (Plaid/Nordigen) for transaction-based detection
- [ ] Manual subscription entry UI
- [ ] CSV/JSON import
- [ ] PWA for mobile
- [ ] Multi-user support (Redis/DB for tokens instead of memory)
- [ ] Notification for upcoming renewals

### Technical Debt
- [ ] Token storage is in-memory (lost on restart) - need Redis/DB
- [ ] No rate limiting on API
- [ ] No tests

## Architecture

```
prototypes/subscription-copilot/
├── index.html          # Frontend (static, served by Render)
├── backend/
│   ├── server.js       # Express API (Gmail OAuth + scanning)
│   ├── package.json
│   └── .env.example
├── render.yaml         # Render deployment config
├── STATUS.md           # This file
└── README.md           # User-facing docs
```

## Key Code Locations

### Backend (server.js)
- `SUBSCRIPTION_SENDERS` (line ~35) - Known subscription services
- `BLACKLIST` (line ~70) - Payment processors to ignore
- `BILLING_KEYWORDS` (line ~80) - Receipt detection phrases
- `SERVICE_NAMES` (line ~90) - Domain → display name mapping
- `PRICE_PATTERNS` (line ~120) - Regex for price extraction
- `parseSubscriptionEmail()` (line ~380) - Main parsing logic
- `/api/debug-emails` (line ~600) - Debug endpoint for testing

### Frontend (index.html)
- `curatedAlternatives` object - Curated cheaper alternatives by category
- `scanGmail()` - Streaming scan with progress
- `localStorage` key: `subs_v3`

## Debug Commands

```bash
# Check if backend is up
curl https://subscription-copilot-api.onrender.com/health

# Debug emails (requires auth - connect via frontend first)
curl "https://subscription-copilot-api.onrender.com/api/debug-emails?limit=20"

# Filter by service
curl "https://subscription-copilot-api.onrender.com/api/debug-emails?service=anthropic&limit=10"
```

## Environment Variables (Backend)

```
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=xxx
GMAIL_REDIRECT_URI=https://subscription-copilot-api.onrender.com/auth/callback
FRONTEND_URL=https://subscription-copilot.onrender.com
```

## Next Session Priorities

1. **Verify HTML parsing** - Test Anthropic receipts show correct prices
2. **Fix cycle detection** - Monthly vs yearly accuracy
3. **Consider Plaid** - Bank transaction integration for better accuracy
