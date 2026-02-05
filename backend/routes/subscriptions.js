const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/subscriptions.json');

// Ensure data directory exists
async function ensureDataDir() {
    const dir = path.dirname(DATA_FILE);
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

// Read subscriptions
async function readSubscriptions(userId) {
    await ensureDataDir();
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const allData = JSON.parse(data);
        return allData[userId] || [];
    } catch {
        return [];
    }
}

// Write subscriptions
async function writeSubscriptions(userId, subscriptions) {
    await ensureDataDir();
    let allData = {};
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        allData = JSON.parse(data);
    } catch {}
    
    allData[userId] = subscriptions;
    await fs.writeFile(DATA_FILE, JSON.stringify(allData, null, 2));
}

// GET all subscriptions
router.get('/', async (req, res) => {
    const userId = req.session.userId || 'anonymous';
    
    try {
        const subscriptions = await readSubscriptions(userId);
        res.json(subscriptions);
    } catch (error) {
        console.error('Read subscriptions error:', error);
        res.status(500).json({ error: 'Failed to read subscriptions' });
    }
});

// POST new subscription
router.post('/', async (req, res) => {
    const userId = req.session.userId || 'anonymous';
    const subscription = req.body;
    
    if (!subscription.name || !subscription.price) {
        return res.status(400).json({ error: 'Name and price required' });
    }
    
    try {
        const subscriptions = await readSubscriptions(userId);
        
        const newSubscription = {
            id: Date.now().toString(),
            ...subscription,
            createdAt: new Date().toISOString()
        };
        
        subscriptions.push(newSubscription);
        await writeSubscriptions(userId, subscriptions);
        
        res.status(201).json(newSubscription);
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

// PUT update subscription
router.put('/:id', async (req, res) => {
    const userId = req.session.userId || 'anonymous';
    const { id } = req.params;
    const updates = req.body;
    
    try {
        const subscriptions = await readSubscriptions(userId);
        const index = subscriptions.findIndex(s => s.id === id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        subscriptions[index] = {
            ...subscriptions[index],
            ...updates,
            id, // Preserve ID
            updatedAt: new Date().toISOString()
        };
        
        await writeSubscriptions(userId, subscriptions);
        
        res.json(subscriptions[index]);
    } catch (error) {
        console.error('Update subscription error:', error);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});

// DELETE subscription
router.delete('/:id', async (req, res) => {
    const userId = req.session.userId || 'anonymous';
    const { id } = req.params;
    
    try {
        const subscriptions = await readSubscriptions(userId);
        const filtered = subscriptions.filter(s => s.id !== id);
        
        if (filtered.length === subscriptions.length) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        await writeSubscriptions(userId, filtered);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete subscription error:', error);
        res.status(500).json({ error: 'Failed to delete subscription' });
    }
});

module.exports = router;
