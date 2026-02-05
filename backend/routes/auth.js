const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Simple in-memory session store (use database in production)
const sessions = new Map();

// Create session
router.post('/session', (req, res) => {
    const sessionId = uuidv4();
    sessions.set(sessionId, {
        id: sessionId,
        createdAt: new Date().toISOString(),
        connections: {}
    });
    
    req.session.userId = sessionId;
    
    res.json({ sessionId });
});

// Get current session
router.get('/session', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'No active session' });
    }
    
    const session = sessions.get(req.session.userId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
});

module.exports = router;
