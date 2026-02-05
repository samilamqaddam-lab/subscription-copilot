const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function getAuthUrl(userId) {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state: userId // Pass user ID for callback
    });
}

async function getTokenFromCode(code) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}

async function scanEmails(accessToken) {
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    try {
        // Search for subscription-related emails
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'subject:(receipt OR subscription OR billing OR invoice) after:2024/01/01',
            maxResults: 100
        });
        
        if (!response.data.messages) {
            return [];
        }
        
        const subscriptions = [];
        
        // Process each message
        for (const message of response.data.messages.slice(0, 20)) { // Limit to 20 for now
            try {
                const msg = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id
                });
                
                const parsed = parseSubscriptionEmail(msg.data);
                if (parsed) {
                    subscriptions.push(parsed);
                }
            } catch (err) {
                console.error(`Error processing message ${message.id}:`, err.message);
            }
        }
        
        return subscriptions;
    } catch (error) {
        console.error('Gmail scan error:', error);
        throw new Error('Failed to scan emails');
    }
}

function parseSubscriptionEmail(message) {
    const body = getEmailBody(message);
    const subject = getEmailSubject(message);
    const from = getEmailFrom(message);
    
    // Subscription patterns
    const patterns = {
        'Netflix': { pattern: /netflix.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Entertainment' },
        'Spotify': { pattern: /spotify.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Entertainment' },
        'Apple Music': { pattern: /apple\s*music.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Entertainment' },
        'YouTube Premium': { pattern: /youtube\s*premium.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Entertainment' },
        'Amazon Prime': { pattern: /amazon\s*prime.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Entertainment' },
        'Disney+': { pattern: /disney.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Entertainment' },
        'HBO Max': { pattern: /hbo.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Entertainment' },
        'Dropbox': { pattern: /dropbox.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Cloud Storage' },
        'Google One': { pattern: /google\s*one.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Cloud Storage' },
        'iCloud': { pattern: /icloud.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Cloud Storage' },
        'Microsoft 365': { pattern: /(office|microsoft)\s*365.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Productivity' },
        'Adobe': { pattern: /adobe.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Software' },
        'GitHub': { pattern: /github.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Software' },
        'Notion': { pattern: /notion.*?(\$|€|£)(\d+\.?\d*)/i, category: 'Productivity' }
    };
    
    for (const [serviceName, { pattern, category }] of Object.entries(patterns)) {
        const match = (body + ' ' + subject).match(pattern);
        if (match) {
            return {
                name: serviceName,
                price: parseFloat(match[2]),
                currency: match[1],
                category,
                billing: 'monthly', // Default
                source: 'gmail',
                detectedFrom: from,
                detectedAt: new Date().toISOString()
            };
        }
    }
    
    return null;
}

function getEmailBody(message) {
    if (message.payload.body.data) {
        return Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }
    
    if (message.payload.parts) {
        for (const part of message.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
        }
    }
    
    return '';
}

function getEmailSubject(message) {
    const header = message.payload.headers.find(h => h.name.toLowerCase() === 'subject');
    return header ? header.value : '';
}

function getEmailFrom(message) {
    const header = message.payload.headers.find(h => h.name.toLowerCase() === 'from');
    return header ? header.value : '';
}

module.exports = {
    getAuthUrl,
    getTokenFromCode,
    scanEmails
};
