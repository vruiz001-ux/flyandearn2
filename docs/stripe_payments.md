# Stripe Marketplace Payments System

This document describes the implementation of the wallet escrow payment system for FlyAndEarn, enabling €20 deposits from Requestors that are automatically transferred to Travellers upon mission acceptance.

## Architecture Overview

### Payment Flow

```
1. Requestor creates a request
2. Requestor pays €20 deposit (via Stripe Payment Element)
   - Supports: Card, BLIK (Poland), P24 (Poland)
   - PaymentIntent created with automatic capture
3. Deposit status changes: NONE → CREATED → CAPTURED
4. Traveller makes an offer
5. Requestor accepts offer
   - System verifies Traveller has Connect account
   - System transfers €20 to Traveller's Connect account
6. Deposit status changes: CAPTURED → TRANSFERRED
```

### Stripe Pattern: Separate Charges and Transfers

We use **Pattern A (Separate Charges and Transfers)** because the Traveller is unknown when the Requestor pays the deposit.

- Payment is collected from Requestor to platform
- Transfer is made to Traveller's Connect account on acceptance
- Platform maintains control over the funds until transfer

## Environment Variables

Add these to your `.env` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Webhook Secret (from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Separate Connect webhook secret if using Connect webhooks
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
```

## Database Schema

The following fields were added to support deposits:

### User Model (for Travellers)
```prisma
stripeConnectAccountId String?        @unique // Express account ID
connectOnboardingComplete Boolean     @default(false)
connectPayoutsEnabled  Boolean        @default(false)
```

### Request Model
```prisma
// Deposit Payment
depositAmount               Float?
depositCurrency             String?        // EUR or PLN
depositStatus               DepositStatus  @default(NONE)
stripeDepositPaymentIntentId String?       @unique
depositIdempotencyKey       String?        @unique
depositPaidAt               DateTime?
depositTransferredAt        DateTime?
stripeDepositTransferId     String?        @unique
```

### DepositStatus Enum
```prisma
enum DepositStatus {
  NONE              // No deposit created yet
  CREATED           // PaymentIntent created, awaiting payment
  REQUIRES_ACTION   // 3DS or BLIK confirmation required
  CAPTURED          // Payment captured, awaiting match
  TRANSFERRED       // Transferred to Traveller on acceptance
  REFUNDED          // Refunded (request cancelled/expired)
  FAILED            // Payment failed
}
```

## API Endpoints

### Deposit Endpoints (`/deposit`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/deposit/create` | Create PaymentIntent for deposit |
| POST | `/deposit/confirm` | Confirm deposit after payment |
| GET | `/deposit/status?requestId=X` | Get deposit status |
| POST | `/deposit/refund` | Refund captured deposit |

### Stripe Connect Endpoints (`/stripe-connect`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/stripe-connect/onboard` | Start Connect Express onboarding |
| POST | `/stripe-connect/refresh` | Refresh expired onboarding link |
| GET | `/stripe-connect/status` | Get account status |
| GET | `/stripe-connect/dashboard` | Get Express Dashboard link |
| GET | `/stripe-connect/balance` | Get Connect account balance |

## Webhook Events

Configure these events in your Stripe Dashboard:

### Payment Events
- `payment_intent.succeeded` - Deposit captured
- `payment_intent.payment_failed` - Deposit failed

### Connect Events
- `account.updated` - Onboarding status changes

### Transfer Events
- `transfer.created` - Transfer confirmed
- `transfer.failed` - Transfer failed (critical alert)

## Frontend Integration

### 1. Include Stripe.js and the Payment Module

```html
<script src="https://js.stripe.com/v3/"></script>
<script src="/deposit-payment.js"></script>
```

### 2. Initialize the Payment Module

```javascript
// Initialize with your publishable key
DepositPayment.init('pk_test_YOUR_KEY');
```

### 3. Create and Mount Payment Element

```javascript
async function showDepositPayment(requestId) {
  try {
    // Create the deposit
    const deposit = await DepositPayment.createDeposit(requestId);

    // Mount Payment Element to container
    await DepositPayment.mountPaymentElement('#payment-element');

    // Show the payment form
    document.getElementById('payment-modal').classList.add('show');
  } catch (error) {
    console.error('Failed to load payment:', error);
  }
}
```

### 4. Confirm Payment

```javascript
document.getElementById('pay-btn').addEventListener('click', async () => {
  try {
    const result = await DepositPayment.confirmPayment({
      returnUrl: window.location.origin + '/wallet?deposit=success'
    });

    if (result.success) {
      // Payment succeeded
      showSuccess('Deposit paid successfully!');
      closePaymentModal();
    }
  } catch (error) {
    showError(error.message);
  }
});
```

### 5. Traveller Connect Onboarding

```javascript
async function setupPayouts() {
  try {
    const result = await StripeConnect.startOnboarding();

    if (result.alreadyOnboarded) {
      showSuccess('Payouts already set up!');
      return;
    }

    // Redirect to Stripe onboarding
    window.location.href = result.onboardingUrl;
  } catch (error) {
    showError(error.message);
  }
}
```

## Payment Element Styling

The Payment Element uses a dark theme matching FlyAndEarn's design:

```javascript
const appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#d4a853',      // Gold accent
    colorBackground: '#18181b',   // Card background
    colorText: '#fafafa',         // Primary text
    colorDanger: '#ef4444',       // Error red
    fontFamily: 'Outfit, system-ui, sans-serif',
  }
};
```

## Currency Handling

- Base deposit: €20 EUR
- Polish users: ~86 PLN (converted using current FX rate)
- Currency determined by user's country or preference
- FX rate stored for audit trail

## Error Handling

### Deposit Creation Errors
- `404`: Request not found
- `403`: Not authorized (not the buyer)
- `400`: Invalid request status or deposit already paid

### Transfer Errors
- `400`: Deposit not captured / Traveller not onboarded
- `500`: Transfer failed (logged for manual intervention)

## Testing

### Test Cards
- `4242 4242 4242 4242` - Successful payment
- `4000 0025 0000 3155` - Requires 3DS authentication
- `4000 0000 0000 9995` - Declined

### Test BLIK
Use any 6-digit code in test mode.

### Test Connect
Stripe provides test account onboarding in test mode.

## Production Checklist

- [ ] Replace test API keys with live keys
- [ ] Update webhook endpoints in Stripe Dashboard
- [ ] Verify Connect account capabilities
- [ ] Set up proper error alerting for failed transfers
- [ ] Configure payout schedule in Connect settings
- [ ] Test full flow end-to-end with real payments

## Security Considerations

1. **Idempotency**: All payment operations use idempotency keys
2. **Webhook Verification**: All webhooks verify Stripe signatures
3. **Authorization**: All endpoints require authentication
4. **State Validation**: Deposit status checked before operations
5. **Connect Verification**: Traveller must complete onboarding before receiving transfers
