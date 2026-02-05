# 💰 Subscription Copilot Pro

A beautiful, functional subscription management app that helps you track, analyze, and optimize your recurring expenses.

## ✨ Features

### Currently Working
- ✅ **Manual subscription tracking** - Add/edit/delete subscriptions
- ✅ **Dashboard analytics** - Monthly/annual costs, active count, potential savings
- ✅ **Smart suggestions** - Auto-detect expensive subscriptions and savings opportunities
- ✅ **CSV import** - Auto-detect subscriptions from bank statements
- ✅ **JSON import/export** - Backup and restore your data
- ✅ **Local storage** - All data saved in your browser
- ✅ **Notes** - Add context to each subscription
- ✅ **Billing reminders** - See days until next charge

### Import Methods
1. **JSON File** - Restore from backup
2. **CSV/Bank Statement** - Auto-detect recurring charges
3. **Email** - (UI ready, needs backend integration)
4. **Bank Account** - (UI ready, needs backend integration)

### Auto-Detection
The app can auto-detect these services from CSV files:
- Netflix, Spotify, Apple Music/TV/One
- YouTube Premium, Disney+, HBO Max, Amazon Prime
- Dropbox, Google One, iCloud+
- Microsoft 365, Adobe Creative Cloud
- GitHub, Notion
- And more...

## 🚀 Getting Started

### Option 1: Quick Start (Manual)
1. Click **"+ Add Manual"**
2. Enter your subscription details
3. Save and watch your dashboard update

### Option 2: CSV Import (Recommended)
1. Download your bank statement as CSV
2. Click **"📥 Import"** → **"CSV/Bank Statement"**
3. Upload the file
4. Review auto-detected subscriptions

### Option 3: JSON Import (Restore Backup)
1. Click **"📥 Import"** → **"JSON File"**
2. Select your backup file
3. All subscriptions restored instantly

## 📊 CSV Format

Your bank CSV should contain transaction descriptions. The app will automatically detect subscription patterns like:

```csv
Date,Description,Amount
2024-01-15,NETFLIX.COM,12.99
2024-01-20,Spotify Premium,9.99
2024-02-15,NETFLIX.COM,12.99
```

## 🔗 Account Connections (Coming Soon)

The UI is ready for:

### Email Integration (Planned)
- **Gmail API** - Scan receipts from inbox
- **Outlook/iCloud/Yahoo** - Multi-provider support
- Auto-extract subscription details from receipts

### Bank Integration (Planned)
- **Plaid** (US) - Secure bank connection
- **Nordigen** (EU) - European banking integration
- Real-time transaction monitoring
- Auto-detect new subscriptions

### What's Needed for Full Integration:
1. Backend server (Node.js/Python)
2. API keys:
   - Gmail API credentials
   - Plaid/Nordigen API keys
3. OAuth flow implementation
4. Database for persistent storage (optional - currently using localStorage)

## 💡 Smart Features

### Auto-Suggestions
- **High cost alert** - Subscriptions >€50/month
- **Savings tip** - Switch to yearly billing (save ~16%)
- **Usage review** - Identify unused subscriptions

### Analytics
- Monthly total calculation
- Annual projection
- Potential savings estimate
- Days until next billing

## 📱 Export

Click **"📤 Export"** to download a JSON backup:
```json
[
  {
    "id": "1234567890",
    "name": "Netflix",
    "price": 12.99,
    "currency": "€",
    "billing": "monthly",
    "category": "Entertainment",
    "nextBilling": "2024-03-15",
    "notes": "Premium plan",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

## 🔒 Privacy & Security

- **100% local storage** - Your data never leaves your browser
- **No account required** - Works offline after first load
- **Export anytime** - Full control over your data
- **Future integrations** - Will use encrypted OAuth flows

## 🚧 Roadmap

### Phase 1 (Current)
- [x] Manual entry
- [x] Dashboard analytics
- [x] CSV import with auto-detection
- [x] JSON backup/restore
- [x] Smart suggestions

### Phase 2 (In Progress)
- [ ] Backend integration
- [ ] Email connection (Gmail API)
- [ ] Bank connection (Plaid/Nordigen)
- [ ] Real-time sync

### Phase 3 (Planned)
- [ ] Mobile app (PWA)
- [ ] Multi-currency support
- [ ] Spending trends graph
- [ ] Bill negotiation assistant
- [ ] Alternative service suggestions

## 🛠️ Technical Stack

**Frontend (Current)**
- Pure HTML/CSS/JavaScript
- No dependencies
- LocalStorage for persistence
- Responsive design

**Backend (Planned)**
- Node.js + Express
- PostgreSQL (optional)
- Gmail API SDK
- Plaid/Nordigen SDK
- OAuth 2.0

## 📝 Notes

- All data is stored in your browser's localStorage
- Clear your browser data will erase subscriptions (export regularly!)
- CSV detection works best with English transaction descriptions
- For production use, deploy with HTTPS for security

## 🔧 Local Development

Just open `index.html` in your browser. No build step required!

For backend integration, you'll need to set up:
1. API server (example in `/backend` folder - coming soon)
2. Environment variables for API keys
3. CORS configuration
4. OAuth redirect URIs

## 📄 License

MIT - Feel free to use, modify, and distribute!

---

**Made with ❤️ for better subscription management**
