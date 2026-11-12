# 🗺️ MASTER ROADMAP — Affiliate Autopilot AI SaaS
### (Phase-by-Phase Execution Plan — v1.0)

> **Rule:** Ek phase **100% complete** hone ke baad hi agla phase shuru.
> Har phase ka apna **Goal + Deliverables + DoD (Definition of Done)** hai.
> Detailed spec: `plan.md` (features, schema, APIs, costs wahi hai — ye roadmap sirf **kab kaunsa kaam** batati hai).

---

## 🧭 PRODUCT IDENTITY (yaad rakhne wala)

```
Product:  Affiliate Autopilot AI SaaS
Positioning: "AI Marketing Operating System for Affiliate Marketers"
  — sirf tools ka collection NAHI, ek full loop:
  GOAL → RESEARCH → STRATEGY → CONTENT/VIDEO → PUBLISH → 
  COMMENT/DM → TRACK → OPTIMIZE → LEARN → REPEAT
Dashboard ka central sawaal: "Agle campaign mein kya karna chahiye?"
```

**4 Big Layers (A–Z map):**
```
LAYER 1: PUBLIC WEBSITE    → landing, features, pricing, resources, legal
LAYER 2: SAAS APPLICATION  → onboarding, dashboard, all modules
LAYER 3: AI ENGINE         → brain, agents, memory, autopilot loop
LAYER 4: BUSINESS SYSTEM   → billing, team, admin, support, security, infra
```

---

# ═══════════════════════════════════════
# PHASE 0 — FOUNDATION & INFRASTRUCTURE
# ⏱ Week 1–2
# ═══════════════════════════════════════

**🎯 Goal:** Khali mein nahi — solid base taaki har phase aaram se baithe.

### Deliverables
- [x] Monorepo setup (apps/web, packages/db — services/workers Phase 4 mein)
- [x] TypeScript + ESLint (Prettier + Husky — backlog mein)
- [x] CI: GitHub Actions (lint → test → build; preview/prod deploy jab Vercel push ho)
- [x] Database: Supabase PostgreSQL 17 + **schema v1** (plan.md §7 saari core tables — 21 live)
- [x] Migrations setup (Drizzle + Management-API applier — `scripts/apply-migration.cjs`)
- [x] Seed script (`pnpm db:seed` — demo user + workspace + character)
- [x] Auth framework: email/password live (NextAuth/Auth.js v5) + Google OAuth ready (env daalo chalu)
- [x] Workspaces + roles (owner create automatic, membership + autopilot defaults)
- [x] Dashboard shell (sidebar + overview + 11 module skeletons + onboarding wizard)
- [x] Secrets management — `.env.example` documented, `.env.local` git-ignored
- [ ] Redis + BullMQ queue wiring → **Phase 4 mein** (jab video queue chahiye)
- [ ] Object storage bucket (Cloudflare R2) + upload helper → Phase 4 (video storage ke saath)
- [ ] Sentry (errors) + structured logging → Phase 3 (pehla real user aane pe)
- [ ] **Architecture Decision Records (ADRs)** → Phase 1 ke saath (5–6 docs)
- [ ] Prettier + Husky pre-commit → backlog

### ✅ DoD (ye sab ho tab phase complete)
```
- Naya dev clone kare → 1 command pe local chal jaye          [x] pnpm install + pnpm dev
- Login → workspace banta hai → dashboard shell dikhe         [x] (credentials; Google = env add karo)
- CI green: lint + 10 tests pass                               [x] lint ✓ 10/10 tests ✓ build ✓
- Schema migrate ho jaye seed data ke saath                    [x] 21 tables + pnpm db:seed
```

---

# ═══════════════════════════════════════
# PHASE 1 — PUBLIC WEBSITE (Marketing Site)
# ⏱ Week 3–4
# ═══════════════════════════════════════

**🎯 Goal:** Signup se pehle ka poora customer journey — landing se lekar legal tak.

