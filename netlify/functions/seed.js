import prisma from './lib/prisma.js';
import { hashPassword, jsonResponse } from './lib/auth.js';

export const config = { path: ['/api/seed', '/.netlify/functions/seed'] };

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // Verify secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return jsonResponse(500, { error: 'CRON_SECRET not configured' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid body' });
  }

  if (body.secret !== cronSecret) {
    return jsonResponse(403, { error: 'Invalid secret' });
  }

  // Idempotency check
  const existing = await prisma.user.findFirst({
    where: { email: { startsWith: 'seed-' } },
  });
  if (existing) {
    return jsonResponse(200, {
      success: true,
      message: 'Seed data already exists',
      alreadySeeded: true,
    });
  }

  const passwordHash = await hashPassword('SeedUser123!');
  const now = new Date();

  // Create 8 users
  const usersData = [
    { email: 'seed-anna@flyandearn.eu', name: 'Anna Kowalska', isTraveler: true, isBuyer: false, role: 'TRAVELLER', city: 'Warsaw', country: 'PL' },
    { email: 'seed-tomasz@flyandearn.eu', name: 'Tomasz Wiśniewski', isTraveler: true, isBuyer: false, role: 'TRAVELLER', city: 'Warsaw', country: 'PL' },
    { email: 'seed-hans@flyandearn.eu', name: 'Hans Müller', isTraveler: true, isBuyer: true, role: 'TRAVELLER', city: 'Frankfurt', country: 'DE' },
    { email: 'seed-james@flyandearn.eu', name: 'James Richardson', isTraveler: true, isBuyer: false, role: 'TRAVELLER', city: 'London', country: 'GB' },
    { email: 'seed-sophie@flyandearn.eu', name: 'Sophie Dupont', isTraveler: true, isBuyer: true, role: 'TRAVELLER', city: 'Paris', country: 'FR' },
    { email: 'seed-katarzyna@flyandearn.eu', name: 'Katarzyna Nowak', isTraveler: false, isBuyer: true, role: 'BUYER', city: 'Krakow', country: 'PL' },
    { email: 'seed-oliver@flyandearn.eu', name: 'Oliver Schmidt', isTraveler: false, isBuyer: true, role: 'BUYER', city: 'Munich', country: 'DE' },
    { email: 'seed-emma@flyandearn.eu', name: 'Emma Williams', isTraveler: false, isBuyer: true, role: 'BUYER', city: 'Manchester', country: 'GB' },
  ];

  const users = [];
  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        ...u,
        passwordHash,
        emailVerified: true,
        emailVerifiedAt: now,
      },
    });
    users.push(user);
  }

  // Helper to get future date
  const futureDate = (days) => new Date(Date.now() + days * 86400000);

  // Create 6 trips
  const tripsData = [
    { traveller: 0, fromAirport: 'WAW', fromCity: 'Warsaw', toAirport: 'DXB', toCity: 'Dubai', departureDate: futureDate(7), returnDate: futureDate(14), availableKg: 10, categories: ['alcohol', 'cosmetics', 'electronics'] },
    { traveller: 1, fromAirport: 'WAW', fromCity: 'Warsaw', toAirport: 'IST', toCity: 'Istanbul', departureDate: futureDate(5), returnDate: futureDate(10), availableKg: 8, categories: ['cosmetics', 'food'] },
    { traveller: 2, fromAirport: 'FRA', fromCity: 'Frankfurt', toAirport: 'DXB', toCity: 'Dubai', departureDate: futureDate(10), returnDate: futureDate(17), availableKg: 15, categories: ['electronics', 'alcohol', 'cosmetics'] },
    { traveller: 3, fromAirport: 'LHR', fromCity: 'London', toAirport: 'SIN', toCity: 'Singapore', departureDate: futureDate(14), returnDate: futureDate(21), availableKg: 12, categories: ['electronics', 'cosmetics'] },
    { traveller: 4, fromAirport: 'CDG', fromCity: 'Paris', toAirport: 'BKK', toCity: 'Bangkok', departureDate: futureDate(3), returnDate: futureDate(12), availableKg: 10, categories: ['cosmetics', 'alcohol', 'food'] },
    { traveller: 2, fromAirport: 'MUC', fromCity: 'Munich', toAirport: 'DOH', toCity: 'Doha', departureDate: futureDate(20), returnDate: futureDate(27), availableKg: 8, categories: ['alcohol', 'electronics'] },
  ];

  const trips = [];
  for (const t of tripsData) {
    const trip = await prisma.trip.create({
      data: {
        travellerId: users[t.traveller].id,
        fromAirport: t.fromAirport,
        fromCity: t.fromCity,
        toAirport: t.toAirport,
        toCity: t.toCity,
        departureDate: t.departureDate,
        returnDate: t.returnDate,
        availableKg: t.availableKg,
        categories: t.categories,
        status: 'upcoming',
      },
    });
    trips.push(trip);
  }

  // Create 10 requests with items
  const requestsData = [
    { buyer: 5, product: 'Macallan 18yr 1L', category: 'alcohol', price: 180, from: 'WAW', fromCity: 'Warsaw', to: 'DXB', toCity: 'Dubai' },
    { buyer: 6, product: 'Chanel No. 5 100ml', category: 'cosmetics', price: 120, from: 'FRA', fromCity: 'Frankfurt', to: 'DXB', toCity: 'Dubai' },
    { buyer: 7, product: 'iPhone 16 Pro 256GB', category: 'electronics', price: 1099, from: 'LHR', fromCity: 'London', to: 'SIN', toCity: 'Singapore' },
    { buyer: 5, product: 'Ray-Ban Aviator Sunglasses', category: 'accessories', price: 140, from: 'CDG', fromCity: 'Paris', to: 'BKK', toCity: 'Bangkok' },
    { buyer: 6, product: 'Hennessy XO 700ml', category: 'alcohol', price: 160, from: 'MUC', fromCity: 'Munich', to: 'DOH', toCity: 'Doha' },
    { buyer: 7, product: 'IQOS Terea 10 packs', category: 'tobacco', price: 65, from: 'WAW', fromCity: 'Warsaw', to: 'IST', toCity: 'Istanbul' },
    { buyer: 5, product: 'Toblerone XL 4.5kg', category: 'food', price: 55, from: 'FRA', fromCity: 'Frankfurt', to: 'DXB', toCity: 'Dubai' },
    { buyer: 6, product: 'Dyson Airwrap', category: 'electronics', price: 480, from: 'LHR', fromCity: 'London', to: 'SIN', toCity: 'Singapore' },
    { buyer: 7, product: 'Jo Malone London Perfume Set', category: 'cosmetics', price: 210, from: 'CDG', fromCity: 'Paris', to: 'BKK', toCity: 'Bangkok' },
    { buyer: 5, product: 'Johnnie Walker Blue Label 1L', category: 'alcohol', price: 195, from: 'WAW', fromCity: 'Warsaw', to: 'DXB', toCity: 'Dubai' },
  ];

  const requests = [];
  for (const r of requestsData) {
    const request = await prisma.request.create({
      data: {
        buyerId: users[r.buyer].id,
        requestType: 'DUTY_FREE',
        product: r.product,
        category: r.category,
        dutyFreePrice: r.price,
        serviceFee: Math.round(r.price * 0.15 * 100) / 100,
        orderType: 'DUTY_FREE',
        currency: 'EUR',
        fromAirport: r.from,
        fromCity: r.fromCity,
        toAirport: r.to,
        toCity: r.toCity,
        totalBudget: r.price,
        totalItems: 1,
        status: 'OPEN',
        items: {
          create: {
            itemName: r.product,
            quantity: 1,
            budgetPrice: r.price,
            currency: 'EUR',
            category: r.category,
            itemSource: 'DUTY_FREE',
          },
        },
      },
    });
    requests.push(request);
  }

  // Create 4 orders (ACCEPTED status) matching requests to trips
  const ordersData = [
    { requestIdx: 0, tripTraveller: 0, buyerIdx: 5 }, // Macallan → Anna (WAW→DXB)
    { requestIdx: 1, tripTraveller: 2, buyerIdx: 6 }, // Chanel → Hans (FRA→DXB)
    { requestIdx: 2, tripTraveller: 3, buyerIdx: 7 }, // iPhone → James (LHR→SIN)
    { requestIdx: 9, tripTraveller: 0, buyerIdx: 5 }, // JW Blue → Anna (WAW→DXB)
  ];

  const orders = [];
  for (const o of ordersData) {
    const req = requests[o.requestIdx];
    const rd = requestsData[o.requestIdx];
    const goodsValue = rd.price;
    const platformFee = Math.round(goodsValue * 0.05 * 100) / 100;
    const travellerServiceFee = Math.round(goodsValue * 0.15 * 100) / 100;
    const totalAmount = goodsValue + platformFee + travellerServiceFee;

    // Update request status to MATCHED
    await prisma.request.update({
      where: { id: req.id },
      data: { status: 'MATCHED' },
    });

    const order = await prisma.order.create({
      data: {
        requestId: req.id,
        buyerId: users[o.buyerIdx].id,
        travelerId: users[o.tripTraveller].id,
        orderType: 'DUTY_FREE',
        goodsValue,
        platformFee,
        travellerServiceFee,
        totalAmount,
        travelerAmount: travellerServiceFee,
        currency: 'EUR',
        status: 'PAID',
        idempotencyKey: `seed-order-${o.requestIdx}-${Date.now()}`,
      },
    });
    orders.push(order);
  }

  return jsonResponse(200, {
    success: true,
    summary: {
      users: users.length,
      trips: trips.length,
      requests: requests.length,
      orders: orders.length,
    },
  });
}
