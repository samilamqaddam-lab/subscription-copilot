const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
        },
    },
});

const client = new PlaidApi(configuration);

async function createLinkToken(userId) {
    try {
        const response = await client.linkTokenCreate({
            user: { client_user_id: userId },
            client_name: 'Subscription Copilot',
            products: ['transactions'],
            country_codes: ['US'],
            language: 'en',
        });
        
        return response.data.link_token;
    } catch (error) {
        console.error('Plaid link token error:', error);
        throw new Error('Failed to create Plaid link token');
    }
}

async function exchangePublicToken(publicToken) {
    try {
        const response = await client.itemPublicTokenExchange({
            public_token: publicToken,
        });
        
        return response.data.access_token;
    } catch (error) {
        console.error('Plaid token exchange error:', error);
        throw new Error('Failed to exchange token');
    }
}

async function detectSubscriptions(accessToken) {
    try {
        const now = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        
        const response = await client.transactionsGet({
            access_token: accessToken,
            start_date: threeMonthsAgo.toISOString().split('T')[0],
            end_date: now.toISOString().split('T')[0],
        });
        
        const recurring = findRecurringTransactions(response.data.transactions);
        
        return recurring.map(group => ({
            name: group.merchant,
            price: Math.abs(group.amount),
            currency: '$',
            billing: group.frequency,
            category: group.category || 'Other',
            confidence: group.confidence,
            source: 'plaid',
            detectedAt: new Date().toISOString()
        }));
    } catch (error) {
        console.error('Plaid transactions error:', error);
        throw new Error('Failed to fetch transactions');
    }
}

function findRecurringTransactions(transactions) {
    const groups = {};
    
    // Group by merchant
    transactions.forEach(txn => {
        // Skip positive transactions (deposits)
        if (txn.amount > 0) return;
        
        const merchant = txn.merchant_name || txn.name || 'Unknown';
        if (!groups[merchant]) {
            groups[merchant] = [];
        }
        groups[merchant].push(txn);
    });
    
    const recurring = [];
    
    for (const [merchant, txns] of Object.entries(groups)) {
        // Need at least 2 transactions to detect pattern
        if (txns.length < 2) continue;
        
        // Check if amounts are similar (within 10%)
        const amounts = txns.map(t => Math.abs(t.amount));
        const avgAmount = amounts.reduce((a, b) => a + b) / amounts.length;
        const variance = amounts.reduce((sum, amt) => sum + Math.abs(amt - avgAmount), 0) / amounts.length;
        
        // If variance is low, likely recurring
        if (variance < avgAmount * 0.15) {
            // Calculate frequency
            txns.sort((a, b) => new Date(a.date) - new Date(b.date));
            const daysBetween = (new Date(txns[txns.length-1].date) - new Date(txns[0].date)) / (1000 * 60 * 60 * 24);
            const avgDaysBetween = daysBetween / (txns.length - 1);
            
            let frequency = 'monthly';
            if (avgDaysBetween < 10) frequency = 'weekly';
            else if (avgDaysBetween > 25 && avgDaysBetween < 32) frequency = 'monthly';
            else if (avgDaysBetween > 80 && avgDaysBetween < 100) frequency = 'quarterly';
            else if (avgDaysBetween > 350) frequency = 'yearly';
            else continue; // Skip irregular patterns
            
            recurring.push({
                merchant,
                amount: avgAmount,
                frequency,
                category: txns[0].personal_finance_category?.primary || 'Other',
                confidence: Math.min(1, 1 - (variance / avgAmount)),
                transactionCount: txns.length
            });
        }
    }
    
    // Sort by confidence
    return recurring.sort((a, b) => b.confidence - a.confidence);
}

module.exports = {
    createLinkToken,
    exchangePublicToken,
    detectSubscriptions
};
