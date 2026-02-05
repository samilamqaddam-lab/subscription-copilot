# Multi-Email Support Guide

## Overview

The backend now supports connecting **multiple email addresses** for comprehensive subscription detection.

## Features

### ✅ Multi-Account Support
- Connect unlimited Gmail accounts
- Each account scanned independently
- Results merged and deduplicated
- Track which email found which subscription

### ✅ Smart Deduplication
- Same subscription detected in multiple emails → merged
- Keeps highest price (most recent)
- Shows all source emails for each subscription

### ✅ Connection Management
- Add multiple emails one by one
- Remove individual connections
- View scan history per email
- Track subscriptions found per email

## API Endpoints

### List Connected Emails
```http
GET /api/connect/emails
```

**Response:**
```json
{
  "connections": [
    {
      "id": "1234567890",
      "email": "personal@gmail.com",
      "connectedAt": "2024-02-05T10:30:00Z",
      "lastScan": "2024-02-05T12:00:00Z",
      "subscriptionsFound": 12
    },
    {
      "id": "0987654321",
      "email": "work@company.com",
      "connectedAt": "2024-02-05T10:35:00Z",
      "lastScan": "2024-02-05T12:00:00Z",
      "subscriptionsFound": 5
    }
  ]
}
```

### Connect New Email
```http
GET /api/connect/gmail
→ Opens OAuth flow

GET /api/connect/gmail/callback?code=...
→ Connects email and scans
```

**Response:**
```json
{
  "success": true,
  "connection": {
    "id": "1234567890",
    "email": "new@gmail.com",
    "connectedAt": "2024-02-05T13:00:00Z"
  },
  "subscriptions": [
    {
      "name": "Netflix",
      "price": 12.99,
      "currency": "€",
      "category": "Entertainment",
      "sourceEmail": "new@gmail.com"
    }
  ],
  "count": 1
}
```

### Remove Email Connection
```http
DELETE /api/connect/emails/:id
```

**Response:**
```json
{
  "success": true
}
```

### Scan All Emails
```http
POST /api/sync
```

**Response:**
```json
{
  "emails": {
    "success": true,
    "scanned": 2,
    "found": 15,
    "details": [
      {
        "connectionId": "123",
        "email": "personal@gmail.com",
        "success": true,
        "count": 12,
        "subscriptions": [...]
      },
      {
        "connectionId": "456",
        "email": "work@company.com",
        "success": true,
        "count": 5,
        "subscriptions": [...]
      }
    ],
    "subscriptions": [
      {
        "name": "Netflix",
        "price": 12.99,
        "sourceEmail": "personal@gmail.com"
      },
      {
        "name": "Microsoft 365",
        "price": 9.99,
        "sourceEmail": "work@company.com"
      }
    ]
  },
  "totalFound": 15
}
```

## How Deduplication Works

When the same subscription is found in multiple emails:

1. **Group by service name** (case-insensitive)
2. **Keep highest price** (assumes most recent)
3. **Track all source emails**

**Example:**

```javascript
// Email 1 finds:
{ name: "Spotify", price: 9.99, sourceEmail: "old@gmail.com" }

// Email 2 finds:
{ name: "Spotify", price: 10.99, sourceEmail: "new@gmail.com" }

// Result (merged):
{ 
  name: "Spotify", 
  price: 10.99, 
  sourceEmail: "new@gmail.com",
  sourceEmails: ["old@gmail.com", "new@gmail.com"]
}
```

## Frontend Integration

### Display Connected Emails

```javascript
async function loadConnectedEmails() {
    const response = await fetch('http://localhost:3000/api/connect/emails', {
        credentials: 'include'
    });
    
    const data = await response.json();
    
    data.connections.forEach(conn => {
        console.log(`${conn.email}: ${conn.subscriptionsFound} subscriptions`);
    });
}
```

### Connect New Email

```javascript
async function connectEmail() {
    // Get OAuth URL
    const response = await fetch('http://localhost:3000/api/connect/gmail', {
        credentials: 'include'
    });
    
    const data = await response.json();
    
    // Redirect to Google OAuth
    window.location.href = data.authUrl;
}
```

### Remove Email

```javascript
async function removeEmail(connectionId) {
    await fetch(`http://localhost:3000/api/connect/emails/${connectionId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
}
```

### Scan All

```javascript
async function scanAll() {
    const response = await fetch('http://localhost:3000/api/sync', {
        method: 'POST',
        credentials: 'include'
    });
    
    const data = await response.json();
    
    console.log(`Found ${data.totalFound} subscriptions across ${data.emails.scanned} emails`);
    
    return data.emails.subscriptions;
}
```

## Use Cases

### Personal + Work Separation
```
personal@gmail.com → Netflix, Spotify, Disney+
work@company.com → Microsoft 365, Zoom, Slack
```

### Family Accounts
```
parent@gmail.com → Netflix, Amazon Prime
kid@gmail.com → YouTube Premium, Roblox
```

### Old + New Email
```
old.email@gmail.com → Old subscriptions
new.email@gmail.com → Current subscriptions
```
Scan both to detect duplicates and missed cancellations!

## Storage Structure

### connections.json
```json
{
  "user123": [
    {
      "id": "1234567890",
      "email": "user@gmail.com",
      "accessToken": "ya29...",
      "refreshToken": "1//...",
      "provider": "gmail",
      "connectedAt": "2024-02-05T10:00:00Z",
      "lastScan": "2024-02-05T12:00:00Z",
      "subscriptionsFound": 12
    }
  ]
}
```

## Security Notes

- **Tokens stored per user** - isolated by session ID
- **No cross-user access** - each user only sees their own connections
- **Refresh tokens saved** - for long-term access (optional)
- **Delete connections** - removes tokens immediately

## Future Enhancements

- [ ] Auto-refresh expired tokens
- [ ] Scheduled background scans
- [ ] Email change detection (notify if subscription email changed)
- [ ] Batch connect (OAuth multiple accounts at once)
- [ ] Email alias detection (user+tag@gmail.com = user@gmail.com)
- [ ] Confidence scoring (which email is "primary" for each subscription)

## Testing

1. **Connect first email:**
   ```bash
   curl http://localhost:3000/api/connect/gmail
   # Follow OAuth flow
   ```

2. **Connect second email:**
   ```bash
   # Repeat OAuth flow with different Google account
   ```

3. **List connections:**
   ```bash
   curl http://localhost:3000/api/connect/emails \
     --cookie "session=..."
   ```

4. **Scan all:**
   ```bash
   curl -X POST http://localhost:3000/api/sync \
     --cookie "session=..."
   ```

## Troubleshooting

### "Email already connected"
- Each email can only be connected once per user
- Remove existing connection first

### "No subscriptions found"
- Check if emails contain receipts from last 6 months
- Verify Gmail API scopes include `gmail.readonly`

### OAuth fails on second email
- Google may require re-approval if switching accounts
- Use incognito/private browsing for each new account

---

**Ready to scan multiple emails? Connect them all!** 📧📧📧
