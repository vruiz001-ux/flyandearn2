# FlyAndEarn - Functionality Checklist

**Date:** 2026-01-18 (Updated)

Legend: ✅ Complete | ⚠️ Partial | ❌ Missing | 🔧 Needs Fix

---

## A) Public/Marketing Pages

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Landing page | ✅ | `index.html` | Hero, features, calculator, testimonials |
| How it works | ✅ | `index.html#how-it-works` | 4-step process |
| Pricing page | ✅ | `pricing.html` | 3 tiers, currency toggle |
| FAQ page | ✅ | `faq.html` | **IMPLEMENTED** - Accordion UI |
| Privacy policy | ✅ | `privacy.html` | GDPR compliant |
| Terms of service | ✅ | `terms.html` | Complete |
| Contact form | ✅ | `contact.html` | **IMPLEMENTED** - Full form with validation |
| Cookie consent | ✅ | `index.html` | Banner implemented |
| SEO meta tags | ⚠️ | All HTML | Basic tags, could improve |

---

## B) Authentication & Profiles

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| User registration | ✅ | `register.js` | Email, password, name, roles |
| Login | ✅ | `login.js` | JWT + HTTP-only cookie, ban check |
| Logout | ✅ | `logout.js` | Clears session |
| Email verification | ✅ | `email-verification.js` | **IMPLEMENTED** - Send/verify flow |
| Password reset | ✅ | `password-reset.js` | **IMPLEMENTED** - Full flow |
| Profile view | ✅ | `me.js` | Returns user data + verification status |
| Profile edit | ✅ | `profile.js` | Name, phone, address, country |
| Role: Buyer | ✅ | `User.isBuyer` | Can create requests |
| Role: Traveler | ✅ | `User.isTraveler` | Can create trips/offers |
| Role: Admin | ✅ | `ADMIN_EMAILS` env | **IMPLEMENTED** - Full admin UI |
| Dual roles | ✅ | Schema | User can be both buyer+traveler |
| User ban/unban | ✅ | `admin-users.js` | **IMPLEMENTED** - Admin can ban |
| Address management | ⚠️ | `User` model | Single address only |
| ID verification | ❌ | - | Not implemented (future KYC) |

---

## C) Core Marketplace Flows

### C1. Request Management (Buyer)

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Create request | ✅ | `requests.js:handlePost` | Multi-item support |
| Duty-free items | ✅ | `RequestItem.itemSource` | DUTY_FREE type |
| Outside duty-free | ✅ | `RequestItem.itemSource` | OUTSIDE_DUTY_FREE type |
| Mixed requests | ✅ | `RequestType.BOTH` | Both item types |
| Item details | ✅ | `RequestItem` model | Name, qty, budget, notes, brand |
| Store URL/name | ✅ | `RequestItem.storeUrl/storeName` | For non-duty-free |
| Max price setting | ✅ | `Request.maxPrice` | Budget cap |
| Needed by date | ✅ | `Request.neededBy` | Deadline field |
| View requests | ✅ | `requests.js:handleGet` | List/filter |
| Edit request | ⚠️ | `requests.js:handlePut` | Limited fields |
| Cancel request | ✅ | `admin-requests.js` | Admin cancellation available |
| Request status | ✅ | `RequestStatus` enum | OPEN→MATCHED→IN_PROGRESS→COMPLETED |

### C2. Trip Management (Traveler)

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Create trip | ✅ | `trips.js:handlePost` | Dates, route, capacity |
| From/To airports | ✅ | `Trip` model | Airport codes + city names |
| Departure/return dates | ✅ | `Trip.departureDate/returnDate` | DateTime fields |
| Available capacity | ✅ | `Trip.availableKg` | Weight in kg |
| Categories | ✅ | `Trip.categories` | Array: spirits, perfume, etc |
| Notes | ✅ | `Trip.note` | Traveler notes |
| Edit trip | ✅ | `trips.js:handlePut` | All fields editable |
| Delete trip | ✅ | `trips.js:handleDelete` | Soft delete (status) |
| View trips | ✅ | `trips.js:handleGet` | List/filter by city |

