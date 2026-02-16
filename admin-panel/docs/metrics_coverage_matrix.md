# Metrics Coverage Matrix - FlyAndEarn Admin Panel

## Audit Summary

**Audit Date:** 2026-01-18
**Auditor:** Principal Engineer / Product Analytics Lead
**Status:** Phase A Complete - Gaps Identified

### Coverage Legend
- **Complete**: Metric fully implemented with data source and UI
- **Partial**: Metric exists but missing components (e.g., no UI, incomplete calculation)
- **Missing**: Metric not implemented - requires schema/code changes
- **N/A**: Not applicable to this business model

---

## 1. ACQUISITION / TRAFFIC

| Metric | Calculation | Data Source | Admin Location | Status | Priority |
|--------|-------------|-------------|----------------|--------|----------|
| Total Visits | COUNT(events WHERE type=PAGEVIEW) per period | DailyStats.totalVisits | Dashboard, Visitors | **Complete** | - |
| Unique Visitors | COUNT(DISTINCT sessionId) per period | DailyStats.uniqueVisitors | Dashboard, Visitors | **Complete** | - |
| Pageviews | COUNT(events WHERE type=PAGEVIEW) | DailyStats.pageviews | Dashboard, Visitors | **Complete** | - |
| Source/Medium Breakdown | GROUP BY referrer domain | Event.referrer | - | **Missing** | High |
| Landing Pages Performance | GROUP BY path for first pageview per session | Event.path + sessionId | - | **Missing** | Medium |
| Bounce Rate Proxy | Sessions with 1 pageview / total sessions | Event analysis | - | **Missing** | Medium |
| Geo Distribution | GROUP BY country | Event.country | Dashboard | **Complete** | - |
| Device Breakdown | GROUP BY device_type | Event (missing field) | - | **Missing** | High |
| Visitor → Signup Rate | (signups / unique visitors) * 100 | User.createdAt / DailyStats | - | **Missing** | High |
| Visitor → Request Rate | (requests / unique visitors) * 100 | Request.createdAt / DailyStats | - | **Missing** | Medium |
| Visitor → Subscription Rate | (subscriptions / unique visitors) * 100 | Subscription (missing) / DailyStats | - | **Missing** | Critical |

---

## 2. ACTIVATION / ONBOARDING

| Metric | Calculation | Data Source | Admin Location | Status | Priority |
|--------|-------------|-------------|----------------|--------|----------|
| New Registrations (Daily) | COUNT(users) WHERE createdAt in period | User.createdAt | Dashboard | **Complete** | - |
| New Registrations (Weekly/Monthly) | Aggregate of daily | User.createdAt | - | **Partial** | Low |
| Profile Completion Rate | Users with name+address / total users | User fields | - | **Missing** | Medium |
| Verification Completion Rate | emailVerified / total users | User.emailVerified | Dashboard (partial) | **Partial** | Medium |
| Time to First Request | AVG(first_request.createdAt - user.createdAt) | Request + User | - | **Missing** | Medium |
| Time to First Match Acceptance | AVG(first_match.createdAt - user.createdAt) | Match + User | - | **Missing** | Medium |

---

## 3. MARKETPLACE / CORE OPERATIONS

| Metric | Calculation | Data Source | Admin Location | Status | Priority |
|--------|-------------|-------------|----------------|--------|----------|
| Requests Created (Volume) | COUNT(requests) per period | Request.createdAt | Dashboard, Requests | **Complete** | - |
| Requests by Category | GROUP BY category | Request.category | Requests (filter) | **Partial** | Low |
| Requests by Destination | GROUP BY deliveryCountry | Request.deliveryCountry | - | **Missing** | Medium |
| Open vs Accepted vs Completed | GROUP BY status | Request.status | Dashboard | **Complete** | - |
| Cancelled Requests | COUNT WHERE status=CANCELLED | Request.status | - | **Partial** | Low |
| Match Acceptance Count | COUNT(matches WHERE status=ACCEPTED) | Match.status | Dashboard, Matches | **Complete** | - |
| Acceptance Rate | accepted / total matches | Match.status | Dashboard | **Complete** | - |
| Median Time-to-Accept | MEDIAN(match.createdAt - request.publishedAt) | Match + Request | - | **Missing** | High |
| Median Time-to-Complete | MEDIAN(match.completedAt - match.createdAt) | Match timestamps | - | **Missing** | High |
| Completion Rate by Category | completed / total per category | Match + Request.category | - | **Missing** | Medium |
| Completion Rate by Destination | completed / total per destination | Match + Request.deliveryCountry | - | **Missing** | Medium |
| Drop-off Reasons | Cancellation reason tracking | Request (missing field) | - | **Missing** | Low |
| Traveller Accepts/Day | AVG accepts per traveller per day | Match per traveller | - | **Missing** | Medium |
| Traveller Completion % | completed / accepted per traveller | Match per traveller | - | **Missing** | Medium |
| Traveller Cancellation % | cancelled / accepted per traveller | Match per traveller | - | **Missing** | Medium |

