import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';
import crypto from 'crypto';

// ==========================================
// LEDGER HELPERS - Double-Entry Accounting
// ==========================================

/**
 * Generate idempotency key for ledger entries
 */
function generateIdempotencyKey(type, referenceType, referenceId, suffix = '') {
  return `${type}-${referenceType}-${referenceId}${suffix ? '-' + suffix : ''}`;
}

// Currency exchange rates (PLN to EUR and vice versa)
// In production, fetch from an API like ECB or fixer.io
const EXCHANGE_RATES = {
  'EUR_PLN': 4.32,  // 1 EUR = 4.32 PLN
  'PLN_EUR': 0.23,  // 1 PLN = 0.23 EUR
};

/**
 * Get currency based on user's country
 */
function getCurrencyForCountry(country) {
  if (!country) return 'EUR';
  const polishVariants = ['poland', 'polska', 'pl', 'pol'];
  return polishVariants.includes(country.toLowerCase()) ? 'PLN' : 'EUR';
}

/**
 * Convert amount between currencies
 */
function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;

  const rateKey = `${fromCurrency}_${toCurrency}`;
  const rate = EXCHANGE_RATES[rateKey];

  if (!rate) {
    throw new Error(`No exchange rate for ${fromCurrency} to ${toCurrency}`);
  }

  return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
}

/**
 * Get or create wallet for a user
 */
async function getOrCreateWallet(userId) {
  let wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      accounts: true,
      payoutMethods: true,
    },
  });

  if (!wallet) {
    // Get user's country to determine currency
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });

    const currency = getCurrencyForCountry(user?.country);

    // Create wallet with default accounts
    wallet = await prisma.wallet.create({
      data: {
        userId,
        currency,
        status: 'ACTIVE',
        accounts: {
          create: [
            { type: 'AVAILABLE', currency, balance: 0 },
            { type: 'PENDING', currency, balance: 0 },
            { type: 'FROZEN', currency, balance: 0 },
          ],
        },
      },
      include: {
        accounts: true,
        payoutMethods: true,
      },
    });
  }

  return wallet;
}

/**
 * Get account by type from wallet
 */
function getAccount(wallet, type) {
  return wallet.accounts.find(a => a.type === type);
}

/**
 * Post a double-entry ledger transaction
 * Debits reduce the debit account, Credits increase the credit account
 */
async function postLedgerEntry({
  type,
  amount,
  debitAccountId,
  creditAccountId,
  referenceType,
  referenceId,
  idempotencyKey,
  providerEventId = null,
  description = null,
  metadata = null,
  createdBy = null,
}) {
  // Check for existing entry with same idempotency key
  const existing = await prisma.ledgerEntry.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return existing; // Idempotent return
  }

  // Create ledger entry and update balances atomically
  const [entry] = await prisma.$transaction([
    prisma.ledgerEntry.create({
      data: {
        type,
        status: 'COMPLETED',
        amount,
        currency: 'EUR',
        debitAccountId,
        creditAccountId,
        referenceType,
        referenceId,
        idempotencyKey,
        providerEventId,
        description,
        metadata,
        createdBy,
      },
    }),
    // Decrease debit account
    prisma.walletAccount.update({
      where: { id: debitAccountId },
      data: { balance: { decrement: amount } },
    }),
    // Increase credit account
    prisma.walletAccount.update({
      where: { id: creditAccountId },
      data: { balance: { increment: amount } },
    }),
  ]);

  return entry;
}

/**
 * Get or create platform account (escrow, fees)
 */
async function getOrCreatePlatformAccount(type) {
  let account = await prisma.platformAccount.findFirst({
    where: { type, currency: 'EUR' },
  });

  if (!account) {
    account = await prisma.platformAccount.create({
      data: { type, currency: 'EUR', balance: 0 },
    });
  }

  return account;
}

// ==========================================
// API HANDLER
// ==========================================