### C3. Offer System

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Make offer | ✅ | `requests.js:handlePut (action=offer)` | Traveler→Request |
| Offer message | ✅ | `Offer.message` | Why they can fulfill |
| View offers | ✅ | `requests.js:handleGet` | Included in request |
| Accept offer | ✅ | `requests.js:handlePut (action=accept)` | Updates status |
| Decline offer | ⚠️ | - | Not explicit endpoint |
| Duplicate prevention | ✅ | `@@unique([requestId, travelerId])` | One offer per traveler |

### C4. Messaging

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Create conversation | ✅ | `messages.js` | Buyer↔Traveler per trip |
| Send message | ✅ | `messages.js:handlePost` | Text message |
| List conversations | ✅ | `messages.js:handleGet` | User's conversations |
| Get messages | ✅ | `messages.js` | Messages in conversation |
| Mark as read | ✅ | `messages.js:handlePut` | read=true |
| Unread count | ⚠️ | - | Not explicit endpoint |
| Real-time updates | ❌ | - | Polling only, no WebSocket |

### C5. Delivery & Completion

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Confirm delivery | ✅ | `orders.js:completeOrder` | Buyer confirms |
| Release funds | ✅ | `wallet.js:postLedgerEntry` | PENDING→AVAILABLE |
| Auto-release | ✅ | `scheduled-auto-release.js` | **IMPLEMENTED** - 14-day auto |
| Status milestones | ⚠️ | `OrderStatus` | No detailed tracking |
| Delivery proof | ❌ | - | No file upload |

### C6. Dispute Handling

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Open dispute | ✅ | `orders.js:disputeOrder` | Buyer initiates |
| Freeze funds | ✅ | `wallet.js` | PENDING→FROZEN |
| Admin review | ✅ | `admin-wallet.js` | API endpoint |
| Resolve dispute | ✅ | `admin-wallet.js:resolveDispute` | Winner decided |
| Dispute UI | ❌ | - | Needs creation |

---

## D) Payments & Escrow

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Payment intent | ✅ | `orders.js:createOrder` | Stripe PaymentIntent |
| Fee calculation | ✅ | `lib/subscription.js` | 5% platform + 15-20% service |
| Escrow hold | ✅ | `wallet.js` | PENDING account |
| Escrow release | ✅ | `orders.js:completeOrder` | On buyer confirmation |
| Auto-release (14 days) | ✅ | `scheduled-auto-release.js` | **IMPLEMENTED** |
| Refunds | ✅ | `stripe-webhook.js` + `admin-orders.js` | **Enhanced** |
| Chargebacks | ✅ | `stripe-webhook.js` | charge.dispute handlers |
| Transaction ledger | ✅ | `LedgerEntry` model | Double-entry system |
| Currency support | ✅ | EUR, PLN | FX conversion |
| Payout requests | ✅ | `wallet.js:requestWithdrawal` | User initiates |
| Payout processing | ✅ | `admin-wallet.js:processPayout` | Admin triggers |
| Payout method setup | ⚠️ | `PayoutMethod` model | No Stripe Connect UI |

---

## E) Subscriptions

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| View plans | ✅ | `subscriptions.js:getPlans` | 3 tiers |
| Subscribe (checkout) | ✅ | `subscriptions.js:createCheckout` | Stripe Checkout |
| Subscription status | ✅ | `Subscription` model | ACTIVE/EXPIRED/CANCELLED |
| Purchase limits | ✅ | `lib/subscription.js:canUserPurchase` | Per-tier enforcement |
| Track usage | ✅ | `Subscription.purchasesUsed` | Increment on order |
| Renewal handling | ✅ | `stripe-webhook.js` | invoice.payment_succeeded |
| Cancellation | ✅ | `stripe-webhook.js` | customer.subscription.deleted |
| Plan management | ✅ | `admin-subscriptions.js` | Admin endpoints |

---

## F) Notifications

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Email notifications | ⚠️ | - | Framework ready, needs email service |
| New request alert | ❌ | - | |
| Offer received | ❌ | - | |
| Offer accepted | ❌ | - | |
| Payment received | ❌ | - | |
| Delivery confirmed | ❌ | - | |
| Dispute opened | ❌ | - | |
| Push notifications | ❌ | - | Future feature |
| SMS | ❌ | - | Not planned |

---