---

## 4. FINANCIAL / WALLET

| Metric | Calculation | Data Source | Admin Location | Status | Priority |
|--------|-------------|-------------|----------------|--------|----------|
| GMV | SUM(match.agreedPrice) WHERE completed | Match.agreedPrice | Dashboard | **Complete** | - |
| Platform Fees | SUM(match.platformFee) WHERE completed | Match.platformFee | Dashboard | **Complete** | - |
| Net Revenue | Platform Fees - Refunds | Match + Dispute | - | **Partial** | Medium |
| Total Wallet Balances | SUM(wallet.balance) | Wallet.balance | Dashboard, Wallet | **Complete** | - |
| Total Liabilities | Total Balance + Hold Balance | Wallet | - | **Partial** | Medium |
| Pending Holds | SUM(wallet.holdBalance) | Wallet.holdBalance | Dashboard | **Complete** | - |
| Transactions by Type | GROUP BY type | WalletTransaction.type | Wallet | **Complete** | - |
| Payout Success Rate | completed / total payouts | WalletTransaction | - | **Missing** | High |
| Payout Delays | AVG(completedAt - createdAt) for payouts | WalletTransaction | - | **Missing** | Medium |
| Failed Payouts Reasons | GROUP BY failure reason | WalletTransaction (missing field) | - | **Missing** | Medium |
| Refund Count | COUNT(disputes with refund) | Dispute.refundAmount | Dashboard | **Partial** | Low |
| Refund Amount | SUM(refundAmount) | Dispute.refundAmount | Dashboard | **Complete** | - |
| Dispute Resolution Time | AVG(resolvedAt - createdAt) | Dispute | - | **Missing** | Medium |

---

## 5. SUBSCRIPTION PLANS (CRITICAL GAP)

| Metric | Calculation | Data Source | Admin Location | Status | Priority |
|--------|-------------|-------------|----------------|--------|----------|
| Plan List | All plans with pricing | Plan (missing table) | - | **Missing** | Critical |
| Active Subscribers | COUNT(subscriptions WHERE active) | Subscription (missing) | - | **Missing** | Critical |
| New Subscriptions | COUNT per period | Subscription.createdAt | - | **Missing** | Critical |
| Cancellations | COUNT WHERE status=cancelled | Subscription.status | - | **Missing** | Critical |
| Churn Rate | (cancelled / active at start) * 100 | Subscription | - | **Missing** | Critical |
| Trial Starts | COUNT WHERE trialStart is set | Subscription.trialStart | - | **Missing** | Critical |
| Trial Conversion Rate | (converted / trial starts) * 100 | Subscription | - | **Missing** | Critical |
| MRR | SUM(plan.monthlyPrice) for active subs | Subscription + Plan | - | **Missing** | Critical |
| ARR | MRR * 12 | Calculated | - | **Missing** | Critical |
| Expansion MRR | Revenue from upgrades | Subscription history | - | **Missing** | High |
| Contraction MRR | Revenue lost from downgrades | Subscription history | - | **Missing** | High |
| Cohort Retention (Week 1/4/8) | % still active at week N | Subscription.createdAt | - | **Missing** | High |
| LTV Estimate | ARPU / churn rate | Calculated | - | **Missing** | High |
| Revenue by Plan | SUM per plan | Subscription + Plan | - | **Missing** | Critical |
| ARPU | Total revenue / active subscribers | Calculated | - | **Missing** | High |
| Subscription Funnel | visit→signup→plan_view→checkout→subscribed | Events | - | **Missing** | Critical |