### Deliverables
**Pages (plan structure):**
- [ ] `/` Landing page (conversion journey — neeche section-wise spec)
- [ ] `/features` (module-wise: finder, links, content, video, autopilot, character, DM engine)
- [ ] `/solutions` — by niche (fitness, tech, beauty…), by use case, by size
- [ ] `/pricing` (Free / Starter $29 / Pro $79 / Agency $249 + BYOK −30%)
- [ ] `/integrations` (Amazon, ClickBank, IG, TikTok, YouTube, WhatsApp…)
- [ ] `/demo` (product tour / video)
- [ ] `/about`, `/contact`, `/security`
- [ ] `/customers` (placeholders — real aayenge launch ke baad; **fake numbers NAHI**)
- [ ] `/blog` + `/resources` skeleton (guides, templates)
- [ ] `/help` skeleton + `/docs` skeleton (Phase 7 mein bharenge)
- [ ] `/changelog`

**Landing page sections (spec ke hisaab se):**
- [ ] Announcement bar (launch offer / naya feature)
- [ ] Navbar (Product / Solutions / Resources / Pricing / Login / Get Started — desktop + mobile)
- [ ] **Hero:** headline + subhead + primary CTA + secondary CTA + product preview + AI activity visualization + trust signal
  - Draft headline: *"Your Affiliate Marketing Team, Running 24/7."*
- [ ] Social proof strip (real numbers only — beta waitlist count etc.)
- [ ] Problem section (too many tools → manual work → no attribution → slow optimization)
- [ ] Product intro visual (Goal → Research → Strategy → Content → Publish → Optimize loop)
- [ ] Feature blocks (video embed ke saath), How it works (3 steps)
- [ ] Character section (🎭 "Your AI persona that thinks & sells") — differentiator
- [ ] Testimonials (beta users se — genuine), FAQ, final CTA, footer

**Legal + trust:**
- [ ] Terms of Service, Privacy Policy, Cookie Policy, Refund Policy
- [ ] Acceptable Use + **AI Usage/Data Policy**
- [ ] Affiliate disclosure apne blog/links pe

**Technical:**
- [ ] SEO: meta, OG tags, sitemap, robots, JSON-LD, speed >90 (Lighthouse)
- [ ] Blog MDX setup (Phase 7 tak 2–3 sample posts)
- [ ] Email capture (waitlist/newsletter) → ESP integration
- [ ] Analytics: PostHog/GA4 + conversion events (signup click track)

### ✅ DoD
```
- Site live hai custom domain pe, mobile-perfect, Lighthouse >90
- Pricing page live, legal pages live, signup CTA → /signup pe jaata hai
- SEO index ready, OG image share acchi dikhti hai
```

---

# ═══════════════════════════════════════
# PHASE 2 — SAAS CORE SHELL (Auth → Onboarding → Dashboard)
# ⏱ Week 5–6
# ═══════════════════════════════════════

**🎯 Goal:** User aa sake, setup kar sake, app ghoom sake.

### Deliverables
**Auth (complete):**
- [ ] Signup/login: Google + email/password (+ email verification)
- [ ] Password reset, session management, logout everywhere
- [ ] Protected routes, RBAC middleware (owner/editor/viewer)

**Onboarding Wizard (5 steps — plan.md Flow A):**
- [ ] Step 1: Niche + audience + language + brand tone
- [ ] Step 2: Affiliate account connect (Amazon Associates / ClickBank) — OAuth/key
- [ ] Step 3: Social accounts connect (Instagram first, YouTube second)
- [ ] Step 4: 🎭 Character auto-create (naam = primary social handle + personality sliders + avatar)
- [ ] Step 5: Plan choose (billing Phase 3 mein live — abhi trial)
- [ ] Skip flows + progress save + resume

**App Shell:**
- [ ] Main dashboard layout (sidebar + topbar — plan.md §23 structure, affiliate modules ke naam se)
- [ ] Sidebar: Overview / Products / Links / Content / Videos / Calendar / DM Inbox / Character / Analytics / Settings
- [ ] **Command center home:** "Aaj kya hai" widget (empty states with next actions)
- [ ] Global search (Cmd+K) + notifications bell (in-app)
- [ ] Settings pages skeleton: Account / Workspace / Brand / AI / Notifications / Security / Billing
- [ ] Unified **Connections page** (kaunsa account connected, status, revoke)
- [ ] Token vault implementation (encrypted OAuth tokens — KMS/AES-256)

**Skeleton screens (data aayega baad mein):**
- [ ] Products, Content, Calendar, Analytics, DM Inbox — empty states + structure