## G) Admin & Operations

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Admin authentication | ✅ | `ADMIN_EMAILS` env | Email whitelist |
| **Admin UI** | ✅ | `admin.html` | **IMPLEMENTED** - Full dashboard |

### G1. Users Admin

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| List users | ✅ | `admin-users.js` | **IMPLEMENTED** |
| Search users | ✅ | `admin-users.js` | **IMPLEMENTED** |
| View user details | ✅ | `admin-users.js` | **IMPLEMENTED** |
| User statistics | ✅ | `admin-users.js` | **IMPLEMENTED** |
| Subscription status | ✅ | Via admin-users | Included in user data |
| Ban user | ✅ | `admin-users.js` | **IMPLEMENTED** |
| Unban user | ✅ | `admin-users.js` | **IMPLEMENTED** |

### G2. Requests Admin

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| List requests | ✅ | `admin-requests.js` | **IMPLEMENTED** |
| Filter by status | ✅ | `admin-requests.js` | **IMPLEMENTED** |
| View request details | ✅ | `admin-requests.js` | **IMPLEMENTED** |
| Request statistics | ✅ | `admin-requests.js` | **IMPLEMENTED** |
| Cancel request | ✅ | `admin-requests.js` | **IMPLEMENTED** |

### G3. Orders Admin

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| List orders | ✅ | `admin-orders.js` | **IMPLEMENTED** |
| Order statistics | ✅ | `admin-orders.js` | **IMPLEMENTED** |
| View order details | ✅ | `admin-orders.js` | **IMPLEMENTED** |
| Refund order | ✅ | `admin-orders.js` | **IMPLEMENTED** |
| Force complete | ✅ | `admin-orders.js` | **IMPLEMENTED** |
| Trigger auto-release | ✅ | `admin-orders.js` | **IMPLEMENTED** |

### G4. Escrow Admin

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Escrow ledger | ✅ | `admin-wallet.js` | Via admin UI |
| Hold/release states | ✅ | WalletAccount types | Visible in UI |
| Manual actions | ✅ | `admin-wallet.js` | Via admin UI |

### G5. Subscriptions Admin

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Plans list | ✅ | `admin-subscriptions.js` | Via admin UI |
| Active subscriptions | ✅ | `admin-subscriptions.js` | Via admin UI |
| Cancel subscription | ✅ | `admin-subscriptions.js` | Via admin UI |
| Extend subscription | ⚠️ | - | Manual DB only |

### G6. Audit Log

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| AuditLog model | ✅ | `schema.prisma` | **IMPLEMENTED** |
| Log admin actions | ✅ | All admin functions | **IMPLEMENTED** |
| View audit trail | ✅ | `admin-audit.js` | **IMPLEMENTED** - With filters |

---

## H) Compliance & Security

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| Rate limiting | ❌ | - | Needs implementation |
| CSRF protection | ✅ | SameSite=Strict | Cookies |
| XSS prevention | ✅ | sanitize() | Input cleaning |
| SQL injection | ✅ | Prisma ORM | Parameterized |
| Secure cookies | ✅ | HttpOnly, Secure | |
| PII protection | ⚠️ | - | Some logging concerns |
| Security headers | ✅ | netlify.toml | CSP, HSTS, etc |
| Webhook verification | ✅ | stripe-webhook.js | Signature check |
| Audit logging | ✅ | `AuditLog` model | **IMPLEMENTED** |

---

## Summary (Updated)

| Category | Complete | Partial | Missing |
|----------|----------|---------|---------|
| A. Public/Marketing | 7 | 1 | 0 |
| B. Auth & Profiles | 11 | 1 | 1 |
| C. Marketplace | 28 | 5 | 3 |
| D. Payments | 11 | 1 | 0 |
| E. Subscriptions | 7 | 0 | 0 |
| F. Notifications | 0 | 1 | 6 |
| G. Admin | 19 | 1 | 0 |
| H. Security | 6 | 1 | 1 |

**Remaining Priority Work:**
1. **P1 (Core):** Email service integration, Rate limiting
2. **P2 (Polish):** Real-time notifications, Dispute UI
3. **P3 (Future):** KYC/ID verification, File uploads, Push notifications

---

*Updated: 2026-01-18*
