const express = require('express');
const router = express.Router();
const gmailConfig = require('../config/gmail');
const plaidConfig = require('../config/plaid');
const nordigenConfig = require('../config/nordigen');
const emailManager = require('../services/email-manager');

// List connected email accounts
router.get('/emails', async (req, res) => {
    const userId = req.session.userId || 'anonymous';
    
    try {
        const connections = await emailManager.getConnections(userId);
        res.json({ 
            connections: connections.map(c => ({
                id: c.id,
                email: c.email,
                connectedAt: c.connectedAt,
                lastScan: c.lastScan,
                subscriptionsFound: c.subscriptionsFound
            }))
        });
    } catch (error) {
        console.error('List emails error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove email connection
router.delete('/emails/:id', async (req, res) => {
    const userId = req.session.userId || 'anonymous';
    const { id } = req.params;
    
    try {
        await emailManager.removeConnection(userId, id);
        res.json({ success: true });
    } catch (error) {
        console.error('Remove email error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Gmail OAuth flow
router.get('/gmail', (req, res) => {
    if (!process.env.GMAIL_CLIENT_ID) {
        return res.status(503).json({ error: 'Gmail integration not configured' });
    }
    
    const userId = req.session.userId || 'anonymous';
    const authUrl = gmailConfig.getAuthUrl(userId);
    
    res.json({ authUrl });
});

router.get('/gmail/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!code) {
        return res.status(400).json({ error: 'No authorization code' });
    }
    
    try {
        const userId = state || req.session.userId || 'anonymous';
        const tokens = await gmailConfig.getTokenFromCode(code);
        
        // Get email address from token
        const emailInfo = await emailManager.getEmailInfo(tokens.access_token);
        
        // Store connection
        const connection = await emailManager.addConnection(
            userId, 
            emailInfo.email, 
            tokens.access_token, 
            tokens.refresh_token
        );
        
        // Scan this email
        const subscriptions = await gmailConfig.scanEmails(tokens.access_token);
        
        // Update scan stats
        await emailManager.updateConnectionAfterScan(userId, connection.id, subscriptions.length);
        
        res.json({ 
            success: true,
            connection: {
                id: connection.id,
                email: connection.email,
                connectedAt: connection.connectedAt
            },
            subscriptions: subscriptions.map(sub => ({
                ...sub,
                sourceEmail: connection.email
            })),
            count: subscriptions.length
        });
    } catch (error) {
        console.error('Gmail callback error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Plaid flow
router.post('/plaid/link-token', async (req, res) => {
    if (!process.env.PLAID_CLIENT_ID) {
        return res.status(503).json({ error: 'Plaid integration not configured' });
    }
    
    try {
        const userId = req.session.userId || 'anonymous';
        const linkToken = await plaidConfig.createLinkToken(userId);
        
        res.json({ linkToken });
    } catch (error) {
        console.error('Plaid link token error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/plaid/exchange', async (req, res) => {
    const { publicToken } = req.body;
    
    if (!publicToken) {
        return res.status(400).json({ error: 'Public token required' });
    }
    
    try {
        const accessToken = await plaidConfig.exchangePublicToken(publicToken);
        const subscriptions = await plaidConfig.detectSubscriptions(accessToken);
        
        // Store token in session
        req.session.plaidToken = accessToken;
        
        res.json({ 
            success: true, 
            subscriptions,
            count: subscriptions.length
        });
    } catch (error) {
        console.error('Plaid exchange error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Nordigen flow
router.post('/nordigen/init', async (req, res) => {
    if (!process.env.NORDIGEN_SECRET_ID) {
        return res.status(503).json({ error: 'Nordigen integration not configured' });
    }
    
    const { country = 'DE' } = req.body;
    
    try {
        const userId = req.session.userId || 'anonymous';
        const result = await nordigenConfig.initBankConnection(userId, country);
        
        // Store requisition ID
        req.session.nordigenRequisitionId = result.requisitionId;
        
        res.json(result);
    } catch (error) {
        console.error('Nordigen init error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/nordigen/transactions', async (req, res) => {
    const requisitionId = req.session.nordigenRequisitionId;
    
    if (!requisitionId) {
        return res.status(400).json({ error: 'No bank connection found' });
    }
    
    try {
        const subscriptions = await nordigenConfig.getTransactions(requisitionId);
        
        res.json({ 
            success: true, 
            subscriptions,
            count: subscriptions.length
        });
    } catch (error) {
        console.error('Nordigen transactions error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
