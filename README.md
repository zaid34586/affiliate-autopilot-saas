# 🚀 Affiliate Autopilot AI SaaS

> AI Marketing Operating System for Affiliate Marketers — research → content → video → publish → DM → optimize, sab 24/7 autopilot.

**Docs:** [plan.md](./plan.md) (full spec) · [ROADMAP.md](./ROADMAP.md) (phase-by-phase execution)

## 🛠 Stack

| Layer | Tech |
|---|---|
| Frontend/API | Next.js (App Router, TypeScript, Tailwind) — `apps/web` |
| DB | Supabase (PostgreSQL 17) + Drizzle ORM — `packages/db` |
| Queues | Redis + BullMQ (Phase 4+) |
| Video | Google Veo (platform pool) + FFmpeg |
| Hosting | Vercel (web) + Supabase |

## 📦 Monorepo structure

```
affiliate-autopilot/
├── apps/web/           # Next.js app
├── packages/db/        # Drizzle schema + migrations
├── scripts/            # migration & ops helpers
├── plan.md             # full product spec
└── ROADMAP.md          # phase-by-phase roadmap
```

## 🚦 Roadmap status

- [x] **Phase 0 — Foundation** (repo, schema, Supabase DB, 21 tables, auth, workspace, dashboard shell, tests, seed)
- [ ] Phase 1 — Public website
- [ ] Phase 2 — SaaS core shell (onboarding polish, connections, RBAC)
- [ ] Phase 3 — MVP core (products, links, content, DM v1, billing)
- [ ] Phase 4 — Video engine
- [ ] ... (see ROADMAP.md)

## 💻 Local development

```bash
pnpm install
cp .env.example .env.local   # fill values (never commit .env.local)

# DB migrations (Supabase Management API path)
node scripts/apply-migration.cjs packages/db/migrations/0000_open_talon.sql

pnpm db:seed     # demo user + workspace + character (demo@example.com / Demo1234!)
pnpm dev         # dev server → http://localhost:3000

# quality gates (CI mein bhi yahi)
pnpm lint
pnpm test        # 10 unit tests
pnpm --filter web build
pnpm smoke       # e2e: chhota auth flow test (dev server chalna chahiye)
```

## 🔑 Google OAuth (Phase 0 ke baad enable kar sakte ho)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth Client ID
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
3. `.env.local` (apps/web) mein `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` daalo
4. Login page pe "Continue with Google" apne aap dikh jayega (env na ho toh chhup rehta hai)


## 🔐 Secrets policy

- `.env.local` is **git-ignored** — tokens never committed
- Rotate any token that has ever been shared in chat/history
- Supabase service role key + access token: local/CI only, never expose to client
