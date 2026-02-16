import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed subscription plans
  console.log('Creating subscription plans...');

  const plans = [
    {
      tier: 'SILVER',
      name: 'Silver',
      priceEur: 4.63,
      pricePln: 19.99,
      purchaseLimit: 5,
      description: 'Perfect for occasional travelers',
      features: ['Up to 5 purchases per year', 'Standard support', 'Basic tracking'],
      isActive: true,
    },
    {
      tier: 'GOLD',
      name: 'Gold',
      priceEur: 6.94,
      pricePln: 29.99,
      purchaseLimit: 10,
      description: 'For regular travelers',
      features: ['Up to 10 purchases per year', 'Priority support', 'Advanced tracking', 'Early access to deals'],
      isActive: true,
    },
    {
      tier: 'PLATINUM',
      name: 'Platinum',
      priceEur: 11.57,
      pricePln: 49.99,
      purchaseLimit: null,
      description: 'For power users',
      features: ['Unlimited purchases', 'VIP support', 'Premium tracking', 'Exclusive deals', 'Priority matching'],
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { tier: plan.tier },
      update: plan,
      create: plan,
    });
    console.log(`  Created/updated ${plan.name} plan`);
  }

  // Seed FX rates
  console.log('Creating FX rates...');

  const fxRates = [
    { fromCurrency: 'EUR', toCurrency: 'PLN', rate: 4.32, source: 'seed' },
    { fromCurrency: 'PLN', toCurrency: 'EUR', rate: 0.2315, source: 'seed' },
  ];

  for (const fx of fxRates) {
    await prisma.fxRate.create({
      data: {
        ...fx,
        validFrom: new Date(),
      },
    });
    console.log(`  Created ${fx.fromCurrency}/${fx.toCurrency} rate: ${fx.rate}`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
