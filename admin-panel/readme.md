# FlyAndEarn Admin Panel

A secure, full-featured admin panel for the FlyAndEarn marketplace, built with Next.js 14, TypeScript, Tailwind CSS, and Prisma.

## Features

- **Secure Authentication**: Session-based auth with bcrypt password hashing, rate limiting, and audit logging
- **Dashboard**: Real-time KPIs and charts for visitors, users, requests, matches, and financial metrics
- **User Management**: View, search, suspend/unsuspend users, reset wallets
- **Request Management**: Track marketplace requests with status, filters, and export
- **Match Tracking**: Monitor traveller acceptances, completion rates, and deals
- **Wallet & Transactions**: Manage balances, payouts, and transaction ledger
- **Analytics**: First-party visitor tracking with pageview and event logging
- **Audit Logs**: Complete audit trail of all admin actions

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: iron-session + bcryptjs
- **Charts**: Recharts
- **Validation**: Zod

## Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

## Setup

### 1. Install dependencies

```bash
cd admin-panel
npm install
```

### 2. Configure environment

Copy the example env file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/flyandearn_admin?schema=public"

# Admin Credentials (used for initial seed)
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-secure-password-here"

# Session Secret (generate with: openssl rand -hex 32)
SESSION_SECRET="your-session-secret-here-min-32-chars"

# Environment
NODE_ENV="development"
```

### 3. Setup database

Generate Prisma client and run migrations:

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run migrate

# Seed the database with admin user and sample data
npm run seed
```

### 4. Start development server

```bash
npm run dev
```

The admin panel will be available at [http://localhost:3001](http://localhost:3001)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed database with admin and sample data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test` | Run tests |

## Project Structure

```
admin-panel/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seeding
├── src/
│   ├── app/
│   │   ├── admin/         # Admin pages
│   │   │   ├── page.tsx   # Dashboard
│   │   │   ├── users/     # User management
│   │   │   ├── requests/  # Request management
│   │   │   ├── matches/   # Match tracking
│   │   │   ├── wallet/    # Wallet & transactions
│   │   │   ├── visitors/  # Analytics
│   │   │   ├── logs/      # Audit logs
│   │   │   └── settings/  # Settings
│   │   └── api/           # API routes
│   │       ├── auth/      # Authentication
│   │       ├── admin/     # Admin data endpoints
│   │       └── track/     # Analytics tracking
│   ├── components/        # Reusable components
│   │   ├── ui/           # UI components
│   │   ├── charts/       # Chart components
│   │   ├── tables/       # Table components
│   │   └── layout/       # Layout components
│   ├── lib/              # Utilities
│   │   ├── auth.ts       # Authentication logic
│   │   ├── db.ts         # Database client
│   │   ├── rate-limit.ts # Rate limiting
│   │   └── utils.ts      # Helper functions
│   ├── types/            # TypeScript types
│   └── middleware.ts     # Route protection
├── .env.example          # Environment template
└── README.md
```

## Security Features

### Authentication
- Session-based authentication using encrypted cookies
- Passwords hashed with bcrypt (12 rounds)
- Session expiry after 8 hours of inactivity

### Rate Limiting
- Login attempts limited per IP address (5 attempts / 15 minutes)
- Login attempts limited per username
- Automatic lockout with exponential backoff

### Audit Logging
- All admin actions logged with timestamp, IP, and user agent
- Login attempts (success/failure) recorded
- User modifications tracked with before/after values

### Route Protection
- Middleware-based protection for all `/admin` routes
- API routes require valid session
- CSRF protection on mutations

## First-Party Analytics

The admin panel includes a lightweight first-party analytics solution. To enable tracking on your main site, add:

```html
<script src="https://your-admin-domain/api/track" async></script>
```

This tracks:
- Pageviews (anonymized IP hash)
- User signups
- Request creation
- Match events
- Payment events

## Creating Additional Admin Users

Currently, admin users are created via environment variables during seeding. To add more admins:

1. Add entries to the seed script
2. Or create a script to insert directly into the database:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin(username: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.create({
    data: { username, passwordHash, email: `${username}@flyandearn.eu` }
  });
}
```

## Deployment

### Netlify (Recommended)

The admin panel is configured for Netlify deployment with the Next.js runtime.

#### Prerequisites
- A Netlify account
- A managed PostgreSQL database (recommended: [Neon](https://neon.tech) - free tier available)

#### Deploy Steps

1. **Set up database**: Create a PostgreSQL database on Neon, Supabase, or Railway

2. **Deploy to Netlify**:
   - Go to [Netlify](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repo
   - Set base directory to `admin-panel`
   - Build command: `npm run build`
   - Publish directory: `.next`

3. **Configure environment variables** in Netlify dashboard:
   ```
   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
   SESSION_SECRET=your-secret-key-min-32-chars
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password
   ```

4. **Run database migrations** (after first deploy):
   ```bash
   # Using Netlify CLI
   netlify env:set DATABASE_URL "your-connection-string"
   cd admin-panel
   npx prisma db push
   npm run db:seed
   ```

5. **Trigger redeploy** to apply the seeded admin user

#### One-Click Deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/your-repo/flyandearn-netlify)

### Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Self-hosted

1. Build the application: `npm run build`
2. Set environment variables
3. Run migrations: `npm run migrate`
4. Seed database: `npm run seed`
5. Start: `npm run start`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/session` - Check session status

### Admin Data (requires auth)
- `GET /api/admin/dashboard` - Dashboard metrics
- `GET /api/admin/users` - List users
- `GET /api/admin/users/[id]` - User detail
- `PATCH /api/admin/users` - Update user status
- `GET /api/admin/requests` - List requests
- `GET /api/admin/matches` - List matches
- `GET /api/admin/wallet` - Transaction ledger
- `GET /api/admin/logs` - Audit logs

### Analytics
- `POST /api/track` - Track event
- `GET /api/track` - Get tracking script

## License

Proprietary - FlyAndEarn

## Support

For issues or questions, contact the development team.
