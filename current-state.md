# FlyAndEarn - Current State Analysis

**Date:** 2026-01-18
**Auditor:** Senior Full-Stack Engineer + Product QA Lead

---

## Executive Summary

FlyAndEarn is a peer-to-peer duty-free marketplace connecting travelers with buyers within EU legal allowances. The platform is built on Netlify Functions (serverless Node.js) with PostgreSQL/Prisma and Stripe payments.

**Overall Status:** Core functionality implemented, Admin UI missing, several UX gaps

---

## 1. What Exists and Works

### Authentication & Profiles
- [x] JWT-based auth with HTTP-only cookies (7-day expiry)
- [x] Registration with role selection (Buyer/Traveler or both)
- [x] Login/logout flows
- [x] Profile CRUD (name, phone, address, country)
- [x] Password hashing (bcrypt, 12 rounds)
- [x] Input sanitization (XSS protection)

### Marketplace Core
- [x] **Trips:** Travelers can create/edit/delete trips with dates, routes, capacity
- [x] **Requests:** Buyers can create multi-item requests (duty-free + outside duty-free)
- [x] **Offers:** Travelers can make offers on requests
- [x] **Messaging:** Conversation system between buyer and traveler
- [x] **Ratings:** Post-delivery rating system (4 criteria + feedback)

### Payments & Escrow
- [x] Stripe Payment Intent creation
- [x] Double-entry ledger wallet system
- [x] Three account types per user (AVAILABLE, PENDING, FROZEN)
- [x] Fee calculation: 5% platform + 15-20% traveler service fee
- [x] Webhook handling for payment_intent.succeeded/failed
- [x] Dispute handling (freeze/unfreeze)
- [x] Refund processing

### Subscriptions
- [x] Three tiers: Silver (5 purchases), Gold (10), Platinum (unlimited)
- [x] EUR/PLN pricing
- [x] Stripe Checkout integration
- [x] Purchase limit enforcement

### Admin (API Only)
- [x] Admin wallet stats
- [x] Pending payouts management
- [x] Dispute resolution endpoints
- [x] Subscription management endpoints
- [x] Wallet freeze/unfreeze

### Frontend
- [x] Landing page with hero, features, calculator
- [x] Dashboard with sidebar navigation
- [x] Wallet page
- [x] Pricing page
- [x] Privacy/Terms pages
- [x] i18n (EN, PL, FR, DE)
- [x] PWA manifest

### Testing
- [x] 102 unit tests (Jest)
- [x] 37 E2E tests (Playwright)
- [x] Load testing config (Artillery)

---

## 2. What is Missing/Broken

### Critical Missing Features
| Feature | Status | Priority |
|---------|--------|----------|
| Admin UI Dashboard | NOT IMPLEMENTED | P0 |
| Email verification | NOT IMPLEMENTED | P0 |
| Password reset | NOT IMPLEMENTED | P0 |
| Auto-release escrow cron | NOT IMPLEMENTED | P0 |
| Audit log for admin actions | NOT IMPLEMENTED | P1 |

### UX Gaps
| Issue | Status | Priority |
|-------|--------|----------|
| No notifications (email/push) | Missing | P1 |
| Payout method onboarding UI | Missing | P1 |
| Dispute workflow UI | Missing | P2 |
| FAQ page | Missing | P2 |
| Contact form | Missing | P2 |
| Mobile responsiveness issues | Partial | P2 |

### UI Issues Found
| Page | Issue | Severity |
|------|-------|----------|
| Dashboard | Sidebar overlaps on tablet | Medium |
| Dashboard | Request form long on mobile | Medium |
| Wallet | Transaction list not scrollable | Low |
| Index | Calculator widget alignment | Low |

---

## 3. Highest-Risk Gaps

### Security Risks

1. **No Email Verification (P0)**
   - Risk: Fake accounts, spam requests
   - Impact: Platform abuse, reputation damage
   - Fix: Add verification token flow + email sending

2. **No Password Reset (P0)**
   - Risk: Users permanently locked out
   - Impact: User churn, support burden
   - Fix: Add forgot password + reset token flow

3. **No Rate Limiting on Auth (P1)**
   - Risk: Brute force attacks
   - Impact: Account compromise
   - Fix: Add rate limiting middleware

4. **No Audit Log (P1)**
   - Risk: No accountability for admin actions
   - Impact: Compliance issues, dispute resolution
   - Fix: Create AuditLog model and logging

### Financial Risks

1. **No Auto-Release Cron (P0)**
   - Risk: Funds stuck in escrow indefinitely
   - Impact: Traveler complaints, legal issues
   - Fix: Implement scheduled function or admin trigger

2. **No Admin UI (P0)**
   - Risk: Cannot operate platform without developer
   - Impact: Operational bottleneck
   - Fix: Build comprehensive admin dashboard

### Business Risks

1. **No Notifications (P1)**
   - Risk: Users miss critical updates
   - Impact: Failed transactions, poor UX
   - Fix: Add email notifications for key events

2. **No FAQ (P2)**
   - Risk: Support burden, user confusion
   - Impact: Lower conversion
   - Fix: Add FAQ page with common questions

---

## 4. Code Locations Reference

### Backend (netlify/functions/)
```
Authentication:
  - login.js          # Email/password login
  - register.js       # User registration
  - logout.js         # Session cleanup
  - me.js             # Current user info
  - lib/auth.js       # JWT/cookie utilities

Core:
  - requests.js       # Request CRUD + offers
  - trips.js          # Trip CRUD
  - messages.js       # Conversation system
  - ratings.js        # Rating submission
  - profile.js        # Profile updates

Financial:
  - orders.js         # Order creation/completion
  - wallet.js         # Wallet & ledger operations
  - stripe-webhook.js # Payment webhooks
  - subscriptions.js  # Subscription management

Admin:
  - admin-wallet.js   # Wallet admin ops
  - admin-subscriptions.js # Subscription admin

Shared:
  - lib/prisma.js     # DB client
  - lib/subscription.js # Fee calculations
  - lib/fx.js         # Currency conversion
```

### Frontend
```
Pages:
  - index.html        # Landing page
  - dashboard.html    # User dashboard
  - wallet.html       # Wallet management
  - pricing.html      # Subscription plans
  - privacy.html      # Privacy policy
  - terms.html        # Terms of service

JavaScript:
  - app.js            # Main application logic
  - i18n.js           # Translations
  - currencies.js     # Currency data
  - airports.js       # Airport list
```

### Database
```
prisma/schema.prisma  # All models defined here
```

---

## 5. Environment Requirements

```env
DATABASE_URL=postgresql://...
JWT_SECRET=32+ character secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
ADMIN_EMAILS=admin@example.com
URL=https://flyandearn.eu
NODE_ENV=production
```

---

## 6. Recommended Priority Order

### Phase 1: Launch Blockers (P0)
1. Admin UI Dashboard
2. Email verification
3. Password reset
4. Auto-release escrow mechanism

### Phase 2: Core Improvements (P1)
1. Audit logging
2. Email notifications
3. Payout method onboarding
4. Rate limiting

### Phase 3: Polish (P2)
1. Mobile responsiveness fixes
2. FAQ page
3. Contact form
4. Dispute workflow UI

---

## 7. Test Status

| Suite | Tests | Status |
|-------|-------|--------|
| Unit (Jest) | 102 | PASS |
| E2E (Playwright) | 37 | PASS |
| Load (Artillery) | - | PASS (18 req/s, 0 failures) |
| Lint | - | PASS |
| Build | - | PASS |

---

*Generated: 2026-01-18*
