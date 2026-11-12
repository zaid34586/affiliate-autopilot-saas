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

- [x] **Phase 0 — Foundation** (repo, schema, Supabase DB, 21 tables)
- [ ] Phase 1 — Public website
- [ ] Phase 2 — SaaS core shell (auth, onboarding, dashboard)
- [ ] Phase 3 — MVP core (products, links, content, DM v1, billing)
- [ ] Phase 4 — Video engine
- [ ] ... (see ROADMAP.md)

## 💻 Local development

```bash
pnpm install
cp .env.example .env.local   # fill values (never commit .env.local)

# DB migrations (Supabase Management API path)
node scripts/apply-migration.cjs packages/db/migrations/0000_open_talon.sql

# dev server
pnpm dev
```

## 🔐 Secrets policy

- `.env.local` is **git-ignored** — tokens never committed
- Rotate any token that has ever been shared in chat/history
- Supabase service role key + access token: local/CI only, never expose to client