export async function handler(event) {
  const { httpMethod, path } = event;
  const pathParts = path.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  // All wallet endpoints require authentication
  const token = getSessionToken(event);
  if (!token) {
    return jsonResponse(401, { error: 'Authentication required' });
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) {
    return jsonResponse(401, { error: 'Invalid session' });
  }

  const userId = payload.userId;

  switch (httpMethod) {
    case 'GET':
      if (action === 'transactions') {
        return getTransactions(userId, event);
      }
      return getWallet(userId);

    case 'POST':
      if (action === 'withdraw') {
        return requestWithdrawal(userId, event);
      }
      if (action === 'payout-method') {
        return addPayoutMethod(userId, event);
      }
      if (action === 'transfer') {
        return transferMoney(userId, event);
      }
      if (action === 'request-payment') {
        return requestPayment(userId, event);
      }
      return jsonResponse(400, { error: 'Unknown action' });

    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// ==========================================
// ENDPOINT HANDLERS
// ==========================================

/**
 * GET /wallet - Get user's wallet with balances
 */
async function getWallet(userId) {
  try {
    const wallet = await getOrCreateWallet(userId);

    // Calculate totals
    const available = getAccount(wallet, 'AVAILABLE')?.balance || 0;
    const pending = getAccount(wallet, 'PENDING')?.balance || 0;
    const frozen = getAccount(wallet, 'FROZEN')?.balance || 0;

    // Get pending payout requests
    const pendingPayouts = await prisma.payoutRequest.findMany({
      where: {
        walletId: wallet.id,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    const pendingWithdrawal = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

    return jsonResponse(200, {
      success: true,
      wallet: {
        id: wallet.id,
        currency: wallet.currency,
        status: wallet.status,
        balances: {
          available,
          pending,
          frozen,
          total: available + pending + frozen,
          withdrawable: available - pendingWithdrawal,
        },
        payoutMethods: wallet.payoutMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          last4: pm.last4,
          bankName: pm.bankName,
          country: pm.country,
          status: pm.status,
          isDefault: pm.isDefault,
        })),
        pendingWithdrawal,
        exchangeRates: EXCHANGE_RATES,
      },
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return jsonResponse(500, { error: 'Failed to fetch wallet' });
  }
}

/**
 * GET /wallet/transactions - Get ledger history
 */
async function getTransactions(userId, event) {
  try {
    const params = event.queryStringParameters || {};
    const { limit = '50', offset = '0', type } = params;

    const wallet = await getOrCreateWallet(userId);
    const accountIds = wallet.accounts.map(a => a.id);

    const where = {
      OR: [
        { debitAccountId: { in: accountIds } },
        { creditAccountId: { in: accountIds } },
      ],
    };

    if (type) {
      where.type = type;
    }

    const entries = await prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
      include: {
        debitAccount: { select: { type: true } },
        creditAccount: { select: { type: true } },
      },
    });

    // Transform for frontend
    const transactions = entries.map(e => {
      const isCredit = accountIds.includes(e.creditAccountId);
      const isDebit = accountIds.includes(e.debitAccountId);

      let direction = 'internal';
      if (isCredit && !isDebit) direction = 'credit';
      else if (isDebit && !isCredit) direction = 'debit';

      return {
        id: e.id,
        type: e.type,
        status: e.status,
        amount: e.amount,
        currency: e.currency,
        direction,
        description: e.description,
        referenceType: e.referenceType,
        referenceId: e.referenceId,
        createdAt: e.createdAt,
        debitAccountType: e.debitAccount.type,
        creditAccountType: e.creditAccount.type,
      };
    });

    return jsonResponse(200, { success: true, transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return jsonResponse(500, { error: 'Failed to fetch transactions' });
  }
}

/**
 * POST /wallet/withdraw - Request a withdrawal
 */
async function requestWithdrawal(userId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { amount, payoutMethodId } = body;

    if (!amount || amount <= 0) {
      return jsonResponse(400, { error: 'Invalid withdrawal amount' });
    }

    const wallet = await getOrCreateWallet(userId);

    if (wallet.status !== 'ACTIVE') {
      return jsonResponse(403, { error: 'Wallet is not active' });
    }

    // Verify payout method
    const payoutMethod = await prisma.payoutMethod.findFirst({
      where: {
        id: payoutMethodId,
        walletId: wallet.id,
        status: 'VERIFIED',
      },
    });

    if (!payoutMethod) {
      return jsonResponse(400, { error: 'No verified payout method found' });
    }

    // Check available balance
    const availableAccount = getAccount(wallet, 'AVAILABLE');
    if (!availableAccount || availableAccount.balance < amount) {
      return jsonResponse(400, { error: 'Insufficient available balance' });
    }

    // Check for pending withdrawals
    const pendingPayouts = await prisma.payoutRequest.aggregate({
      where: {
        walletId: wallet.id,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      _sum: { amount: true },
    });

    const pendingAmount = pendingPayouts._sum.amount || 0;
    const withdrawable = availableAccount.balance - pendingAmount;

    if (amount > withdrawable) {
      return jsonResponse(400, {
        error: `Maximum withdrawable amount is ${withdrawable.toFixed(2)} EUR`,
      });
    }

    // Minimum withdrawal
    if (amount < 10) {
      return jsonResponse(400, { error: 'Minimum withdrawal is 10 EUR' });
    }

    // Create payout request
    const idempotencyKey = `payout-${wallet.id}-${Date.now()}-${crypto.randomUUID()}`;

    const payoutRequest = await prisma.payoutRequest.create({
      data: {
        walletId: wallet.id,
        amount,
        currency: 'EUR',
        status: 'PENDING',
        idempotencyKey,
      },
    });

    return jsonResponse(201, {
      success: true,
      payoutRequest: {
        id: payoutRequest.id,
        amount: payoutRequest.amount,
        status: payoutRequest.status,
        createdAt: payoutRequest.createdAt,
      },
      message: 'Withdrawal request submitted. Processing within 1-3 business days.',
    });
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    return jsonResponse(500, { error: 'Failed to request withdrawal' });
  }
}

/**
 * POST /wallet/payout-method - Add a payout method (initiates Stripe Connect onboarding)
 */
async function addPayoutMethod(userId, event) {
  try {
    const wallet = await getOrCreateWallet(userId);

    // Check if user already has a pending or verified method
    const existingMethod = await prisma.payoutMethod.findFirst({
      where: {
        walletId: wallet.id,
        status: { in: ['PENDING_VERIFICATION', 'VERIFIED'] },
      },
    });

    if (existingMethod) {
      return jsonResponse(400, {
        error: 'You already have a payout method. Contact support to change it.',
      });
    }

    // For now, create a placeholder method
    // In production, this would initiate Stripe Connect onboarding
    const payoutMethod = await prisma.payoutMethod.create({
      data: {
        walletId: wallet.id,
        type: 'bank_account',
        status: 'PENDING_VERIFICATION',
        currency: 'EUR',
        isDefault: true,
      },
    });

    return jsonResponse(201, {
      success: true,
      payoutMethod: {
        id: payoutMethod.id,
        status: payoutMethod.status,
      },
      message: 'Payout method created. Complete verification to enable withdrawals.',
      // In production: return onboardingUrl from Stripe Connect
    });
  } catch (error) {
    console.error('Error adding payout method:', error);
    return jsonResponse(500, { error: 'Failed to add payout method' });
  }
}

/**
 * POST /wallet/transfer - Send money to another user
 */
async function transferMoney(userId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { recipientEmail, amount, note } = body;

    if (!recipientEmail || !amount) {
      return jsonResponse(400, { error: 'recipientEmail and amount are required' });
    }

    if (amount < 1) {
      return jsonResponse(400, { error: 'Minimum transfer is €1' });
    }

    // Get sender's wallet
    const senderWallet = await getOrCreateWallet(userId);

    if (senderWallet.status !== 'ACTIVE') {
      return jsonResponse(403, { error: 'Your wallet is not active' });
    }

    const senderAvailable = getAccount(senderWallet, 'AVAILABLE');
    if (!senderAvailable || senderAvailable.balance < amount) {
      return jsonResponse(400, { error: 'Insufficient available balance' });
    }

    // Find recipient by email
    const recipient = await prisma.user.findUnique({
      where: { email: recipientEmail.toLowerCase() },
    });

    if (!recipient) {
      return jsonResponse(404, { error: 'Recipient not found' });
    }

    if (recipient.id === userId) {
      return jsonResponse(400, { error: 'Cannot transfer to yourself' });
    }

    // Get recipient's wallet
    const recipientWallet = await getOrCreateWallet(recipient.id);
    const recipientAvailable = getAccount(recipientWallet, 'AVAILABLE');

    if (!recipientAvailable) {
      return jsonResponse(500, { error: 'Recipient wallet error' });
    }

    // Handle currency conversion if needed
    const senderCurrency = senderWallet.currency;
    const recipientCurrency = recipientWallet.currency;

    let amountToDebit = amount;
    let amountToCredit = amount;
    let exchangeRate = null;

    if (senderCurrency !== recipientCurrency) {
      // Convert sender's amount to recipient's currency
      amountToCredit = convertCurrency(amount, senderCurrency, recipientCurrency);
      exchangeRate = EXCHANGE_RATES[`${senderCurrency}_${recipientCurrency}`];
    }

    // Generate idempotency key
    const idempotencyKey = `transfer-${userId}-${recipient.id}-${Date.now()}-${crypto.randomUUID()}`;

    // Perform the transfer atomically
    await prisma.$transaction(async (tx) => {
      // Debit sender in their currency
      await tx.walletAccount.update({
        where: { id: senderAvailable.id },
        data: { balance: { decrement: amountToDebit } },
      });

      // Credit recipient in their currency
      await tx.walletAccount.update({
        where: { id: recipientAvailable.id },
        data: { balance: { increment: amountToCredit } },
      });

      // Create ledger entry for sender (debit)
      await tx.ledgerEntry.create({
        data: {
          type: 'WITHDRAWAL',
          status: 'COMPLETED',
          amount: amountToDebit,
          currency: senderCurrency,
          debitAccountId: senderAvailable.id,
          creditAccountId: recipientAvailable.id,
          referenceType: 'TRANSFER',
          referenceId: recipient.id,
          idempotencyKey,
          description: note ? `Transfer to ${recipient.name}: ${note}` : `Transfer to ${recipient.name}`,
          metadata: {
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            note,
            senderCurrency,
            recipientCurrency,
            amountInRecipientCurrency: amountToCredit,
            exchangeRate,
          },
        },
      });
    });

    // Get sender info for recipient notification
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const currencySymbol = senderCurrency === 'PLN' ? 'zł' : '€';
    let message = `${currencySymbol}${amountToDebit.toFixed(2)} sent to ${recipient.name}`;

    if (senderCurrency !== recipientCurrency) {
      const recipientSymbol = recipientCurrency === 'PLN' ? 'zł' : '€';
      message += ` (${recipientSymbol}${amountToCredit.toFixed(2)} received)`;
    }

    return jsonResponse(200, {
      success: true,
      message,
      transfer: {
        amount: amountToDebit,
        currency: senderCurrency,
        recipient: {
          name: recipient.name,
          email: recipient.email,
          receivedAmount: amountToCredit,
          receivedCurrency: recipientCurrency,
        },
        exchangeRate,
        note,
      },
    });
  } catch (error) {
    console.error('Transfer error:', error);
    return jsonResponse(500, { error: 'Failed to transfer money' });
  }
}

/**
 * POST /wallet/request-payment - Request money from another user
 */
async function requestPayment(userId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { fromEmail, amount, note } = body;

    if (!fromEmail || !amount) {
      return jsonResponse(400, { error: 'fromEmail and amount are required' });
    }

    if (amount < 1) {
      return jsonResponse(400, { error: 'Minimum request is €1' });
    }

    // Find the user we're requesting from
    const fromUser = await prisma.user.findUnique({
      where: { email: fromEmail.toLowerCase() },
    });

    if (!fromUser) {
      return jsonResponse(404, { error: 'User not found' });
    }

    if (fromUser.id === userId) {
      return jsonResponse(400, { error: 'Cannot request from yourself' });
    }

    // Get requester info
    const requester = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // For now, just acknowledge the request
    // In a full implementation, this would create a PaymentRequest record
    // and notify the other user (via email, push notification, etc.)

    return jsonResponse(200, {
      success: true,
      message: `Payment request for €${amount.toFixed(2)} sent to ${fromUser.name}`,
      request: {
        amount,
        from: {
          name: fromUser.name,
          email: fromUser.email,
        },
        note,
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('Request payment error:', error);
    return jsonResponse(500, { error: 'Failed to send payment request' });
  }
}

// ==========================================
// EXPORTED LEDGER FUNCTIONS FOR OTHER MODULES
// ==========================================

export {
  getOrCreateWallet,
  getAccount,
  postLedgerEntry,
  getOrCreatePlatformAccount,
  generateIdempotencyKey,
  getCurrencyForCountry,
  convertCurrency,
  EXCHANGE_RATES,
};