### ✅ DoD
```
- Fresh user: signup → wizard complete → dashboard → connections dikhen
- Google OAuth token encrypted store + refresh chal raha ho (test)
- RBAC test: editor ko billing na dikhe
- Mobile responsive hai app
```

---

# ═══════════════════════════════════════
# PHASE 3 — MVP CORE (Pehla Sellable Product)
# ⏱ Week 7–11
# ═══════════════════════════════════════

**🎯 Goal:** Ye wo phase hai jahan product **bechne layak** ban jayega. 10 real users lao.

### Module A — Product Finder
- [ ] Amazon PA API fetch (best sellers, movers & shakers)
- [ ] ClickBank / Digistore integration (Amazon se pehle bhi chale sakta hai — easier access)
- [ ] AI Product Score 0–100 (commission, trend, rating, content-fit)
- [ ] Product library UI: filters, save, score breakdown, daily auto-refresh job

### Module B — Link Engine
- [ ] Auto affiliate link + UTM builder
- [ ] Short domain (`go.yourbrand.com`) + edge redirector (Cloudflare Worker)
- [ ] Click tracking + geo-smart redirect (Amazon.in/.com)
- [ ] Link health check (daily)

### Module C — AI Content Studio
- [ ] Captions, ad copy, scripts — 3 variants, platform-wise
- [ ] Brand voice settings + language (English/Hindi/Hinglish)
- [ ] Compliance layer: auto `#ad` + false-claim filter
- [ ] Content library (draft/approved/scheduled) + regenerate + edit

### Module D — Publishing (manual + schedule)
- [ ] Instagram + YouTube connect (Phase 0 se framework ready)
- [ ] Schedule calendar (week/month view, drag-drop)
- [ ] Post publish + retry + error states
- [ ] **Manual export fallback:** MP4/caption download + upload guide (jab tak TikTok audit na ho)

### Module E — 🔥 DM Sales Engine v1
- [ ] IG comment webhook → keyword trigger ("link", "price", "dm")
- [ ] Auto-reply comment with link (semi-approval mode: draft → user approve → send)
- [ ] Basic link-in-bio page (`go.site/handle`)
- [ ] Trigger rules UI (keywords, template, mode)

### Module F — 🎭 Character v1
- [ ] Character profile page (name from handle, avatar, personality sliders)
- [ ] **"Character Mind" thought journal** — daily strategy thought (AI generates)
- [ ] Character identity rules stored (guardrails)

### Module G — Billing (live)
- [ ] Stripe + Razorpay checkout, subscriptions (Free / Starter $29 / Pro $79 / Agency $249)
- [ ] Plan limits enforcement (products, scripts, platforms)
- [ ] Invoices, upgrade/downgrade, cancel, customer portal
- [ ] 7-day Pro trial (card required, 2 video trial limit)

### ✅ DoD (MVP LAUNCH CHECKLIST)
```
- Pura loop chalta hai: signup → connect → AI ne products dhunde → 
  link bana → caption bana → IG pe post hua → comment pe link gaya → 
  click track hua → payment aayi
- 10 real users onboard, unka feedback recorded
- Billing webhooks (success/failure/dunning) tested
- Basic docs: "Getting Started" guide
```

**🚀 MVP LAUNCH yahin hai — public beta announce karo.**

---

# ═══════════════════════════════════════
# PHASE 4 — VIDEO ENGINE 🎬
# ⏱ Week 12–16
# ═══════════════════════════════════════

**🎯 Goal:** Flagship feature — script se ready reel, platform pool se (user zero setup).

### Deliverables
- [ ] **Video provider abstraction** (interface: Veo / Kling / Pika / Runway — swap ho sake)
- [ ] Platform Pool: hamari Gemini/Veo key (server-side secret) + cost tracking `cost_usd/job`
- [ ] **BYOK slot:** Settings → apni Gemini key paste → −30% discount applied
- [ ] Prompt templates per mode (showcase, listicle)
- [ ] Scene splitter: script → 5–6 scenes → parallel clip generation
- [ ] FFmpeg worker (Docker): clips + voiceover + music + word-level captions → 9:16 MP4
- [ ] ElevenLabs voiceover (preset voices)
- [ ] Music library + auto-ducking
- [ ] Render queue: progress bar, retry, failure reasons, re-render
- [ ] **Render budget dashboard:** aaj ka spend, cost/video, plan quota used
- [ ] **Cost controls:** per-plan daily caps, daily $ circuit breaker, clip cache (same product reuse)
- [ ] 2 modes live: product showcase + listicle
- [ ] Video → auto-post reels (IG Reels / YouTube Shorts + TikTok jab audit ho)
- [ ] Media library (rendered videos, thumbnail picker)
- [ ] Quotas: plan-wise video limits (8/30/120) + top-up pack purchase ($19/10 videos)

