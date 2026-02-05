#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setup() {
    console.log('🚀 Subscription Copilot Backend Setup\n');
    
    const envPath = path.join(__dirname, '.env');
    const envExamplePath = path.join(__dirname, '.env.example');
    
    // Check if .env already exists
    if (fs.existsSync(envPath)) {
        const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('Setup cancelled.');
            rl.close();
            return;
        }
    }
    
    console.log('\n📧 Gmail API Setup');
    console.log('Get credentials from: https://console.cloud.google.com\n');
    
    const gmailClientId = await question('Gmail Client ID (or press Enter to skip): ');
    const gmailClientSecret = gmailClientId ? await question('Gmail Client Secret: ') : '';
    
    console.log('\n🏦 Plaid Setup (US Banking)');
    console.log('Get credentials from: https://dashboard.plaid.com\n');
    
    const plaidClientId = await question('Plaid Client ID (or press Enter to skip): ');
    const plaidSecret = plaidClientId ? await question('Plaid Secret: ') : '';
    const plaidEnv = plaidClientId ? await question('Plaid Environment (sandbox/development/production) [sandbox]: ') : 'sandbox';
    
    console.log('\n🇪🇺 Nordigen Setup (EU Banking)');
    console.log('Get credentials from: https://nordigen.com\n');
    
    const nordigenSecretId = await question('Nordigen Secret ID (or press Enter to skip): ');
    const nordigenSecretKey = nordigenSecretId ? await question('Nordigen Secret Key: ') : '';
    
    console.log('\n⚙️ Server Configuration\n');
    
    const port = await question('Server port [3000]: ') || '3000';
    const frontendUrl = await question('Frontend URL [http://localhost:8080]: ') || 'http://localhost:8080';
    const sessionSecret = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    
    // Generate .env file
    const envContent = `# Server
PORT=${port}
NODE_ENV=development
SESSION_SECRET=${sessionSecret}

# Frontend URL (for CORS)
FRONTEND_URL=${frontendUrl}

# Gmail API
GMAIL_CLIENT_ID=${gmailClientId || 'your_gmail_client_id'}
GMAIL_CLIENT_SECRET=${gmailClientSecret || 'your_gmail_client_secret'}
GMAIL_REDIRECT_URI=http://localhost:${port}/api/connect/gmail/callback

# Plaid (US)
PLAID_CLIENT_ID=${plaidClientId || 'your_plaid_client_id'}
PLAID_SECRET=${plaidSecret || 'your_plaid_secret'}
PLAID_ENV=${plaidEnv || 'sandbox'}

# Nordigen (EU)
NORDIGEN_SECRET_ID=${nordigenSecretId || 'your_nordigen_secret_id'}
NORDIGEN_SECRET_KEY=${nordigenSecretKey || 'your_nordigen_secret_key'}

# Database (optional)
# DATABASE_URL=postgresql://user:pass@localhost/subscriptions
`;
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Configuration saved to .env\n');
    
    // Install dependencies
    console.log('📦 Installing dependencies...\n');
    
    const { execSync } = require('child_process');
    try {
        execSync('npm install', { stdio: 'inherit', cwd: __dirname });
        console.log('\n✅ Dependencies installed\n');
    } catch (error) {
        console.error('❌ Failed to install dependencies');
        console.log('Run manually: npm install');
    }
    
    console.log('🎉 Setup complete!\n');
    console.log('Next steps:');
    console.log('1. Configure API keys in .env file');
    console.log('2. Run: npm start');
    console.log('3. Open frontend and connect your accounts\n');
    
    rl.close();
}

setup().catch(console.error);
