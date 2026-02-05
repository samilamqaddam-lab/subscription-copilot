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

// Known subscription services - broad matching
const SUBSCRIPTION_SENDERS = [
  // Streaming
  'netflix', 'spotify', 'apple', 'amazon', 'disney', 'hbo', 'youtube', 'dazn',
  'crunchyroll', 'audible', 'twitch', 'primevideo', 'hulu', 'paramount',
  // Software/AI
  'adobe', 'microsoft', 'google', 'dropbox', 'notion', 'figma', 'slack', 'miro',
  'zoom', 'openai', 'anthropic', 'cursor', 'copilot', 'midjourney', 'runway',
  // Dev tools
  'github', 'gitlab', 'vercel', 'heroku', 'render', 'railway', 'netlify',
  'cloudflare', 'digitalocean', 'aws', 'linode', 'vultr', 'hetzner',
  // Productivity
  'todoist', 'evernote', 'grammarly', 'canva', 'linear', 'asana', 'monday',
  'airtable', 'coda', 'clickup', 'basecamp', 'trello',
  // Security/Utils
  'lastpass', '1password', 'bitwarden', 'nordvpn', 'expressvpn', 'proton',
  // Media/News
  'medium', 'substack', 'patreon', 'nytimes', 'economist', 'wsj', 'bloomberg',
  // Health/Fitness
  'headspace', 'calm', 'duolingo', 'strava', 'peloton', 'fitbit', 'myfitnesspal',
  // Other tools
  'wispr', 'raycast', 'setapp', 'cleanshot', 'istatmenus', 'bartender',
  'superhuman', 'hey', 'fastmail', 'mailchimp', 'convertkit', 'beehiiv',
  // Payment (for detection, will be marked suspicious)
  'paypal', 'stripe', 'klarna', 'revolut', 'wise', 'n26'
];

// Suspicious keywords - flag but don't block
const SUSPICIOUS_KEYWORDS = [
  'paypal', 'klarna', 'stripe', 'revolut', 'n26', 'wise', 'transferwise',
  'google pay', 'apple pay', 'venmo', 'cash app', 'square',
  'accounts', 'members', 'newsletter', 'marketing', 'promo', 'deals', 'offers'
];

// Hard blacklist - only truly useless detections
const BLACKLIST = [
  'noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster'
];

// Known service name mappings (email domain -> display name)
const SERVICE_NAMES = {
  'anthropic': 'Claude Pro',
  'openai': 'ChatGPT Plus',
  'microsoft': 'Microsoft 365',
  'google': 'Google One',
  'apple': 'Apple One',
  'amazon': 'Amazon Prime',
  'adobe': 'Adobe Creative Cloud',
  'github': 'GitHub Pro',
  'figma': 'Figma',
  'notion': 'Notion',
  'slack': 'Slack',
  'zoom': 'Zoom',
  'dropbox': 'Dropbox',
  'spotify': 'Spotify',
  'netflix': 'Netflix',
  'disney': 'Disney+',
  'hbo': 'HBO Max',
  'youtube': 'YouTube Premium',
  'medium': 'Medium',
  'substack': 'Substack',
  'vercel': 'Vercel',
  'render': 'Render',
  'heroku': 'Heroku',
  'digitalocean': 'DigitalOcean',
  'cloudflare': 'Cloudflare',
  'linear': 'Linear',
  'raycast': 'Raycast',
  'setapp': 'Setapp',
  'cursor': 'Cursor',
  'wispr': 'Wispr Flow'
};

