# 🔗 Integration Guide

This guide explains how to implement real email and bank integrations for Subscription Copilot.

## 📧 Gmail Integration

### Setup

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create new project
   - Enable Gmail API

2. **Get OAuth Credentials**
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URI: `http://localhost:3000/auth/gmail/callback`
   - Download credentials JSON

3. **Required Scopes**
   ```
   https://www.googleapis.com/auth/gmail.readonly
   ```

### Implementation (Node.js Example)

```javascript
const { google } = require('googleapis');

// OAuth setup
const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'http://localhost:3000/auth/gmail/callback'
);

// Scan for subscription receipts
async function scanSubscriptions(accessToken) {
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Search for subscription keywords
    const response = await gmail.users.messages.list({
        userId: 'me',
        q: 'subject:(receipt OR subscription OR billing) after:2024/01/01',
        maxResults: 100
    });
    
    const subscriptions = [];
    
    for (const message of response.data.messages || []) {
        const msg = await gmail.users.messages.get({
            userId: 'me',
            id: message.id
        });
        
        // Parse email body for subscription details
        const parsed = parseSubscriptionEmail(msg.data);
        if (parsed) {
            subscriptions.push(parsed);
        }
    }
    
    return subscriptions;
}

function parseSubscriptionEmail(message) {
    // Extract details using patterns
    const body = getEmailBody(message);
    const subject = getEmailSubject(message);
    
    // Common patterns
    const patterns = {
        netflix: /netflix.*(\$|€|£)(\d+\.?\d*)/i,
        spotify: /spotify.*(\$|€|£)(\d+\.?\d*)/i,
        // Add more...
    };
    
    for (const [service, pattern] of Object.entries(patterns)) {
        const match = body.match(pattern) || subject.match(pattern);
        if (match) {
            return {
                name: service.charAt(0).toUpperCase() + service.slice(1),
                price: parseFloat(match[2]),
                currency: match[1],
                detected: new Date().toISOString()
            };
        }
    }
    
    return null;
}
```

## 🏦 Bank Integration (Plaid - US)

### Setup

1. **Get Plaid API Keys**
   - Sign up at https://plaid.com/
   - Get `client_id` and `secret` from dashboard
   - Use sandbox environment for testing

2. **Install SDK**
   ```bash
   npm install plaid
   ```

### Implementation (Node.js Example)

```javascript
const plaid = require('plaid');

const client = new plaid.PlaidApi(
    new plaid.Configuration({
        basePath: plaid.PlaidEnvironments.sandbox,
        baseOptions: {
            headers: {
                'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
                'PLAID-SECRET': process.env.PLAID_SECRET,
            },
        },
    })
);

// Create link token for user
async function createLinkToken(userId) {
    const response = await client.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'Subscription Copilot',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
    });
    
    return response.data.link_token;
}

// Exchange public token for access token
async function exchangeToken(publicToken) {
    const response = await client.itemPublicTokenExchange({
        public_token: publicToken,
    });
    
    return response.data.access_token;
}

// Detect subscriptions from transactions
async function detectSubscriptions(accessToken) {
    const now = new Date();
    const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
    
    const response = await client.transactionsGet({
        access_token: accessToken,
        start_date: threeMonthsAgo.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
    });
    
    // Group recurring transactions
    const recurring = findRecurringTransactions(response.data.transactions);
    
    return recurring.map(group => ({
        name: group.merchant,
        price: Math.abs(group.amount),
        currency: '$',
        billing: group.frequency,
        category: group.category,
        confidence: group.confidence
    }));
}

function findRecurringTransactions(transactions) {
    const groups = {};
    
    // Group by merchant
    transactions.forEach(txn => {
        const merchant = txn.merchant_name || txn.name;
        if (!groups[merchant]) {
            groups[merchant] = [];
        }
        groups[merchant].push(txn);
    });
    
    // Detect recurring patterns
    const recurring = [];
    
    for (const [merchant, txns] of Object.entries(groups)) {
        if (txns.length < 2) continue;
        
        // Check if amounts are similar
        const amounts = txns.map(t => Math.abs(t.amount));
        const avgAmount = amounts.reduce((a, b) => a + b) / amounts.length;
        const variance = amounts.reduce((sum, amt) => sum + Math.abs(amt - avgAmount), 0) / amounts.length;
        
        // If variance is low, likely recurring
        if (variance < avgAmount * 0.1) {
            // Calculate frequency
            txns.sort((a, b) => new Date(a.date) - new Date(b.date));
            const daysBetween = (new Date(txns[txns.length-1].date) - new Date(txns[0].date)) / (1000 * 60 * 60 * 24);
            const avgDaysBetween = daysBetween / (txns.length - 1);
            
            let frequency = 'monthly';
            if (avgDaysBetween < 10) frequency = 'weekly';
            else if (avgDaysBetween > 80 && avgDaysBetween < 100) frequency = 'quarterly';
            else if (avgDaysBetween > 350) frequency = 'yearly';
            
            recurring.push({
                merchant,
                amount: avgAmount,
                frequency,
                category: txns[0].category?.[0] || 'Other',
                confidence: 1 - (variance / avgAmount)
            });
        }
    }
    
    return recurring;
}
```

