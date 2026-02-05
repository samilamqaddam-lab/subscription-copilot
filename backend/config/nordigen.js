const NordigenClient = require('nordigen-node');

let client = null;

function getClient() {
    if (!client) {
        client = new NordigenClient({
            secretId: process.env.NORDIGEN_SECRET_ID,
            secretKey: process.env.NORDIGEN_SECRET_KEY
        });
    }
    return client;
}

async function initBankConnection(userId, country = 'DE') {
    try {
        const client = getClient();
        await client.generateToken();
        
        // Get institutions for country
        const institutions = await client.institution.getInstitutions({ country });
        
        if (institutions.length === 0) {
            throw new Error(`No banks available for country: ${country}`);
        }
        
        // Create requisition
        const requisition = await client.initSession({
            redirectUri: `${process.env.FRONTEND_URL}/bank-connected`,
            institutionId: institutions[0].id,
            referenceId: userId
        });
        
        return {
            link: requisition.link,
            requisitionId: requisition.id,
            institutions: institutions.slice(0, 10).map(i => ({
                id: i.id,
                name: i.name,
                logo: i.logo,
                countries: i.countries
            }))
        };
    } catch (error) {
        console.error('Nordigen init error:', error);
        throw new Error('Failed to initialize bank connection');
    }
}

async function getTransactions(requisitionId) {
    try {
        const client = getClient();
        await client.generateToken();
        
        const requisition = await client.requisition.getRequisitionById(requisitionId);
        
        if (!requisition.accounts || requisition.accounts.length === 0) {
            throw new Error('No accounts found');
        }
        
        const accountId = requisition.accounts[0];
        const transactions = await client.account(accountId).getTransactions();
        
        return detectSubscriptions(transactions.transactions.booked);
    } catch (error) {
        console.error('Nordigen transactions error:', error);
        throw new Error('Failed to fetch transactions');
    }
}

function detectSubscriptions(transactions) {
    const groups = {};
    
    // Group by creditor/merchant
    transactions.forEach(txn => {
        // Skip positive transactions (deposits)
        if (parseFloat(txn.transactionAmount.amount) > 0) return;
        
        const merchant = txn.creditorName || txn.remittanceInformationUnstructured || 'Unknown';
        if (!groups[merchant]) {
            groups[merchant] = [];
        }
        groups[merchant].push(txn);
    });
    
    const recurring = [];
    
    for (const [merchant, txns] of Object.entries(groups)) {
        if (txns.length < 2) continue;
        
        const amounts = txns.map(t => Math.abs(parseFloat(t.transactionAmount.amount)));
        const avgAmount = amounts.reduce((a, b) => a + b) / amounts.length;
        const variance = amounts.reduce((sum, amt) => sum + Math.abs(amt - avgAmount), 0) / amounts.length;
        
        if (variance < avgAmount * 0.15) {
            txns.sort((a, b) => new Date(a.bookingDate) - new Date(b.bookingDate));
            const daysBetween = (new Date(txns[txns.length-1].bookingDate) - new Date(txns[0].bookingDate)) / (1000 * 60 * 60 * 24);
            const avgDaysBetween = daysBetween / (txns.length - 1);
            
            let frequency = 'monthly';
            if (avgDaysBetween < 10) frequency = 'weekly';
            else if (avgDaysBetween > 25 && avgDaysBetween < 32) frequency = 'monthly';
            else if (avgDaysBetween > 80 && avgDaysBetween < 100) frequency = 'quarterly';
            else if (avgDaysBetween > 350) frequency = 'yearly';
            else continue;
            
            recurring.push({
                name: merchant,
                price: avgAmount,
                currency: txns[0].transactionAmount.currency,
                billing: frequency,
                category: 'Other',
                confidence: Math.min(1, 1 - (variance / avgAmount)),
                source: 'nordigen',
                detectedAt: new Date().toISOString()
            });
        }
    }
    
    return recurring.sort((a, b) => b.confidence - a.confidence);
}

module.exports = {
    initBankConnection,
    getTransactions
};