### ✅ DoD
```
- Product select → "Generate video" → 3 min mein reel ready → auto-post
- Ek reel ka actual cost track + margin dashboard pe dikhe
- Queue 10 concurrent renders handle kare, failure retry ho
- Plan quota exceed pe sahi error + upsell dikhe
```

---

# ═══════════════════════════════════════
# PHASE 5 — AUTOPILOT 24/7 + CHARACTER DISCUSSION
# ⏱ Week 17–22
# ═══════════════════════════════════════

**🎯 Goal:** "Set it and forget it" — product actually automatic ho jaye.

### Module A — Autopilot Scheduler
- [ ] Saare cron jobs (plan.md §12): research 4am → scripts 5am → videos 6am → schedule 9am → posts day-long → analytics 10pm → report 11pm
- [ ] Autopilot levels: Manual / Semi / Full / Fire-and-forget (config UI)
- [ ] Daily post caps per platform, quiet hours, duplicate prevention (48h rule)
- [ ] Circuit breakers (API fail → pause + alert), pause/resume switch
- [ ] Job audit table + job history UI (kya hua, kyu fail)
- [ ] Notifications: in-app + email (new winner product, failed post, daily digest)

### Module B — Analytics & Reports
- [ ] Platform insights sync (IG/YT/TikTok APIs, 3–6× daily)
- [ ] Affiliate conversions sync (network APIs / import)
- [ ] Dashboard: clicks, CTR, conversions, earnings per product/post/platform
- [ ] **Weekly AI report** (email): kya chala, kya nahi, next week plan
- [ ] Revenue attribution: post → click → sale

### Module C — 🎭 Character v2 (Discussion Engine)
- [ ] **User se discuss:** chat — "kal kya post karein?" → character reasoning ke saath jawab
- [ ] **Audience se discuss:** comment replies in character voice (auto, approval levels)
- [ ] Unified DM inbox (sare platforms ek jagah) + AI suggested replies
- [ ] Personality guardrails test suite (kabhi claim na kare user ne jo na kaha)
- [ ] Thinking engine: daily journal + self-reflection (failed post → insight)

### Module D — 🔥 DM Sales Engine v2 (Funnel)
- [ ] Full DM auto-funnel (greet → pitch → link → follow-up)
- [ ] Semantic keyword matching ("kitne ka hai" jaise variants)
- [ ] TikTok / X / Facebook comment+DM triggers (jahan available)
- [ ] Attribution funnel UI: triggers → DMs → clicks → sales + top keywords
- [ ] Anti-spam: daily caps, 1-DM-per-user, quiet hours, blocklist, sentiment skip
- [ ] WhatsApp Click-to-Chat link generator (bot wala Phase 6)

### Module E — Trend Miner v1
- [ ] Trending hashtags/audio scan + viral affiliate post study
- [ ] Trend → remix suggestion (user approve)

### ✅ DoD
```
- 7 din chhod do: user ko sirf weekly report dikhe — posts khud jaate rahein
- Character Mind roz thoughts likhe + comments ka reply sahi personality mein
- DM funnel: comment → link → click → sale poora attributed
- Zero spam incidents (caps working), zero platform strikes
```

---

# ═══════════════════════════════════════
# PHASE 6 — INTELLIGENCE (AI Optimization + Copilot)
# ⏱ Week 23–28
# ═══════════════════════════════════════

**🎯 Goal:** Product sirf chale — **behtar chale**. AI khud sochke improve kare.

### Deliverables
- [ ] **Auto-Optimizer:** 24h pe post score → winners boost/remix, losers pause
- [ ] A/B testing engine: hooks, formats, posting times — auto winner selection
- [ ] Performance memory (pgvector): "is niche mein kya kaam karta hai"
- [ ] **AI Copilot chat:** context-aware ("next week plan banao") + actions from chat
- [ ] Campaign builder: goal → 7-day multi-content plan
- [ ] **"What should I do next?" command center** — AI proactive recommendations:
  *"3 opportunities found / 2 campaigns need attention / LinkedIn content 34% better"*
  → user Approve / Edit / Ignore
