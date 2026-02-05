import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - allow both local and production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Gmail OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Store tokens in memory (use Redis/DB in production)
let userTokens = null;

// Known subscription senders
const SUBSCRIPTION_SENDERS = [
  'netflix', 'spotify', 'apple', 'amazon', 'disney', 'hbo', 'youtube',
  'adobe', 'microsoft', 'google', 'dropbox', 'notion', 'figma', 'slack',
  'zoom', 'openai', 'anthropic', 'github', 'vercel', 'heroku', 'aws',
  'cloudflare', 'digitalocean', 'stripe', 'paypal', 'revolut', 'n26',
  'headspace', 'calm', 'duolingo', 'strava', 'peloton', 'nytimes',
  'medium', 'substack', 'patreon', 'twitch', 'crunchyroll', 'audible',
  'canva', 'grammarly', 'todoist', 'evernote', 'lastpass', '1password'
];

// Price extraction patterns
const PRICE_PATTERNS = [
  /€\s*(\d+[.,]\d{2})/gi,
  /(\d+[.,]\d{2})\s*€/gi,
  /EUR\s*(\d+[.,]\d{2})/gi,
  /(\d+[.,]\d{2})\s*EUR/gi,
  /\$\s*(\d+[.,]\d{2})/gi,
  /(\d+[.,]\d{2})\s*USD/gi,
  /£\s*(\d+[.,]\d{2})/gi
];

// Keywords for subscription emails
const SUBSCRIPTION_KEYWORDS = [
  'invoice', 'receipt', 'payment', 'subscription', 'billing',
  'facture', 'reçu', 'paiement', 'abonnement',
  'rechnung', 'zahlung', 'abo',
  'monthly', 'annual', 'yearly', 'renew'
];

// ==================== AUTH ROUTES ====================

// Start OAuth flow
app.get('/auth/gmail', (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  res.json({ authUrl });
});

// OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    userTokens = tokens;
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
    
    // Redirect to frontend with success
    res.send(`
      <html>
        <body>
          <h2>✅ Gmail connected successfully!</h2>
          <p>You can close this window and return to Subscription Copilot.</p>
          <script>
            window.opener?.postMessage({ type: 'GMAIL_CONNECTED' }, '*');
            setTimeout(() => {
              window.location.href = '${frontendUrl}';
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('Failed to authenticate with Gmail');
  }
});

// Check auth status
app.get('/auth/status', (req, res) => {
  res.json({ connected: !!userTokens });
});

// Disconnect
app.post('/auth/disconnect', (req, res) => {
  userTokens = null;
  res.json({ success: true });
});

// ==================== EMAIL SCANNING ====================

// Scan emails for subscriptions
app.get('/api/scan-subscriptions', async (req, res) => {
  if (!userTokens) {
    return res.status(401).json({ error: 'Not authenticated. Please connect Gmail first.' });
  }
  
  try {
    oauth2Client.setCredentials(userTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Build search query
    const senderQuery = SUBSCRIPTION_SENDERS.map(s => `from:${s}`).join(' OR ');
    const keywordQuery = SUBSCRIPTION_KEYWORDS.map(k => `subject:${k}`).join(' OR ');
    const query = `(${senderQuery}) OR (${keywordQuery}) newer_than:1y`;
    
    // Search emails
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100
    });
    
    const messages = listResponse.data.messages || [];
    console.log(`Found ${messages.length} potential subscription emails`);
    
    // Parse each email
    const subscriptions = new Map();
    
    for (const msg of messages.slice(0, 50)) { // Limit to 50 for speed
      try {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });
        
        const parsed = parseSubscriptionEmail(email.data);
        if (parsed) {
          // Dedupe by service name
          const key = parsed.name.toLowerCase();
          if (!subscriptions.has(key) || parsed.confidence > subscriptions.get(key).confidence) {
            subscriptions.set(key, parsed);
          }
        }
      } catch (err) {
        console.error(`Failed to parse email ${msg.id}:`, err.message);
      }
    }
    
    const results = Array.from(subscriptions.values())
      .sort((a, b) => b.confidence - a.confidence);
    
    res.json({
      success: true,
      count: results.length,
      subscriptions: results
    });
    
  } catch (error) {
    console.error('Scan error:', error);
    
    if (error.code === 401) {
      userTokens = null;
      return res.status(401).json({ error: 'Session expired. Please reconnect Gmail.' });
    }
    
    res.status(500).json({ error: 'Failed to scan emails' });
  }
});

// ==================== EMAIL PARSING ====================

function parseSubscriptionEmail(email) {
  const headers = email.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  
  const from = getHeader('From');
  const subject = getHeader('Subject');
  const date = getHeader('Date');
  
  // Extract body
  let body = '';
  if (email.payload?.body?.data) {
    body = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
  } else if (email.payload?.parts) {
    for (const part of email.payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        break;
      }
    }
  }
  
  const fullText = `${from} ${subject} ${body}`.toLowerCase();
  
  // Check if it's a subscription email
  const matchedSender = SUBSCRIPTION_SENDERS.find(s => from.toLowerCase().includes(s));
  const hasKeyword = SUBSCRIPTION_KEYWORDS.some(k => fullText.includes(k));
  
  if (!matchedSender && !hasKeyword) {
    return null;
  }
  
  // Extract service name
  let serviceName = matchedSender || extractServiceName(from);
  serviceName = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
  
  // Extract price
  let price = null;
  let currency = '€';
  
  for (const pattern of PRICE_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      const priceStr = match[0].replace(/[€$£]|EUR|USD|GBP/gi, '').trim();
      price = parseFloat(priceStr.replace(',', '.'));
      
      if (match[0].includes('$') || match[0].includes('USD')) currency = '$';
      else if (match[0].includes('£') || match[0].includes('GBP')) currency = '£';
      else currency = '€';
      
      break;
    }
  }
  
  // Determine billing cycle
  let cycle = 'monthly';
  if (/annual|yearly|year|an\b|jahr/i.test(fullText)) {
    cycle = 'yearly';
  }
  
  // Calculate confidence score
  let confidence = 0;
  if (matchedSender) confidence += 40;
  if (hasKeyword) confidence += 30;
  if (price) confidence += 20;
  if (/invoice|receipt|facture|rechnung/i.test(subject)) confidence += 10;
  
  return {
    name: serviceName,
    price: price,
    currency: currency,
    cycle: cycle,
    lastSeen: date,
    source: 'email',
    confidence: confidence,
    emailSubject: subject.substring(0, 100)
  };
}

function extractServiceName(from) {
  // Try to extract domain name
  const emailMatch = from.match(/@([a-z0-9-]+)\./i);
  if (emailMatch) {
    return emailMatch[1];
  }
  
  // Try to extract name before email
  const nameMatch = from.match(/^([^<]+)/);
  if (nameMatch) {
    return nameMatch[1].trim().split(' ')[0];
  }
  
  return 'Unknown';
}

// ==================== SERVER START ====================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Subscription Copilot backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
