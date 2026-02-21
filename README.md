# 🎯 MatesBet

A parimutuel betting app for your crew. Create markets on anything, odds calculate automatically from the betting pool — just like horse racing or Polymarket, but for mates.

---

## How it works

**Parimutuel betting:** All money bet goes into a pool. When the market resolves, the entire pool is distributed to winners proportionally to their stake. Odds update live as more bets come in.

- Bet $20 on Team A when the pool is $100 → if Team A wins, you get your share of the whole $200 pool
- The market creator picks the winner to trigger payouts
- Everyone starts with $1,000 in play money

---

## 🚀 Deploy in ~15 minutes (free)

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Give it a name (e.g. "matesbet") and a strong database password
3. Choose the region closest to you
4. Wait ~2 min for it to boot up

### Step 2 — Run the database schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy the entire contents of `supabase/schema.sql` and paste it in
4. Click **Run** (green button)

You should see "Success. No rows returned" — that's correct.

### Step 3 — Get your API keys

1. In Supabase dashboard → **Settings** → **API**
2. Copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (the long JWT string)

### Step 4 — Deploy to Vercel

1. Push this project to a GitHub repo (or fork it)
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. In the **Environment Variables** section, add:
   ```
   NEXT_PUBLIC_SUPABASE_URL    = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
   ```
4. Click **Deploy**

That's it. Vercel gives you a URL like `https://matesbet-xyz.vercel.app` — share it with your mates!

### Step 5 — Configure Supabase Auth (important)

1. In Supabase → **Authentication** → **URL Configuration**
2. Set **Site URL** to your Vercel URL: `https://matesbet-xyz.vercel.app`
3. Add to **Redirect URLs**: `https://matesbet-xyz.vercel.app/**`

---

## 🛠 Run locally

```bash
# Clone the repo
git clone https://github.com/yourname/matesbet
cd matesbet

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local and add your Supabase URL and anon key

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Features

- **Real accounts** — sign up with email + password, login from any device
- **Shared markets** — everyone bets into the same pool in real-time
- **Live odds** — automatically update as bets come in (parimutuel system)
- **Market controls** — only the creator can close betting and resolve the winner
- **Automatic payouts** — winners get their share of the pool instantly on resolution
- **My Bets** — full history with P&L tracking
- **Leaderboard** — see who's up and who's down across all players
- **Real-time updates** — Supabase subscriptions push changes live without refresh
- **Mobile friendly** — bottom nav on mobile, sidebar on desktop

---

## Project structure

```
matesbet/
├── app/
│   ├── auth/
│   │   ├── login/       # Login page
│   │   └── signup/      # Signup page
│   └── (app)/           # Protected routes
│       ├── markets/     # Main markets view + bet modal
│       ├── create/      # Create a new market
│       ├── my-bets/     # User's bet history
│       └── leaderboard/ # Rankings
├── components/
│   └── NavSidebar.tsx   # Sidebar + mobile nav
├── lib/
│   ├── supabase/        # Supabase client helpers
│   └── types.ts         # Shared types + odds calculation
├── supabase/
│   └── schema.sql       # Full DB schema — run this first!
└── middleware.ts         # Auth route protection
```

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router) |
| Auth | Supabase Auth (email/password) |
| Database | Supabase (Postgres) |
| Realtime | Supabase Realtime |
| Hosting | Vercel (free tier) |
| Styling | CSS Modules |

---

## Customising starting balance

To change the $1,000 starting balance, edit line 6 of `supabase/schema.sql`:

```sql
balance numeric(10,2) not null default 1000.00,  -- change this
```

Or update it for a specific user in Supabase → Table Editor → profiles.
