const express = require('express');
const router = express.Router();
const plaidConfig = require('../config/plaid');
const nordigenConfig = require('../config/nordigen');
const emailManager = require('../services/email-manager');

// Re-scan all connected sources
router.post('/', async (req, res) => {
    const userId = req.session.userId || 'anonymous';
    
    const results = {
        emails: null,
        plaid: null,
        nordigen: null,
        totalFound: 0
    };
    
    try {
        // Scan all connected emails
        try {
            const emailResults = await emailManager.scanAllEmails(userId);
            results.emails = {
                success: true,
                scanned: emailResults.totalScanned,
                found: emailResults.totalFound,
                details: emailResults.emails,
                subscriptions: emailResults.subscriptions
            };
            results.totalFound += emailResults.totalFound;
        } catch (error) {
            results.emails = { success: false, error: error.message };
        }
        
        // Plaid
        if (req.session.plaidToken) {
            try {
                const subscriptions = await plaidConfig.detectSubscriptions(req.session.plaidToken);
                results.plaid = { success: true, count: subscriptions.length, subscriptions };
                results.totalFound += subscriptions.length;
            } catch (error) {
                results.plaid = { success: false, error: error.message };
            }
        }
        
        // Nordigen
        if (req.session.nordigenRequisitionId) {
            try {
                const subscriptions = await nordigenConfig.getTransactions(req.session.nordigenRequisitionId);
                results.nordigen = { success: true, count: subscriptions.length, subscriptions };
                results.totalFound += subscriptions.length;
            } catch (error) {
                results.nordigen = { success: false, error: error.message };
            }
        }
        
        res.json(results);
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Sync failed', results });
    }
});

module.exports = router;