## 🏦 Bank Integration (Nordigen - EU)

### Setup

1. **Get Nordigen API Keys**
   - Sign up at https://nordigen.com
   - Get `secret_id` and `secret_key`

2. **Install SDK**
   ```bash
   npm install nordigen-node
   ```

### Implementation (Node.js Example)

```javascript
const NordigenClient = require('nordigen-node');

const client = new NordigenClient({
    secretId: process.env.NORDIGEN_SECRET_ID,
    secretKey: process.env.NORDIGEN_SECRET_KEY
});

// Initialize connection
async function initBankConnection(redirectUri) {
    await client.generateToken();
    
    // Get list of banks
    const institutions = await client.institution.getInstitutions({
        country: 'DE' // Germany - change as needed
    });
    
    // Create requisition
    const requisition = await client.initSession({
        redirectUri,
        institutionId: institutions[0].id,
        referenceId: Date.now().toString()
    });
    
    return requisition.link; // Redirect user here
}

// Fetch transactions after user authorizes
async function getTransactions(requisitionId) {
    const requisition = await client.requisition.getRequisitionById(requisitionId);
    const accountId = requisition.accounts[0];
    
    const transactions = await client.account(accountId).getTransactions();
    
    return detectSubscriptions(transactions.transactions.booked);
}
```

## 🔐 Security Best Practices

1. **Never store credentials in frontend**
   - Use backend proxy for all API calls
   - Store access tokens server-side only

2. **Use HTTPS**
   - Required for OAuth redirects
   - Encrypt data in transit

3. **Token management**
   - Refresh tokens before expiry
   - Implement token rotation
   - Store encrypted in database

4. **User privacy**
   - Only request minimum scopes needed
   - Allow users to revoke access
   - Clear data on disconnect

5. **Rate limiting**
   - Implement API call throttling
   - Cache results when possible
   - Handle quota limits gracefully

## 📦 Backend API Structure

```
POST /api/connect/gmail
  - Initiate Gmail OAuth
  - Returns: authorization URL

POST /api/connect/gmail/callback
  - Exchange code for token
  - Scan emails for subscriptions
  - Returns: detected subscriptions

POST /api/connect/bank
  - Initiate Plaid/Nordigen flow
  - Returns: link token

POST /api/connect/bank/callback
  - Exchange token
  - Fetch transactions
  - Returns: detected subscriptions

GET /api/subscriptions
  - Fetch user's subscriptions
  - Returns: subscription list

POST /api/subscriptions
  - Create new subscription
  - Returns: created subscription

PUT /api/subscriptions/:id
  - Update subscription
  - Returns: updated subscription

DELETE /api/subscriptions/:id
  - Delete subscription
  - Returns: success

POST /api/sync
  - Re-scan email/bank for updates
  - Returns: new subscriptions found
```

## 🔄 Recommended Flow

1. **User clicks "Connect Email"**
   - Frontend calls `/api/connect/gmail`
   - Backend generates OAuth URL
   - User redirected to Google consent
   - Google redirects to `/api/connect/gmail/callback`
   - Backend scans emails
   - Returns subscriptions to frontend
   - Frontend merges with existing data

2. **User clicks "Connect Bank"**
   - Frontend calls `/api/connect/bank`
   - Backend generates Plaid Link token
   - Frontend opens Plaid Link modal
   - User selects bank and logs in
   - Frontend receives public token
   - Frontend sends to `/api/connect/bank/callback`
   - Backend exchanges token and scans transactions
   - Returns detected subscriptions

## 💻 Environment Variables

Create `.env` file:

```bash
# Gmail
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:3000/auth/gmail/callback

# Plaid (US)
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox

# Nordigen (EU)
NORDIGEN_SECRET_ID=your_secret_id
NORDIGEN_SECRET_KEY=your_secret_key

# Database
DATABASE_URL=postgresql://user:pass@localhost/subscriptions

# App
PORT=3000
NODE_ENV=development
SESSION_SECRET=random_string_here
```

## 🧪 Testing

Use sandbox/test environments:
- **Plaid Sandbox**: Test with fake banks
- **Gmail Test User**: Create test Google account
- **Nordigen Sandbox**: Test EU banking

## 📚 Resources

- [Plaid Quickstart](https://plaid.com/docs/quickstart/)
- [Gmail API Node.js](https://developers.google.com/gmail/api/quickstart/nodejs)
- [Nordigen Docs](https://nordigen.com/en/docs/)
- [OAuth 2.0 Guide](https://oauth.net/2/)

---

**Ready to integrate? Start with the backend setup and test with sandbox environments!**