---

## 6. CUSTOMER SUPPORT / MESSAGING

| Metric | Calculation | Data Source | Admin Location | Status | Priority |
|--------|-------------|-------------|----------------|--------|----------|
| Conversations Created | COUNT(conversations) | Conversation | Dashboard | **Complete** | - |
| Messages per Day | COUNT(messages) / days | Message + period | Dashboard | **Complete** | - |
| Median Response Time (Overall) | MEDIAN(reply.createdAt - original.createdAt) | Message analysis | - | **Missing** | High |
| Median Response Time (Traveller) | Per role | Message + User.role | - | **Missing** | Medium |
| Median Response Time (Requester) | Per role | Message + User.role | - | **Missing** | Medium |
| Unanswered Threads | Conversations with last message > 24h unread | Conversation + Message | - | **Missing** | High |
| Abuse Flags/Reports | COUNT(reports) | Report (missing table) | - | **Missing** | Low |

---

## 7. SYSTEM HEALTH / OPS

| Metric | Calculation | Data Source | Admin Location | Status | Priority |
|--------|-------------|-------------|----------------|--------|----------|
| Admin Error Rate | Errors / total requests | Application logs | - | **Missing** | Medium |
| Public Error Rate | Errors / total requests | Application logs | - | **Missing** | Medium |
| P95 Latency (Key Endpoints) | Percentile calculation | Request timing (missing) | - | **Missing** | Low |
| Daily Event Ingestion Health | Events per day vs expected | Event.createdAt | - | **Missing** | High |
| Last Event Timestamp | MAX(createdAt) | Event | - | **Missing** | Medium |
| Missing Fields Rate | % of events with null required fields | Event analysis | - | **Missing** | Medium |

---

## Gap Summary

### Critical Gaps (Must Fix)
1. **Plan/Subscription Schema Missing** - No tables for subscription tracking
2. **Subscription Events Missing** - No event types for plan_view, checkout, subscribe, cancel
3. **MRR/ARR/Churn Metrics Missing** - Core SaaS metrics unavailable
4. **Device Tracking Missing** - No mobile vs desktop breakdown

### High Priority Gaps
1. Conversion rate funnels (visitor→signup→request→subscription)
2. Median time-to-accept and time-to-complete
3. Payout success rate and failure tracking
4. Response time metrics for messaging
5. Unanswered threads tracking
6. Source/medium breakdown
7. Event ingestion health monitoring

### Schema Changes Required
1. Add `Plan` table with pricing tiers
2. Add `Subscription` table with lifecycle tracking
3. Add `device` field to Event table
4. Add `failureReason` field to WalletTransaction
5. Add `cancelReason` field to Request
6. Add new EventTypes for subscription funnel

### New API Endpoints Required
1. `GET /api/admin/subscriptions` - Subscription list and metrics
2. `GET /api/admin/subscriptions/analytics` - MRR, churn, cohorts
3. `GET /api/admin/metrics/funnels` - Conversion funnels
4. `GET /api/admin/metrics/health` - System health dashboard
5. `GET /api/admin/analytics/sources` - Traffic source breakdown

### New Admin UI Pages Required
1. Plans Analytics page (MRR chart, churn, retention cohorts)
2. Funnels page (conversion visualization)
3. Data Quality widget on dashboard
4. Metrics Coverage Status page

---

## Acceptance Criteria

| Area | Criteria | Target |
|------|----------|--------|
| Acquisition | All traffic metrics tracked with source/device | 100% coverage |
| Activation | Profile and verification rates visible | 100% coverage |
| Marketplace | Time metrics and completion rates by segment | 100% coverage |
| Financial | Payout health and net revenue calculated | 100% coverage |
| Subscriptions | MRR, churn, trial conversion, cohort retention | 100% coverage |
| Support | Response times and unanswered thread alerts | 100% coverage |
| System | Event health and error monitoring | 100% coverage |

---

## Implementation Priority Order

1. **Week 1**: Plan/Subscription schema + core subscription metrics
2. **Week 1**: Add missing EventTypes and device tracking
3. **Week 2**: Subscription analytics API and UI
4. **Week 2**: Conversion funnels and time metrics
5. **Week 3**: Source/medium tracking and messaging response times
6. **Week 3**: System health monitoring and data quality
