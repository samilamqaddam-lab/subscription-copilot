const gmailConfig = require('../config/gmail');
const fs = require('fs').promises;
const path = require('path');

const CONNECTIONS_FILE = path.join(__dirname, '../data/connections.json');

// Ensure data directory exists
async function ensureDataDir() {
    const dir = path.dirname(CONNECTIONS_FILE);
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

// Read all email connections for a user
async function getConnections(userId) {
    await ensureDataDir();
    try {
        const data = await fs.readFile(CONNECTIONS_FILE, 'utf8');
        const allData = JSON.parse(data);
        return allData[userId] || [];
    } catch {
        return [];
    }
}

// Save connections
async function saveConnections(userId, connections) {
    await ensureDataDir();
    let allData = {};
    try {
        const data = await fs.readFile(CONNECTIONS_FILE, 'utf8');
        allData = JSON.parse(data);
    } catch {}
    
    allData[userId] = connections;
    await fs.writeFile(CONNECTIONS_FILE, JSON.stringify(allData, null, 2));
}

// Add email connection
async function addConnection(userId, emailAddress, accessToken, refreshToken = null) {
    const connections = await getConnections(userId);
    
    // Check if already exists
    const exists = connections.find(c => c.email === emailAddress);
    if (exists) {
        throw new Error('Email already connected');
    }
    
    const newConnection = {
        id: Date.now().toString(),
        email: emailAddress,
        accessToken,
        refreshToken,
        provider: 'gmail',
        connectedAt: new Date().toISOString(),
        lastScan: null,
        subscriptionsFound: 0
    };
    
    connections.push(newConnection);
    await saveConnections(userId, connections);
    
    return newConnection;
}

// Remove email connection
async function removeConnection(userId, connectionId) {
    const connections = await getConnections(userId);
    const filtered = connections.filter(c => c.id !== connectionId);
    
    if (filtered.length === connections.length) {
        throw new Error('Connection not found');
    }
    
    await saveConnections(userId, filtered);
    return true;
}

// Update connection after scan
async function updateConnectionAfterScan(userId, connectionId, subscriptionsCount) {
    const connections = await getConnections(userId);
    const connection = connections.find(c => c.id === connectionId);
    
    if (connection) {
        connection.lastScan = new Date().toISOString();
        connection.subscriptionsFound = subscriptionsCount;
        await saveConnections(userId, connections);
    }
}

// Scan all connected emails
async function scanAllEmails(userId) {
    const connections = await getConnections(userId);
    
    if (connections.length === 0) {
        return { emails: [], subscriptions: [], totalFound: 0 };
    }
    
    const results = [];
    const allSubscriptions = [];
    
    for (const connection of connections) {
        try {
            const subscriptions = await gmailConfig.scanEmails(connection.accessToken);
            
            // Add email source to each subscription
            const subscriptionsWithSource = subscriptions.map(sub => ({
                ...sub,
                sourceEmail: connection.email,
                connectionId: connection.id
            }));
            
            results.push({
                connectionId: connection.id,
                email: connection.email,
                success: true,
                count: subscriptions.length,
                subscriptions: subscriptionsWithSource
            });
            
            allSubscriptions.push(...subscriptionsWithSource);
            
            // Update connection
            await updateConnectionAfterScan(userId, connection.id, subscriptions.length);
        } catch (error) {
            results.push({
                connectionId: connection.id,
                email: connection.email,
                success: false,
                error: error.message
            });
        }
    }
    
    // Deduplicate subscriptions by name
    const unique = deduplicateSubscriptions(allSubscriptions);
    
    return {
        emails: results,
        subscriptions: unique,
        totalFound: unique.length,
        totalScanned: connections.length
    };
}

// Deduplicate subscriptions (same service detected in multiple emails)
function deduplicateSubscriptions(subscriptions) {
    const map = new Map();
    
    for (const sub of subscriptions) {
        const key = sub.name.toLowerCase();
        
        if (!map.has(key)) {
            map.set(key, sub);
        } else {
            // Keep the one with higher price (likely more recent)
            const existing = map.get(key);
            if (sub.price > existing.price) {
                // Update but keep all source emails
                map.set(key, {
                    ...sub,
                    sourceEmails: [...(existing.sourceEmails || [existing.sourceEmail]), sub.sourceEmail]
                });
            } else {
                // Add email to existing
                existing.sourceEmails = existing.sourceEmails || [existing.sourceEmail];
                existing.sourceEmails.push(sub.sourceEmail);
            }
        }
    }
    
    return Array.from(map.values());
}

// Get email info from token
async function getEmailInfo(accessToken) {
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    return {
        email: userInfo.data.email,
        name: userInfo.data.name,
        picture: userInfo.data.picture
    };
}

module.exports = {
    getConnections,
    addConnection,
    removeConnection,
    scanAllEmails,
    updateConnectionAfterScan,
    getEmailInfo
};
