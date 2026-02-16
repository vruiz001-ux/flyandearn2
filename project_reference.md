# FlyAndEarn.eu - Complete Project Reference

> **Last Updated:** December 23, 2024  
> **Status:** Ready for Netlify Deployment  
> **Legal Entity:** Tropos Sp. z o.o. (KRS 0000707644)

---

## 📋 Quick Reference

| Item | Value |
|------|-------|
| **Domain** | flyandearn.eu |
| **Business Model** | Service fee marketplace (€20-85 per delivery) |
| **Platform Fee** | 5% of service fee |
| **Target Market** | EU duty-free travelers & buyers |
| **Tech Stack** | HTML/CSS/JS (frontend), Node.js/PostgreSQL (backend) |

---

## 📁 File Locations

### Production-Ready (Netlify)
```
/mnt/user-data/outputs/flyandearn-netlify/
├── index.html          # Main landing page
├── wallet.html         # Wallet dashboard
├── 404.html            # Custom error page
├── favicon.svg         # Site icon
├── og-image.svg        # Social sharing image
├── sitemap.xml         # SEO sitemap
├── robots.txt          # Crawler rules
├── netlify.toml        # Netlify config
├── _redirects          # URL redirects
└── README.md           # Deployment guide
```

### Full Source (with API)
```
/mnt/user-data/outputs/flyandearn-website/
├── index.html          # Main landing page
├── wallet.html         # Wallet dashboard
├── wallet-test.html    # UI test suite
├── logo-concepts.html  # Logo design options
├── favicon.svg
├── og-image.svg
├── sitemap.xml
├── robots.txt
├── README.md
├── api/
│   ├── server.js           # Express API server
│   ├── server.test.js      # Jest tests
│   ├── package.json
│   ├── README.md
│   └── migrations/
│       └── 001_create_wallet_system.sql
└── docs/
    ├── WALLET_SYSTEM_ARCHITECTURE.md    # 122KB full architecture
    └── WALLET_VERIFICATION_CHECKLIST.md # Testing checklist
```

### ZIP Package
```
/mnt/user-data/outputs/flyandearn-netlify.zip
```

---

## 🎨 Brand Guidelines

### Colors
| Name | Hex | Usage |
|------|-----|-------|
| Gold Primary | `#d4a853` | CTAs, highlights, logo |
| Gold Light | `#f0d78c` | Gradients, hover states |
| Teal Accent | `#2dd4bf` | Secondary accent, icons |
| Background | `#0a0a0b` | Main background |
| Card | `#18181b` | Card backgrounds |
| Border | `#27272a` | Borders, dividers |
| Text Primary | `#fafafa` | Main text |
| Text Muted | `#71717a` | Secondary text |

### Typography
- **Primary Font:** Outfit (weights: 300-800)
- **Accent Font:** Playfair Display (headings)

### Logo
- Gold badge with airplane silhouette
- Teal dot trail representing journey
- Text: "Fly&Earn" with gold gradient on "&"

---

## 💰 Wallet System Summary

### Features Implemented
- ✅ Main wallet (EUR balance)
- ✅ Bonus credits (non-withdrawable)
- ✅ Add funds (card, bank, BLIK)
- ✅ Send money (peer-to-peer)
- ✅ Withdraw (SEPA, €0.50 fee)
- ✅ Request money
- ✅ Escrow system (14-day hold)
- ✅ Transaction history with filters
- ✅ Double-entry ledger
- ✅ Idempotency protection
- ✅ Rate limiting

### Transaction Flow
```
Buyer → Escrow Hold → Traveler Delivers → Buyer Confirms → Release
  │                                                           │
  └── €225 total ──────────────────────────────────────────────┘
        ├── €185 product → Traveler
        ├── €38 service fee → Traveler  
        └── €2 platform fee (5% of €40) → Platform
```

### Database Tables
- `users` - User accounts with KYC levels
- `wallets` - Balance tracking (BIGINT cents)
- `transactions` - All money movements
- `ledger_entries` - Double-entry bookkeeping
- `escrow_holds` - Active escrow records
- `audit_log` - Immutable event log

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/wallets` | List user wallets |
| GET | `/api/v1/wallets/:id/balance` | Get balance |
| POST | `/api/v1/wallets/:id/credit` | Add funds |
| POST | `/api/v1/wallets/:id/debit` | Transfer/withdraw |
| GET | `/api/v1/wallets/:id/transactions` | History |
| POST | `/api/v1/escrow` | Create escrow |
| POST | `/api/v1/escrow/:id/release` | Release to seller |
| GET | `/health` | Health check |

---

## 📱 Pages & Sections

### index.html (Landing Page)
1. Hero with value proposition
2. How It Works (3 steps)
3. Browse Requests (sample listings)
4. Categories (Spirits, Perfume, Cosmetics, Electronics, Tobacco)
5. Savings Calculator
6. Trust & Safety section
7. Testimonials
8. FAQ
9. Newsletter signup
10. Footer with legal info

### wallet.html (Dashboard)
1. Header with navigation
2. Sidebar (Overview, Transactions, Escrow, Settings)
3. Main wallet card (balance, available, pending)
4. Bonus wallet card
5. Quick actions (Add, Send, Request, Withdraw)
6. Stats grid (Earned, Deals, Avg Fee)
7. Active escrow section
8. Transaction list with filters

---

## 🚀 Deployment

### Netlify (Current)
1. Drag `flyandearn-netlify/` folder to app.netlify.com/drop
2. Connect custom domain: flyandearn.eu
3. HTTPS enabled automatically

### Future: Full Stack
1. Deploy API to Railway/Render/Fly.io
2. Set up PostgreSQL database
3. Configure environment variables
4. Update frontend to call real API

---

## 📝 Future Enhancements

### Phase 1 (MVP)
- [ ] User authentication (email/password)
- [ ] Real payment integration (Stripe)
- [ ] Email notifications
- [ ] Deal matching system

### Phase 2
- [ ] Mobile app (React Native)
- [ ] Real-time chat
- [ ] Push notifications
- [ ] Multi-language (Polish)

### Phase 3
- [ ] Loyalty points system
- [ ] Multi-currency support
- [ ] External payouts (Wise, PayPal)
- [ ] Partner API

---

## 🔒 Compliance Checklist

- [x] GDPR cookie consent
- [x] Privacy policy link
- [x] Terms of service link
- [x] Company registration displayed
- [x] EU customs allowance disclaimer
- [ ] KYC provider integration
- [ ] AML monitoring
- [ ] PSD2 compliance (if needed)

---

## 📞 Contact Information

**Company:** Tropos Sp. z o.o.  
**Address:** ul. Stanisława Moniuszki 16, 65-409 Zielona Góra, Poland  
**KRS:** 0000707644  
**Email:** reklamacje@tropos.pl  
**Website:** flyandearn.eu

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Dec 23, 2024 | Initial release with landing page |
| 1.1.0 | Dec 23, 2024 | Added wallet dashboard |
| 1.2.0 | Dec 23, 2024 | Added API & database schema |
| 1.3.0 | Dec 23, 2024 | Netlify deployment package |

---

*This document is the single source of truth for the FlyAndEarn.eu project.*