// Default prices for common services (monthly, in EUR)
const DEFAULT_PRICES = {
  'Claude Pro': 20,
  'ChatGPT Plus': 20,
  'Microsoft 365': 10,
  'Google One': 3,
  'GitHub Pro': 4,
  'Figma': 15,
  'Notion': 10,
  'Spotify': 11,
  'Netflix': 13,
  'Disney+': 9,
  'YouTube Premium': 12,
  'Medium': 5,
  'Vercel': 20,
  'Render': 7,
  'Linear': 10,
  'Cursor': 20
};

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
  // English
  'invoice', 'receipt', 'payment', 'subscription', 'billing', 'charged',
  'monthly', 'annual', 'yearly', 'renew', 'renewal', 'recurring',
  'membership', 'premium', 'pro plan', 'upgrade', 'thank you for your order',
  // French
  'facture', 'reçu', 'paiement', 'abonnement', 'mensuel',
  // German
  'rechnung', 'zahlung', 'abo', 'monatlich',
  // Spanish
  'suscripción', 'pago', 'recibo'
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
    
    // Build search query - broader to catch more
    const senderQuery = SUBSCRIPTION_SENDERS.map(s => `from:${s}`).join(' OR ');
    const keywordQuery = SUBSCRIPTION_KEYWORDS.map(k => `subject:${k}`).join(' OR ');
    const bodyKeywords = ['subscription', 'recurring', 'monthly charge', 'annual', 'renewal', 'billing period'].map(k => k).join(' OR ');
    const query = `(${senderQuery}) OR (${keywordQuery}) OR (${bodyKeywords}) newer_than:1y`;
    
    console.log('Gmail search query:', query.substring(0, 200) + '...');
    
    // Search emails - get more results
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 200
    });
    
    const messages = listResponse.data.messages || [];
    console.log(`Found ${messages.length} potential subscription emails`);
    
    // Parse each email - process more
    const subscriptions = new Map();
    
    for (const msg of messages.slice(0, 100)) { // Process up to 100 emails
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
  
  const fromRaw = getHeader('From');
  const from = fromRaw.toLowerCase();
  const subject = getHeader('Subject');
  const date = getHeader('Date');
  
  // Hard blacklist - skip completely
  if (BLACKLIST.some(b => from.includes(b))) {
    return null;
  }
  
  // Check if suspicious (payment processor, generic name)
  const isSuspicious = SUSPICIOUS_KEYWORDS.some(k => from.includes(k) || subject.toLowerCase().includes(k));
  
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
  const matchedSender = SUBSCRIPTION_SENDERS.find(s => from.includes(s));
  const hasKeyword = SUBSCRIPTION_KEYWORDS.some(k => fullText.includes(k.toLowerCase()));
  
  // Extract service name using mapping or from email
  let serviceName = null;
  if (matchedSender && SERVICE_NAMES[matchedSender]) {
    serviceName = SERVICE_NAMES[matchedSender];
  } else if (matchedSender) {
    serviceName = matchedSender.charAt(0).toUpperCase() + matchedSender.slice(1);
  } else {
    serviceName = extractServiceName(fromRaw);
  }
  
  // Skip truly generic names
  const genericNames = ['unknown', 'info', 'support', 'noreply', 'no-reply', 'team', 'hello', 'contact', 'admin'];
  if (genericNames.includes(serviceName.toLowerCase())) {
    return null;
  }
  
  // Need either a known sender, a keyword, or a recognizable service name
  const hasRecognizableName = serviceName && serviceName.length > 2 && !genericNames.includes(serviceName.toLowerCase());
  if (!matchedSender && !hasKeyword && !hasRecognizableName) {
    return null;
  }
  
  // Extract price - look for subscription-like amounts (< €100/mo typically)
  let price = null;
  let currency = '€';
  
  // Find all prices and pick the most reasonable one
  const allPrices = [];
  for (const pattern of PRICE_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, 'gi');
    while ((match = regex.exec(fullText)) !== null) {
      const priceStr = match[0].replace(/[€$£]|EUR|USD|GBP/gi, '').trim();
      const p = parseFloat(priceStr.replace(',', '.'));
      if (p > 0 && p < 500) { // Filter out unreasonable prices
        allPrices.push({
          value: p,
          currency: match[0].includes('$') || match[0].includes('USD') ? '$' : 
                    match[0].includes('£') || match[0].includes('GBP') ? '£' : '€'
        });
      }
    }
  }
  
  // Pick the most likely subscription price (between €2 and €100)
  const likelyPrice = allPrices.find(p => p.value >= 2 && p.value <= 100);
  if (likelyPrice) {
    price = likelyPrice.value;
    currency = likelyPrice.currency;
  } else if (allPrices.length > 0) {
    // Fall back to smallest price if no "likely" one
    allPrices.sort((a, b) => a.value - b.value);
    price = allPrices[0].value;
    currency = allPrices[0].currency;
  }
  
  // Use default price if known and no price found
  if (!price && DEFAULT_PRICES[serviceName]) {
    price = DEFAULT_PRICES[serviceName];
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
  if (/invoice|receipt|facture|rechnung|subscription|abonnement/i.test(subject)) confidence += 10;
  
  // Determine category
  let category = 'Other';
  if (/netflix|spotify|disney|hbo|youtube|prime|crunchyroll|audible|twitch/i.test(serviceName)) {
    category = 'Entertainment';
  } else if (/claude|chatgpt|openai|anthropic|cursor|copilot/i.test(serviceName)) {
    category = 'AI Tools';
  } else if (/github|vercel|render|heroku|digitalocean|cloudflare|aws/i.test(serviceName)) {
    category = 'Developer Tools';
  } else if (/notion|slack|linear|todoist|evernote|grammarly/i.test(serviceName)) {
    category = 'Productivity';
  } else if (/adobe|figma|canva/i.test(serviceName)) {
    category = 'Design';
  } else if (/dropbox|google one|icloud/i.test(serviceName)) {
    category = 'Cloud Storage';
  }
  
  // Reduce confidence for suspicious items
  if (isSuspicious) {
    confidence = Math.max(10, confidence - 30);
  }
  
  return {
    name: serviceName,
    price: price,
    currency: currency,
    cycle: cycle,
    category: category,
    lastSeen: date,
    source: 'email',
    confidence: confidence,
    suspicious: isSuspicious,
    fromEmail: fromRaw.substring(0, 100),
    emailSubject: subject.substring(0, 120)
  };
}

function extractServiceName(from) {
  // Try to extract domain name and map to known service
  const emailMatch = from.match(/@([a-z0-9-]+)\./i);
  if (emailMatch) {
    const domain = emailMatch[1].toLowerCase();
    
    // Check if it maps to a known service
    if (SERVICE_NAMES[domain]) {
      return SERVICE_NAMES[domain];
    }
    
    // Skip generic domains
    if (['mail', 'email', 'smtp', 'noreply', 'no-reply', 'support', 'info', 'accounts', 'members'].includes(domain)) {
      return 'Unknown';
    }
    
    // Capitalize nicely
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  
  // Try to extract name before email (e.g., "Netflix <noreply@netflix.com>")
  const nameMatch = from.match(/^"?([^"<@]+)"?\s*</);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    // Skip generic names
    if (['noreply', 'no-reply', 'support', 'info', 'accounts', 'team', 'billing'].includes(name.toLowerCase())) {
      return 'Unknown';
    }
    return name;
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