- [ ] Voice clone (30-sec sample → sab videos mein wahi awaaz)
- [ ] Video Remix: winning video → 1-click naye product pe
- [ ] **WhatsApp bot funnel** (India): incoming DM → auto product + link
- [ ] AI daily/weekly/monthly reports (What happened / Why / What next)
- [ ] 🎭 Character v3: voice notes (TTS in character voice), DM full-personality replies

### ✅ DoD
```
- Optimizer measurable lift dikhaye (CTR/conv % improvement week-over-week)
- Copilot se campaign ban jaye sirf ek message se
- User testimony: "meri performance 2x hui bina kuch kiye"
```

---

# ═══════════════════════════════════════
# PHASE 7 — GROWTH & PRODUCT SYSTEMS
# ⏱ Week 29–34
# ═══════════════════════════════════════

**🎯 Goal:** SaaS jaisa SaaS — support, docs, analytics, experimentation sab mature.

### Deliverables
**Support & Docs:**
- [ ] Help Center (articles: getting started, billing, video, DM engine, troubleshooting)
- [ ] Full Documentation: guides per module + API docs skeleton
- [ ] Changelog (public) + in-app announcements
- [ ] AI support bot (docs pe trained) + ticket system (email → dashboard)
- [ ] Status page (integrations health: IG API, TikTok, Veo…)

**Product Analytics:**
- [ ] Signup → activation → trial → paid funnels
- [ ] Feature usage tracking, retention cohorts, churn signals
- [ ] MRR/ARR/LTV/CAC + **AI cost per user** dashboard (admin)

**Experimentation & Safety:**
- [ ] Feature flags (internal → 5% → 25% → 50% → 100%)
- [ ] A/B tests on landing (headline, pricing display)
- [ ] **Audit log** (kisne kya kiya: user + AI actions dono)

**Growth:**
- [ ] Referral program (20% recurring / credit bonus)
- [ ] Email lifecycle: welcome → activation → trial ending → winback
- [ ] Blog: 4+ SEO posts (affiliate marketing guides — real value)
- [ ] Templates library (niche-wise content templates)

**Team & Knowledge:**
- [ ] Team invites + roles (owner/admin/editor/analyst/viewer) + approvals
- [ ] **Knowledge Base module:** user PDFs/docs/URLs upload → AI usse use kare

### ✅ DoD
```
- Support tickets ka median first-response < 24h
- Activation funnel instrumented: kahan drop ho raha dikhe
- Feature flags se ek feature safely 100% tak roll out hua
- Docs ke saath ek naya user bina help liye first video bana le
```

---

# ═══════════════════════════════════════
# PHASE 8 — ADMIN, SECURITY & HARDENING
# ⏱ Week 35–38
# ═══════════════════════════════════════

**🎯 Goal:** Andar se strong — abuse rokna, security solid, operations chalne layak.

### Deliverables
**Admin Panel (internal):**
- [ ] Users / Organizations / Subscriptions / Revenue
- [ ] AI usage + **AI costs** (per workspace, per feature — margin alert)
- [ ] Job/queue monitoring, integration health, abuse detection
- [ ] Support inbox, audit logs, feature flag controls, system health

**Security hardening:**
- [ ] 2FA, session management UI (device list, revoke)
- [ ] RBAC audit + org isolation tests (koi dusre workspace ka data na dikhe)
- [ ] Rate limiting (API + DM + renders), WAF/CDN rules
- [ ] Secret rotation, backup + **restore drill**, data deletion (GDPR)
- [ ] Pen test (internal pass) + dependency scanning (Dependabot/Snyk)
- [ ] API keys UI (scoped, revoke, usage)

**Quality:**
- [ ] Unit + integration + E2E (Playwright) — critical paths: signup, billing, post, DM, render
- [ ] Billing tests (proration, downgrade limits, dunning)
- [ ] AI regression tests (prompt outputs sanity) + load test (queue surge)
- [ ] Visual UI testing (screenshot diffs)

**Compliance:**
- [ ] AI disclosure policies live (posts + DMs)
- [ ] Data processing inventory + subprocessor list public

### ✅ DoD
```
- Security checklist pass, zero critical findings
- Restore drill: DB backup se live recover < 1 ghanta
- E2E suite green on every deploy
- Admin se ek refund + ek workspace suspension complete ho sake
```

---

# ═══════════════════════════════════════
# PHASE 9 — SCALE & ENTERPRISE (Ongoing)
# ⏱ Week 39+
# ═══════════════════════════════════════

**🎯 Goal:** Bade customers, bade channels, bade dreams.

### Deliverables
- [ ] **Developer Platform:** REST API + webhooks + OAuth apps + rate limits + developer docs + logs
- [ ] **Enterprise plan:** SSO/SAML/SCIM, advanced permissions, custom limits, SLA, audit exports, dedicated support, security review
- [ ] More integrations: Meta Ads/Google Ads (advertising autopilot), CRM (HubSpot), WordPress/Shopify publish
- [ ] SEO/GEO engine (keyword research, content briefs, AI-answer visibility)
- [ ] Email marketing module (sequences, newsletters)
- [ ] Mobile app (React Native / PWA) — notifications + approvals on the go
- [ ] 🎭 Character-to-character collaboration (cross-promo network)
- [ ] Coupon engine (DM pe unique codes), comment-to-story, multi-product cart links
- [ ] Marketplaces: templates / niches / UGC creators
- [ ] Regional languages (Tamil, Telugu, Bengali content + dub)
- [ ] Multi-region infra (latency) + cost optimization (reserved AI capacity)

### ✅ Ongoing KPIs (har phase track karo — plan.md §19)
```
Product:   WAU/MAU, activation %, D30 retention, autopilot-on %
Content:   renders/day, success rate, posts/day
Business:  MRR, trial→paid, churn, ARPU, CAC/LTV
Quality:   clicks/post, customer commissions tracked
Infra:     job failure %, p95 render time, cost/active workspace/day
```

---

# 📅 PHASE SUMMARY (ek nazar mein)

| Phase | Naam | Weeks | Bahar kya milega |
|---|---|---|---|
| **0** | Foundation | 1–2 | Repo, DB, auth, queues, ADRs |
| **1** | Public Website | 3–4 | Live landing/pricing/legal 🌐 |
| **2** | SaaS Core Shell | 5–6 | Onboarding + dashboard + connections |
| **3** | **MVP Core** | 7–11 | **SELLABLE product + billing** 🚀 |
| **4** | Video Engine 🎬 | 12–16 | AI reels auto-generate |
| **5** | Autopilot + Character | 17–22 | 24/7 auto + DM funnel + discussion |
| **6** | Intelligence | 23–28 | Optimizer + Copilot + reports |
| **7** | Growth Systems | 29–34 | Docs, support, analytics, flags |
| **8** | Admin + Security | 35–38 | Admin panel, hardening, tests |
| **9** | Scale + Enterprise | 39+ | API, SSO, mobile, new modules |

**Total to Phase 8 (production-grade): ~38 weeks (~9 months)**
**Agar solo/2-person team ho toh → Phase 3 tak ~6–7 hafte realistic honge (MVP fast track)**

---

# 🎯 WORKING RULES (hum follow karenge)

1. **Ek phase ek time** — Phase X ka DoD pass = tabhi Phase X+1 shuru
2. Har phase ke end pe: **demo + checklist review** (aap approve karo)
3. Jo feature beech mein add karna ho → us phase ke **"Later" backlog** mein jayega, raasta na todde
4. Har phase ke baad `plan.md` + ye roadmap **update** (scope drift track)
5. Priority order hamesha: **Revenue features > Wow features**
   - Isliye Video (Phase 4) DM Engine v1 (Phase 3) ke baad, Character full (Phase 5) baad mein

---

# 🅱️ BACKLOG (baad ke liye — abhi mat bhoolo)

- Pre-lander / landing page AI generator
- Competitor intelligence module (competitor posts/offer monitor)
- Email marketing + newsletter module
- SEO/GEO engine
- Ads autopilot (Meta/Google Ads spend optimization)
- Lead gen + CRM sync (HubSpot/Salesforce)
- Multi-language content + dubbing
- Mobile app
- Template marketplace
- Enterprise SSO/SAML
