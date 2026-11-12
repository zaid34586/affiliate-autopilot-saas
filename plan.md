# 🚀 Affiliate Autopilot AI SaaS — Complete Platform Plan

> **Working title:** AutoAffiliate AI (badal sakte hain)
> **Vision:** Ek SaaS jisme user apna affiliate account + social accounts connect kare → AI 24/7 best products dhundhe, unke liye ads/reels/UGC videos banaye, auto-post kare, track kare aur optimize kare — user sirf dashboard dekhe.
> **Status:** PLAN v1.2 (FINAL video model) — ✅ Decision: **Platform Pool DEFAULT + BYOK OPTIONAL**. User-own Google Flow OAuth model hata diya (ToS + reliability + UX issues). Review karo, feedback do.

---

## TABLE OF CONTENTS

1. Product Vision & Positioning
2. User Personas & Use Cases
3. Feature List (Full Module-wise)
4. User Journey / Flows
5. System Architecture
6. Tech Stack
7. Database Schema (all tables)
8. API Design (endpoints)
9. AI Pipelines (detailed)
10. Video Generation Engine (Google Flow/Veo)
11. Integrations (OAuth + Affiliate Networks)
12. Autopilot Scheduler (24/7 jobs)
13. Multi-Agent AI System
14. Monetization & Pricing
15. Security & Compliance
16. Folder Structure
17. Roadmap (Phase 0–5)
18. Cost Estimates (AI API costs)
19. KPIs & Metrics
20. Risks & Mitigations
21. Environment & Secrets
22. Open Questions (decisions pending)

---

## 1. PRODUCT VISION & POSITIONING

### Problem
Affiliate marketers ke paas time nahi: product dhundna, link banana, content likhna, video banana, post karna, track karna — sab manual hai. Beginners ko pata hi nahi chalta kaunsa product bechega.

### Solution
Ek autopilot: **research → content → publish → optimize**, sab AI kare 24/7.

### Positioning
- "Set your niche once, get affiliate content on autopilot"
- NOT a "get rich quick" promise — marketing claim: **"AI-powered content engine + analytics"**
- Differentiator: **AI video (Veo) se ready-to-post reels**, sirf text captions nahi

### Target users
1. **Beginner affiliate marketers** — samajh nahi content kaise banayein
2. **Creators/influencers** — jo affiliate revenue chahte hain bina editing ki
3. **Small agencies** — ek saath 5–20 brands manage karne
4. **E-commerce/brand owners** — apne products ke liye UGC ads chahiye

---

## 2. USER PERSONAS & USE CASES

| Persona | Kya karega |
|---|---|
| **Rohit, 22, beginner** | Niche "fitness gadgets" set kare → autopilot on → daily 3 reels + 5 posts jaate rahein |
| **Priya, creator** | Apni voice clone + avatar use karke product review reels banwaye, Instagram pe schedule kare |
| **Agency owner** | 10 client workspaces, har ek ka alag brand tone, team members invite kare |
| **Power user** | API se content le, apne system mein use kare; custom posting schedule; A/B tests chalaye |

---

## 3. FEATURE LIST (Full Module-wise)

### 3.1 Onboarding & Auth
- Google OAuth login (primary), email/password, Apple (later)
- Onboarding wizard (3 steps):
  1. Niche select (dropdown + custom): fitness, tech, beauty, home, finance…
  2. Connect affiliate networks (Amazon Associates, ClickBank, Digistore24, ShareASale, Impact, CJ)
  3. Connect social accounts (Instagram, TikTok, YouTube, X, Pinterest, Facebook, LinkedIn)
- Workspace creation, team invite (roles: owner, editor, viewer)
- Billing setup (Stripe/Razorpay)

### 3.2 Product Discovery Engine
- **Source-wise fetch:**
  - Amazon Product Advertising API — Best Sellers, Movers & Shakers, Most Wished For
  - ClickBank — marketplace gravity/sort
  - Digistore24, ShareASale, Impact, CJ — offers API
  - Custom CSV/API import (user khud product de sake)
- **AI Product Score (0–100)** based on:
  - Commission %, price point, gravity/trend
  - Review rating & review count
  - Competition level (kitne log promote kar rahe)
  - Content-fit score (kya isse acchi reels ban sakti hain)
  - Seasonality & 30-day trend
- Filters: niche, price range, commission min, marketplace, language/region
- Auto-refresh: daily job se naye winners add, flops archive
- **Product Library** — saved/favorited products, historical score graph

### 3.3 Link Management
- Auto affiliate link generation (API deep-link ya network dashboard link paste)
- UTM builder: `{source}_{medium}_{campaign}_{content}`
- Own short domain (e.g. `go.yourbrand.com/xyz`) + QR code
- Link health check (daily): dead/redirect-broken links auto-flag
- Click tracking: per post, per product, per platform (redirector with analytics)
- Geo-smart redirect (India user → Amazon.in, US → Amazon.com)

### 3.3A 🔥 SMART LINK & DM SALES ENGINE (naya — "comment/DM se auto link bhejo")

> **Core flow (aapki demand):** Koi post dekhe → comment kare ("link chahiye", "price?", "kahan se le") → **system khud DM mein link bhej de** → wo kharide → sale track ho. User sirf setup kare, baaki auto.

**A. Comment → Auto DM (keyword triggers)**
```
Reel post hui (product X ka affiliate link ke saath)
  → Koi comment karta hai: "link" / "price" / "kahan milega" / "dm me"
  → Character (user ke naam se) 30-sec mein DM karta hai:
     "Haan bhai! Ye raha link 👉 go.site/x9k 
      (₹999 ka hai, 30% off chal raha hai — jaldi dekh le)"
  → Sale hui → post ke saath attributed → dashboard mein dikha
```
- **Smart reply text:** AI khud likhe comment ke hisaab se
  - "price?" → price + discount + link
  - "doubt hai" → short answer + link
  - negative/cuss words → ignore ya polite decline (character guardrail)
- **Keyword sets:** user apne keywords set kare (link, price, buy, kahan, dm, order) + AI semantic match (sirf exact word nahi — "kitne ka hai" bhi samjhe)
- **Rate limits:** ek user ko 1 baar DM (spam safe), daily DM caps (platform rule)
- **Approval modes:** 🔴 auto-send OFF (draft approve) | 🟡 semi | 🟢 full auto — naye user pe semi default

**B. DM Auto-Reply Funnel (DM aaye toh)**
```
User khud DM karta hai: "ye product batana"
  → Step 1 (instant): greet + product summary
  → Step 2: link + offer + urgency ("aaj 20% off")
  → Step 3 (agar 2 ghante baad reply na aaye): follow-up — "aur kuch?"
  → Step 4: agar haan/purchase intent → checkout link + QR
  → Sara conversation Character ki personality mein
```
- **DM inbox ek jagah** — sab platforms ke DMs unified dashboard mein
- AI suggested replies (user click karke bhej sake) ya full auto
- Product recommendations: user poochhe "aur kuch accha hai?" → top 3 products + links

**C. Link-in-Bio Smart Page (har user ko ek landing)**
```
go.site/fitwithrohit  →  bio page:
  ┌────────────────────────────┐
  │  🎭 FitWithRohit           │
  │  [Featured product] + link │
  │  [Top 5 products list]     │   ← har item pe apna affiliate link
  │  [Latest reel]             │
  │  Newsletter signup         │
  └────────────────────────────┘
```
- Auto-update: naya winner product aaya → bio page pe top pe chala gaya
- A/B test: 2 bio versions → kaunsa zyada click deta hai
- Pixel/UTM tracking har click pe

**D. WhatsApp Auto-Sales (India ke liye killer feature)**
- Post/comment pe **WhatsApp Click-to-Chat** link: `wa.me/91xxx?text="link do"`
- User WhatsApp pe aaye → **WhatsApp bot** auto-reply kare product summary + link
- Abandoned follow-up: link diya par 24h mein click nahi → gentle reminder (opt-in users)
- WhatsApp Business API se — official, safe

**E. Universal Comment Engine (sab platforms)**
| Platform | Comment trigger | DM capability |
|---|---|---|
| Instagram | ✅ comments API (webhook) | ✅ DM API (24h window rule) |
| TikTok | ✅ comments | ⚠️ DM limited → comment reply pe link |
| YouTube | ✅ comments | ❌ → comment reply + pinned link |
| X | ✅ mentions | ✅ DM (API plan chahiye) |
| Facebook | ✅ | ✅ Messenger |
| Pinterest | ❌ | ❌ → link in pin |

*Rule: jahan DM na ho, wahan **public comment reply** with link (YouTube model) — sab jagah fallback*

**F. Attribution & Sales Tracking (kaun sa link becha)**
- Har DM/comment se bheja gaya link **unique** hota hai (`go.site/x9k?src=dm_ig_abc`)
- Path: comment → DM → click → affiliate conversion → **"ye sale meri DM engine se hui"**
- Dashboard: `DMs sent → clicks → sales → revenue` funnel
- **Top trigger words:** kaunse keyword se sabse zyada sale ("price" se 40%, "link" se 25%…)

**G. Anti-spam & Safety (bahut zaroori)**
- Platform ke official APIs ONLY (scraping nahi)
- Daily caps: IG 100 DMs/day/workspace (default, adjustable niche-wise)
- Duplicate suppression: ek user ko ek product ka link sirf ek baar
- Quiet hours (raat 10am–8am nahi bhejte)
- Block list + negative sentiment auto-skip
- Human approval queue for risky replies
- **Disclosure:** sales DM mein `#ad / affiliate` line hamesha

**H. Advanced add-ons (Phase 5)**
- **Comment-to-story:** user comment kare → uska comment story pe feature ho (social proof)
- **Voice note replies** (character ki awaaz mein — TTS)
- **Coupon engine:** DM mein unique discount code generate ho (network coupon API)
- **Multi-product cart link:** ek DM mein 2-3 products ka combined list
- **Sell-through chat:** character poora negotiation/close kare (intent detect → price → urgency → link → thank you)

### 3.4 Content Factory (AI Copy)
- **Ad copy:** Facebook/Google/TikTok ad variants (5 A/B versions per product)
- **Post captions:** platform-wise (Instagram long + hashtags, X short thread, Pinterest description)
- **Reel/Short scripts:** hook (first 2 sec) → problem → product → proof → CTA
- **Email swipes:** for list-based affiliates
- **Landing page copy:** pre-sell page text (later: AI pre-lander generator)
- Brand voice settings: tone (funny/authoritative/casual), language (English/Hindi/Hinglish/regional), audience, banned words
- Content types: review, comparison, listicle ("3 reasons"), unboxing, testimonial style, tutorial
- Compliance layer: auto `#ad` / "affiliate disclosure" add, false-claim filter

### 3.5 Video Engine (⭐ flagship) — **Platform Pool DEFAULT + BYOK OPTIONAL**

**✅ FINAL model (v1.2): "Ek click, zero setup"**

**Mode A — Platform Pool (DEFAULT — 95% users ke liye)**
- Hamari **Gemini/Veo API keys** (Google Cloud project) se video banti hai
- User ko **kuch connect nahi karna** — sirf "Generate" button → 2–3 min mein reel ready
- Cost plan price mein **bundled** (jaise InVideo/Pictory/Synthesia karte hain)
- Per-plan video quota: Starter 10/mo, Pro 40/mo, Agency 150/mo
- Har render ka actual `cost_usd` track → plan profitability live dikhe
- **Circuit breaker:** daily platform cost cap → limit aaye toh renders queue mein rukein, billing alert jaye

**Mode B — BYOK (OPTIONAL — power users ke liye)**
- User apni **Gemini/GCP API key** paste kare (Settings → Video Provider)
- Uske **apne billing** se render hota hai → usse **30% subscription discount**
- Hamara platform cost bachta hai, user ko sasta padta hai — win-win
- Key encrypted store, user kabhi bhi hata sakta hai (wapas Mode A)
- **Sirf apni key ka support** — multi-account rotation/Flow automation bilkul NAHI (ToS violation)

**❌ Rejected model:** Google Flow consumer OAuth (Flow ka official API hi nahi hai, automation = ban risk) — ye plan mein kahin nahi hoga.

**Render cost control (taaki margin rahe):**
- Primary: **Veo 3 Fast** (sasta) — hero shots ke liye
- B-roll/quick clips: cheaper fallbacks (Kling/Pika/Wan)
- 4–5 clips per 30-sec reel (6+ nahi), scene reuse cache (same product ke clips dubara generate nahi)
- Target cost: **$1.5–3 per reel** → Pro plan (40 videos) pe healthy margin

**Pipeline kaise chalega:**
```
AI Script (product ke liye) 
  → Scene breakdown (hook, problem, product, CTA)
  → Veo/Flow clips generate (PLATFORM KEY ya user BYOK key se)
  → ElevenLabs voiceover
  → Auto-edit (FFmpeg): clips + voice + captions + music
  → 9:16 Reel ready → auto-post
```
- **Video modes:**
  1. Cinematic product showcase (B-roll style)
  2. UGC talking-head (AI avatar)
  3. AI actor testimonial (Veo 3 dialogue + lip sync)
  4. Comparison split-screen
  5. Listicle fast-cut
  6. Screen-recording + voiceover (for software products)
  7. Slideshow/motion-graphics (budget mode)
- Voiceover: ElevenLabs (preset voices + user voice clone, 30-sec sample)
- Auto captions: word-by-word highlighted (CapCut style), brand font/color
- Background music: licensed library, beat-synced cuts, auto ducking under voice
- Auto-resize: 9:16, 1:1, 16:9
- Output: MP4 ready-to-upload + thumbnail frame
- **Remix:** ek winning video template → naye product pe 1-click regenerate
- Render queue with progress bar, retry on failure

### 3.6 Creative Studio (Images)
- Product hero images, lifestyle mockups, ad creatives (AI image gen)
- Text-on-image ad variants (offer price, rating, CTA badge)
- Thumbnail generator (YouTube/Pinterest)
- Background remover, size variants

### 3.7 Publishing & Scheduling
- **Connect via official APIs only:**
  - Instagram/Facebook: Meta Graph API (reels, stories, feed posts)
  - TikTok: Content Posting API
  - YouTube: Data API v3 (Shorts upload)
  - X, Pinterest, LinkedIn: post APIs
- Calendar view (drag-drop), queue, bulk schedule
- Best-time-to-post (audience analytics se auto-suggest)
- Timezone-aware scheduling
- Failure handling: retry ×3, error notification
- Hashtag/mention auto-append, first-comment feature (CTA comment)
- Approval mode: draft → user approve → post (or full autopilot)

### 3.8 Analytics & Optimization
- **Dashboard:**
  - Clicks, CTR, conversions, earnings per product/post/platform
  - Affiliate network earnings sync (API ya CSV/report import)
  - Top performers, trending products
- **Content score:** engagement + conversion per format → AI insight
- **Auto-optimizer:**
  - Losers pause (low engagement after N hours → don't repost that angle)
  - Winners boost (remix + repost best content)
  - Best posting time re-learn weekly
- Weekly AI report (email/WhatsApp/in-app): kya chala, kya nahi, next week plan

### 3.9 Autopilot Brain 2.0
- Levels: **Manual → Semi (approve) → Full (auto) → Fire-and-forget**
- Daily cron pipeline (see §12)
- Notification system: in-app + email + WhatsApp (new winning product, post failed, weekly report)
- User "pause autopilot" switch, per-platform switches
- Guardrails: max posts/day per platform, niche-safe filter, budget for paid promotion (later)

### 3.10 AI Marketing Copilot (Chat)
- Chat sidebar: "fitness niche ke liye next week ka plan banao"
- Context: past performance, trending products, platform trends
- Actions from chat: "ye product ka reel banao", "kal 6 baje post karo"
- Campaign builder: goal → AI poora campaign banaye (7-day content plan)

### 3.11 Trend Miner
- Scrape/monitor trending audio, hashtags, formats (Reels/TikTok trends)
- Viral affiliate posts study → winning angle extract
- Trend → auto-apply to user's product content (remix)

### 3.12 SaaS Core
- Plans & credits system (video renders, AI words, posts — per-plan quotas)
- Stripe (international) + Razorpay (India) billing, invoices
- Referral program (user dusre ko invite kare → credits)
- Usage metering, overage handling
- Admin panel: users, jobs, content moderation, revenue
- Status page, in-app announcements
- Docs/help center, live chat (later)

### 3.13 🎭 AI CHARACTER MODULE (naya — "sochta aur discuss karta" persona)

**Concept:** Har workspace ka ek **AI Character** hota hai — uska naam **user ke social media account name se hi aata hai** (jo account connect kiya). Ye character sochta hai (thinking engine), discuss karta hai (user + audience dono se), aur usi identity se content/engagement karta hai.

**A. Character Creation (auto, from connected accounts)**
```
User connects accounts (Instagram @fitwithrohit, YouTube "FitWithRohit") 
  → Character auto-ban jata hai:
     name = primary social handle ("FitWithRohit")
     aliases = dusre sabhi connected handles
     avatar = AI-generated matching user's niche (+ user upload apni photo)
     bio/voice/tone = onboarding se + past posts se learn
  → User edit kar sake: name, personality, language, values
```

**B. Thinking Engine (chain-of-thought — character soche)**
- **Daily thought journal:** character roz sochta hai likhta hai:
  *"Kal ka trending audio fitness mein hai, mere @fitwithrohit audience 18-24 hain, isliye wo angle try karunga, par pehle kal wale product ka follow-up dena chahiye..."*
- User ko **"Character Mind" page** pe live dikhe — character ki reasoning, plans, doubts
- **Self-reflection loop:** post performance dekh ke character sochta hai *"ye kaam nahi kiya, kyunki hook weak tha — next time question hook"*
- Decisions with confidence + alternatives (visible reasoning, no black box)

**C. Discussion Engine (character discuss kare)**
- **User se discuss:** chat with your own character — *"kal kya post karein?"* → character opinion de reasoning ke saath → user haan/bol → plan update
- **Audience se discuss (auto, mode-controlled):**
  - Comments ka reply character ke tone mein (sarcastic/helpful/short — personality se)
  - DMs ka smart reply (FAQ auto, baaki user ko draft bhejo approve ke liye)
  - Trending conversations mein joining (niche discussions, jahan allowed ho)
  - Har reply pe compliance: affiliate disclosure auto, no false claims
- **Character-to-character:** (advanced) do users ke characters collaborate karein — shoutout/cross-promo idea discuss karein
- **Personality controls:** humor %, formality, emoji usage, reply length, Hinglish vs English — sliders

**D. Identity Rules (important)**
- Character **hamesha connected account ka naam hi use kare** — Instagram pe @fitwithrohit, YouTube pe FitWithRohit (consistency)
- Platform ke hisaab se identity map hoti hai (ek character, multiple handles — sab same persona)
- **Disclosure:** automated replies pe platform-required AI标识 (#AI-assisted jahan zaroori), kyunki impersonation policy risk hai — apna hi account hai par bot-label hona chahiye
- Character kabhi user ke naam se koi aisa claim nahi karega jo user ne na kaha ho (guardrails)

**E. Character Memory**
- Long-term memory (pgvector): kaunse discussions hue, user kya bolta hai, audience kya poochti hai
- Personality drift protection: weekly review — character waisa hi rahe jaisa setup tha
- Character evolves only jab user explicitly badle

---

## 4. USER JOURNEY / FLOWS

### Flow A: First-time setup (target < 7 min)
```
Sign up (Google) → Wizard:
  Step 1: Niche + audience + language
  Step 2: Connect affiliate account(s)
  Step 3: Connect social accounts (skip allowed)
  Step 4: 🎭 Character auto-create — naam = social handle,
          personality sliders set karo, avatar choose
  (Video setup ki zaroorat NAHI — platform pool default hai;
   advanced Settings mein jaake BYOK key optional add kar sakte hain)
→ Dashboard: AI pehla product batch dikhaye (5 best products)
→ Character Mind dikhaye: "Maine socha — ye 5 product best hain kyunki..."
→ "Start Autopilot" button → plan choose → done
```

### Flow B: Daily autopilot (user kuch na kare)
```
04:00 Research Agent: 20 products scanned → top 5 shortlisted
05:00 Script Agent: 5 products × 3 scripts
06:00 Video Agent: 15 videos render queue mein
08:00 Voiceover + edit + captions complete
09:00 Compliance check pass → schedule queue
10:00–21:00 Publisher: best times pe post (per platform rules)
18:00 Trend Miner: 1 viral trend → 1 remix video add
22:00 Analytics sync → optimizer: 2 underperformers archive, 1 winner repost
23:00 Report: "Today: 6 posts, 1,240 clicks, 14 sales ($38.20 est.)"
```

### Flow C: Manual content creation
```
Product library → product select → "Generate content"
  → format choose (reel / ad / caption / carousel)
  → AI generates (3 variants) → preview → edit (studio) → schedule/post
```

---

## 5. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│            Next.js (App Router) + Tailwind + shadcn         │
│   Dashboard · Calendar · Studio · Analytics · Settings       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (REST + WebSocket live updates)
┌──────────────────────────▼──────────────────────────────────┐
│                     API LAYER (Node.js)                     │
│  Auth · Products · Content · Videos · Posts · Analytics      │
│  Billing · Integrations (OAuth token vault)                 │
└──────┬───────────────────┬───────────────────┬──────────────┘
       │                   │                   │
┌──────▼──────┐   ┌────────▼────────┐   ┌──────▼──────────────┐
│ PostgreSQL  │   │  Redis + BullMQ │   │  Object Storage     │
│ (+pgvector) │   │  Job queues     │   │  (S3 / Cloudflare   │
│ main data   │   │  scheduler      │   │   R2: videos/images)│
└─────────────┘   └────────┬────────┘   └─────────────────────┘
                           │ workers (Python + Node)
        ┌──────────────────▼───────────────────────┐
        │            AI WORKER POOL                │
        │  Research · Script · Video · Voice · Edit│
        │  Compliance · Publish · Analytics        │
        └───┬──────────┬──────────┬────────────┬───┘
            │          │          │            │
      Google Veo   ElevenLabs  OpenAI/Gemini  HeyGen
      (Flow)       voice       copy/strategy  avatar
            │
      External APIs: Meta Graph · TikTok · YouTube ·
      Amazon PA API · ClickBank · Stripe · Bitly
```

**Principles:**
- Sab heavy kaam **queue-based workers** mein (request timeout nahi hoga)
- **Idempotent jobs** — retry safe
- **Webhook receivers** for: payment events, social post status, analytics pulls
- **Token vault** — saare OAuth tokens encrypted (AES-256, KMS-managed keys)

---

## 6. TECH STACK

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query | Fast, SSR, ecosystem |
| Charts | Recharts / Tremor | Dashboard |
| Backend API | Node.js (Next.js route handlers) + some Python (FastAPI) for AI workers | TS end-to-end + Python AI libs |
| AI orchestration | LangGraph or simple custom queue (start simple!) | Multi-step pipelines |
| DB | PostgreSQL (Neon/Supabase/RDS) | Relational + pgvector |
| Cache/Queue | Redis + BullMQ (node), RQ/Celery (python) | Reliable jobs |
| Scheduler | BullMQ repeatable jobs / cron + a "scheduler service" | 24/7 autopilot |
| Video edit | FFmpeg (serverless/container) | Concat, captions, resize |
| Video gen | Google Veo (Flow) primary; Runway / Kling / Pika as fallback | Cinematic clips |
| Avatar | HeyGen API / Veo 3 dialogue | UGC talking head |
| TTS | ElevenLabs (voice clone) | Best quality |
| Copy/LLM | GPT-4.x / Gemini 2.x (cost mix: Gemini for bulk, GPT for strategy) | Cost control |
| Images | Imagen / DALL·E / SDXL via API | Creatives |
| Storage | Cloudflare R2 (S3-compatible, no egress fee) | Video files |
| Auth | NextAuth/Auth.js (Google + credentials) + optional Clerk | Fast setup |
| Payments | Stripe + Razorpay | Global + India |
| Analytics events | PostHog (product analytics) + custom | User behavior |
| Errors | Sentry | Job/API failures |
| Hosting | Vercel (web) + Railway/AWS Fargate (workers, FFmpeg) | Scale workers separately |
| Secrets | Doppler / AWS SSM | Safe env mgmt |
| CDN/short links | Cloudflare Workers (redirector + click logs) | Fast link tracking |

---

## 7. DATABASE SCHEMA (all core tables)

### users
`id, email, name, avatar_url, auth_provider, created_at, onboarding_done, timezone, language`

### workspaces
`id, name, owner_user_id, plan, credits_balance, created_at`

### workspace_members
`id, workspace_id, user_id, role (owner/editor/viewer), invited_at`

### connections (all OAuth/social/affiliate)
```
id, workspace_id,
provider (instagram|tiktok|youtube|x|pinterest|facebook|linkedin|
          gemini_byok|amazon_pa|clickbank|digistore|
          shareasale|impact|cj|stripe),
account_id, account_name, account_avatar,
access_token_enc, refresh_token_enc, token_expires_at,
api_key_enc (BYOK: user ki apni Gemini/GCP key — optional),
scopes, status (active|expired|revoked), created_at
```
```
NOTE: Google Flow OAuth connection nahi hai (rejected model).
Video provider = platform pool (default, server-side key) ya
user BYOK (optional, discount ke against).
```

### characters (AI persona — naam connected social account se)
```
id, workspace_id,
name,                          # = primary social handle, e.g. "FitWithRohit"
aliases jsonb,                 # all other connected handles
avatar_key, bio, tone_config jsonb (humor, formality, emoji, languages),
personality sliders jsonb,
memory jsonb / memory_embedding (pgvector),
thinking_log jsonb,            # daily thought journal entries
discuss_settings jsonb         # auto-reply modes: comments|dm|none + approval level,
guardrails jsonb (banned claims, disclosure text),
created_at
```

### thinking_journal (character ke daily thoughts)
`id, character_id, date, thought_text, reasoning jsonb, decision, confidence, influenced_jobs[]`

### character_conversations
`id, character_id, with (user|audience), channel (inapp_chat|comment|dm),
 thread_id, messages jsonb, sentiment, action_taken, approved bool, created_at`

### dm_triggers (comment→DM keyword rules)
```
id, workspace_id, post_id?, keywords jsonb (set + semantic on/off),
reply_template, ai_custom bool, mode (manual|semi|auto),
cooldown_hours, daily_cap, quiet_hours, enabled
```

### dm_messages (har automated message ka record)
```
id, workspace_id, character_id, platform, channel (comment_reply|dm|whatsapp),
recipient_handle, trigger_keyword, post_id?, product_id?,
body, unique_link_code, status (queued|sent|failed|blocked),
sent_at, click_at?, conversion_id?
```

### bio_pages
`id, workspace_id, slug (go.site/handle), layout jsonb, blocks jsonb
(featured product, top5, latest reel), ab_variant, clicks, created_at`

### dm_funnel_analytics
`id, workspace_id, date, platform, triggers_fired, dms_sent, link_clicks,
conversions, revenue, top_keywords jsonb`

### niches / brand_profiles
`id, workspace_id, niche, audience_desc, tone, languages[], banned_words[], sample_voice_ref`

### products
```
id, workspace_id, source (amazon|clickbank|...), source_id,
title, image_url, price, currency, commission_type, commission_value,
category, rating, review_count, gravity/trend_score,
ai_score (0-100), ai_score_breakdown jsonb, status (active|archived),
first_seen_at, last_analyzed_at
```

### affiliate_links
```
id, product_id, workspace_id, raw_url, deep_link, short_code,
short_url, utm jsonb, geo_rules jsonb, health (ok|broken),
clicks_total, created_at
```

### contents (all generated content)
```
id, workspace_id, product_id, type (caption|ad_copy|script|video|image|email),
platform_target, variant_number, body(jsonb — script scenes/text),
language, tone, status (draft|approved|scheduled|published|failed),
ai_model_used, cost_credits, compliance_ok bool, created_at
```

### videos
```
id, content_id, workspace_id, mode (showcase|ugc|testimonial|comparison|listicle),
resolution, aspect, render_status (queued|rendering|done|failed),
storage_key, duration_sec, thumbnail_key, voice_id, music_track,
render_log jsonb, cost_usd, created_at
```

### posts (published/scheduled)
```
id, workspace_id, content_id, video_id?, connection_id,
platform, platform_post_id, scheduled_at, published_at,
status (scheduled|publishing|published|failed), error, retry_count,
permalink, first_comment_text
```

### click_events (redirector logs)
`id, short_code, ts, ip_hash, geo, user_agent, referrer, post_id?, product_id, clicked_country`

### conversions (from affiliate networks)
`id, workspace_id, network, product_id, order_id, amount, commission, currency, status (pending|approved|reversed), detected_at`

### analytics_daily
`id, workspace_id, date, platform, post_id, impressions, likes, comments, shares, saves, clicks, conversions, revenue`

### trend_items
`id, type (audio|hashtag|format|viral_post), source, data jsonb, score, region, detected_at, expires_at`

### schedules / autopilot_config
`id, workspace_id, level (manual|semi|full|fire_and_forget), daily_post_limits jsonb, active_platforms[], quiet_hours, timezone, paused bool`

### jobs_audit (every pipeline run)
`id, workspace_id, job_type, status, started_at, finished_at, input jsonb, output jsonb, error, cost_usd`

### credits_ledger
`id, workspace_id, delta, reason (video_render|ai_words|topup|refund|bonus), ref_id, created_at`

### subscriptions
`id, workspace_id, provider (stripe|razorpay), plan, status, current_period_end, metered_usage jsonb`

### notifications
`id, workspace_id, type, title, body, read_at, created_at`

---

## 8. API DESIGN (key endpoints)

```
# Auth
POST /api/auth/google            POST /api/auth/logout

# Onboarding
POST /api/onboarding             {niche, tone, languages}

# Connections
GET  /api/connections                      # list
GET  /api/connections/:provider/oauth      # redirect to OAuth
GET  /api/connections/callback/:provider   # OAuth callback
DELETE /api/connections/:id                # revoke

# Products
GET  /api/products?niche=&minScore=        # list + filters
POST /api/products/refresh                 # trigger research job
GET  /api/products/:id                     # detail + score breakdown
POST /api/products/:id/save

# Links
POST /api/links                            # create short link
GET  /api/links/:code                      # 302 redirect (edge fn)
GET  /api/links/:code/stats
POST /api/bio-pages                        # link-in-bio page create/update
GET  /api/bio/:slug                        # public bio page render

# DM Sales Engine
GET/POST /api/dm/triggers                  # keyword rules CRUD
POST /api/dm/triggers/test                 # dry-run: "price?" aaye toh kya jaata
POST /api/dm/approve/:id                   # semi mode: draft approve → send
POST /api/dm/reply                         # manual reply (unified inbox)
GET  /api/dm/funnel?range=                 # triggers → DMs → clicks → sales
POST /api/webhooks/meta (ig comment/dm)    # comment/DM incoming webhook
POST /api/webhooks/tiktok | /x | /fb
POST /api/whatsapp/incoming                # WhatsApp bot webhook

# Content
POST /api/content/generate   {productId, type, platform, variants}
GET  /api/content/:id
POST /api/content/:id/approve

# Video
POST /api/videos/render      {contentId, mode, voiceId, aspect}
GET  /api/videos/:id                  # status + progress

# Posts
POST /api/posts/schedule      {contentId, connectionId, at}
POST /api/posts/publish-now
GET  /api/calendar?from=&to=

# Autopilot
GET/PUT /api/autopilot/config
POST /api/autopilot/pause | /resume

# Analytics
GET /api/analytics/overview?range=
GET /api/analytics/posts/:id
GET /api/analytics/report/weekly

# Billing
POST /api/billing/checkout
POST /api/webhooks/stripe
GET  /api/usage                             # credits left

# Copilot
POST /api/copilot/chat      {message, workspaceContext}
POST /api/copilot/campaign  {goal}
```

**WebSocket events:** `video.render.progress`, `post.published`, `autopilot.daily_report`, `product.new_winner`, `dm.received`, `dm.link_clicked`, `sale.converted`

---

## 9. AI PIPELINES (detailed)

### P1: Product Research (daily)
```
Fetch (Amazon PA / networks) → normalize →
Filter (commission, price, rating) →
LLM scoring (niche fit, content potential, competition) →
Trend check (30-day data) →
Rank → top N save to products table →
Notify: "3 new winners found"
```
**Model:** Gemini (bulk scoring, cheap) + rules pre-filter.

### P2: Content Script Generation (per product)
```
Product data + brand profile + platform trends →
Hook generator (5 hooks: curiosity, pain, proof, discount, question) →
Script writer (choose format: listicle/review/comparison) →
Variant generator (3× different angles) →
Compliance check (claims, #ad) →
Human review (semi mode) or queue (full mode)
```
**Model:** GPT-4.x for quality scripts; cached product context via pgvector.

### P3: Video Generation (per script)
```
Script → Scene splitter (5–8 scenes, each ≤ 8s) →
Prompt enhancer (cinematic prompt per scene: style, camera, product) →
Veo/Flow generate clips (parallel, with fallback model on failure) →
TTS: voiceover per scene (ElevenLabs, voice clone or preset) →
FFmpeg assemble: clips + voice + music (ducking) →
Auto captions (word-level timing, styled) →
Resize 9:16 → thumbnail pick →
Compliance watermark/AI-label if required →
Upload R2 → mark video done → credits deduct
```
**Cost control:** budget mode uses motion-graphics template instead of Veo.

### P4: Publishing
```
Video/content ready + schedule time reached →
Platform API upload (with retry) →
Store platform_post_id → first comment (CTA link) →
Verify live (poll) → analytics tracking starts
```

### P5: Analytics Sync (3–6× daily)
```
Pull platform insights (Graph/TikTok/YouTube APIs) →
Pull affiliate conversions (network APIs or report import) →
Join with posts → analytics_daily upsert →
Feed Optimizer
```

### P6: Auto-Optimizer
```
Score each post (engagement rate + CTR + conversions) after 24h →
Tag winner/loser per format/hook/time →
Actions: archive losers, remix winners (P3 reuse),
adjust schedule times, update "what works" memory (pgvector)
```

---

## 10. VIDEO ENGINE (Google Flow/Veo specifics)

- **Access:** Google Veo via Gemini API / Google Cloud (Flow is the Google Labs product; for SaaS use the **Veo API**). Keep a provider abstraction layer:
  ```
  VideoProvider interface:
    generate(prompt, duration, aspect) -> clipUrl
  Providers: VeoProvider (primary), RunwayProvider, KlingProvider, PikaProvider (fallbacks)
  ```
- **Rate limits & cost per clip** tracked in `jobs_audit`; workspace-level daily render caps
- **Prompt template library** per video mode (showcase, UGC, comparison…)
- **Safety:** prompt filters, brand-safety check (no misleading claims, no fake celebrity)
- **Watermark/AI label:** keep platform-required provenance (SynthID where available)
- **Render farm:** FFmpeg in Docker (Fargate/CloudRun), job picks up clips from R2

**Video modes spec (MVP → advanced):**
| Mode | MVP? | Source |
|---|---|---|
| Product showcase (B-roll + voiceover + captions) | ✅ P2 | Veo clips |
| Listicle fast-cut | ✅ P2 | Veo + templates |
| UGC avatar talking | ✅ P3 | HeyGen |
| AI actor testimonial w/ dialogue | ✅ P3 | Veo 3 |
| Comparison split-screen | V4 | editing templates |
| Screen-record software demo | V4 | templates + TTS |

---

## 11. INTEGRATIONS (OAuth + Affiliate)

| Service | Method | Notes |
|---|---|---|
| Instagram/Facebook | Meta Graph API | Business/Creator account chahiye; app review for reels publish |
| TikTok | Content Posting API | Developer app + audit |
| YouTube | Data API v3 | OAuth, quota management |
| X | API v2 | Paid tiers — check cost |
| Pinterest | API | Rich pins |
| LinkedIn | Share API | Page/user |
| Amazon | Product Advertising API | Associates account + qualifying sales needed |
| ClickBank | API/marketplace feed | gravity data |
| Digistore24 | API | EU market |
| ShareASale / Impact / CJ | APIs | varies |
| Stripe / Razorpay | Billing webhooks | subscriptions + metered |
| ElevenLabs | TTS + voice clone API | per-character pricing |
| HeyGen | Avatar API | video minutes pricing |
| Google Veo/Flow (Gemini API) | **Platform Pool (DEFAULT)** — hamari GCP/Gemini keys, cost plan mein bundled; **BYOK optional** — user apni Gemini key de toh 30% discount | v1.2: reliable + zero user setup |
| Bitly (optional) | short links | own domain preferred |

**Token vault:** encrypt at rest, rotate, auto-refresh jobs, per-scope revoke UI.

---

## 12. AUTOPILOT SCHEDULER (24/7 jobs)

| Time (user TZ) | Job | Queue |
|---|---|---|
| 04:00 | Product research refresh | research |
| 04:30 | Trend miner scan | trends |
| 05:00 | Script batch generation (top products) | content |
| 06:00 | Video renders (batch of day) | video |
| 09:00 | Compliance pass + schedule posts | publish |
| 10:00–21:30 | Post at platform best times (staggered) | publish |
| 18:00 | Trend remix (if trend found) | video |
| 22:00 | Analytics sync + optimizer | analytics |
| 23:00 | Daily report (email/WA/in-app) | report |
| Sun 09:00 | Weekly strategy review + next week plan | copilot |

**Guardrails:**
- Per-platform daily caps (config): IG 2 reels, TikTok 2, YT 1, X 4…
- Quiet hours, duplicate-content prevention (same product not posted twice in 48h)
- Circuit breaker: platform API failing → pause + alert (don't spam retries)
- Cost cap/day: max $X on AI renders per workspace

---

## 13. MULTI-AGENT AI SYSTEM

Agents (each a prompt + tools, orchestrated):

1. **Research Agent** — fetches/scoring products
2. **Trend Agent** — viral trends + remix opportunities
3. **Strategist Agent** (aka **Character Thinking**) — weekly plan, angle selection — ab **character ke daily thought journal** mein likhta hai, user "Character Mind" page pe dekh sakta hai
4. **Script Agent** — hooks/scripts/variants
5. **Video Director Agent** — scene prompts, mode selection + **platform pool budget check** (daily cost cap) ya BYOK key routing before render
6. **Compliance Agent** — disclosure, claims, platform policy
7. **Publisher Agent** — scheduling + upload + retries
8. **Analyst Agent** — metrics → insights
9. **Optimizer Agent** — actions: pause/remix/boost (self-reflection loop → journal)
10. **Copilot Agent** — user chat, takes actions (write tools)
11. **🎭 Character Discussion Agent (naya)** — comment/DM replies in character voice, user se strategy discussion, personality guardrails; hamesha connected account ka naam use karta hai

**Start simple:** Phase 2 = linear pipelines; Phase 4 = agent orchestration with memory (pgvector "what works for this niche"); **Character Thinking + Discussion = Phase 3–4**.

---

## 14. MONETIZATION & PRICING (v1.2 — cost-model aligned)

> Pricing **video cost (platform pool)** ke hisaab se set ki — purane $19/$49/$149 pe margin nahi banta (§18 math).

| | **Free** | **Starter $29/mo** | **Pro $79/mo** | **Agency $249/mo** |
|---|---|---|---|---|
| Workspaces | 1 | 1 | 1 | 10 |
| Products tracked | 10 | 50 | Unlimited | Unlimited |
| AI scripts/mo | 30 | 300 | 1,500 | 6,000 |
| **AI videos/mo** (platform pool) | 0 (2 trial) | **8** | **30** | **120** |
| Video cost protection | — | daily cap | daily cap | daily cap + priority render |
| Auto-posting | 1 platform | 3 platforms | All | All |
| Autopilot | ❌ | Semi | Full | Full |
| **BYOK discount** (apni Gemini key) | ❌ | −30% | −30% | −30% |
| Voice clone | ❌ | ❌ | ✅ | ✅ |
| Copilot chat | 10 msgs | 100 | Unlimited | Unlimited |
| Team members | 1 | 1 | 3 | 10 |
| Analytics | Basic | 30-day | 1-year + export | White-label |
| Support | Community | Email | Priority | Dedicated |

- **Free plan: video nahi** (sirf 2 trial) — captions/links/posting hi free; video = paid feature (cost control)
- **Video credits top-up pack:** $19 / 10 extra videos (markup, margin safe)
- **BYOK users ko −30% discount** → humara render cost bachta hai, wo sasta bhi
- Annual = 2 months free; Referral: 20% recurring ya credit bonus
- **Free trial:** 7-day Pro (card required) — video credits limited (3) to prevent abuse
- Pricing validate karo launch ke baad: cost/video dashboard (§19) dekh ke adjust

---

## 15. SECURITY & COMPLIANCE

- **Auth:** OAuth sessions, JWT rotation, 2FA (later), role-based access
- **Token vault:** AES-256 encryption, KMS, never returned to frontend
- **Data:** encryption at rest (DB) + in transit (TLS), daily backups, GDPR: export/delete user data
- **Payments:** Stripe/Razorpay hosted — no card data on our servers (PCI scope minimal)
- **Content compliance:**
  - Auto affiliate disclosure (`#ad`, "affiliate link" per FTC/ASA)
  - False-claim filter (income/health claims blocked)
  - Platform ToS: official APIs only, rate limiting, no scraping logged-in sessions
  - AI content labeling where platform requires (Meta/TikTok AI labels)
- **Anti-abuse:** render caps, CAPTCHA on signup, cost caps per workspace, fraud detection on free tier
- **Secrets:** env via Doppler/SSM — never in repo
- **Audit:** jobs_audit + credits_ledger for every chargeable action
- **Marketing claims:** NO "guaranteed income" — "AI content engine & analytics" only (FTC/ASA risk)

---

## 16. FOLDER STRUCTURE

```
affiliate-autopilot/
├── plan.md
├── apps/
│   ├── web/                     # Next.js frontend + API routes
│   │   ├── app/
│   │   │   ├── (marketing)/     # landing, pricing, blog
│   │   │   ├── (auth)/          # login, onboarding
│   │   │   └── (app)/           # dashboard, products, studio,
│   │   │   │                     calendar, analytics, settings
│   │   │   └── api/             # REST endpoints
│   │   ├── components/
│   │   └── lib/                 # db client, auth, utils
│   └── edge/
│       └── redirector/          # Cloudflare Worker: short links
├── services/
│   ├── workers/                 # Python AI workers
│   │   ├── research/            # P1
│   │   ├── script/              # P2
│   │   ├── video/               # P3 (Veo + FFmpeg)
│   │   ├── publish/             # P4
│   │   ├── analytics/           # P5/P6
│   │   └── scheduler/           # cron entrypoints
│   └── api/                     # optional FastAPI (copilot)
├── packages/
│   ├── db/                      # schema (Drizzle/Prisma) + migrations
│   ├── shared/                  # types, zod schemas, constants
│   └── ai-prompts/              # all prompt templates (versioned)
├── infra/
│   ├── docker/                  # ffmpeg worker image
│   ├── terraform/ (or render.yaml, railway.toml)
│   └── docs/                    # API docs, runbooks
└── .github/workflows/           # CI: lint, test, deploy
```

---

## 17. ROADMAP (Phase 0–5)

### Phase 0 — Foundation (Week 1–2)
- Repo setup, CI, DB schema v1, auth (Google login), workspace, dashboard shell
- Connection table + OAuth framework (1 provider working: Instagram or YouTube)
- **Video provider framework day 1 se:** platform pool (default, server-side key) + BYOK optional slot — architecture simple, user setup zero
- **🎭 Character auto-creation skeleton** (naam social handle se, profile page)

### Phase 1 — MVP (Week 3–6) ⭐ first shippable
- Amazon PA API product fetch + AI score + product library
- Short link generator + click tracking (edge redirector)
- AI caption/ad copy generation (no video yet)
- **Character: basic — profile + "Character Mind" thought journal (daily strategy thoughts)**
- Manual post to 1–2 platforms + scheduling calendar
- **🔥 DM Engine v1 — comment keyword → auto reply with link (IG, semi-approval mode) + link-in-bio page (basic)** ← early differentiation
- Billing (Stripe) + Free/Starter plans
- **Goal:** 10 real users, validate demand

### Phase 2 — Video Engine (Week 7–11) ⭐ flagship
- **Platform Pool video engine (default — user zero setup)**: Veo Fast primary + cheap fallbacks, FFmpeg pipeline, voiceover, captions
- **Render budget dashboard** (hamara daily cost, cost/video, per-plan quota) + **BYOK optional slot** (Settings mein key paste → discount)
- 2 modes: product showcase + listicle
- Render queue + credits metering (per-plan video quotas)
- Auto-post reels (IG/TikTok/YouTube)

### Phase 3 — Autopilot + Character + DM Funnel (Week 12–18)
- Full scheduler (all §12 jobs), semi/full modes
- Analytics sync + dashboard + weekly report
- Trend miner v1 (hashtags/audio)
- More video modes: UGC avatar (HeyGen)
- **🎭 Character Discussion Engine v1 — comments ka reply character voice mein + user se chat (strategy discussion) with approval mode**
- **🔥 DM Sales Engine v2 — full DM funnel (auto-DM, follow-ups), unified DM inbox, TikTok/X/FB, attribution funnel (trigger→sale), full-auto mode, anti-spam caps**

### Phase 4 — Intelligence (Week 19–26)
- Auto-optimizer (winner/loser), performance memory
- Copilot chat + campaign builder
- Voice clone, remix feature
- **🎭 Character v2 — DM auto-replies in full personality, self-reflection loop, personality sliders mature, multi-handle identity consistency**
- **📱 WhatsApp Click-to-Chat + WhatsApp bot funnel (India)**
- Agency plan: teams, multi-workspace, white-label roadmap
- Veo 3 dialogue testimonial mode

### Phase 5 — Scale (ongoing)
- Mobile app (React Native / PWA)
- More networks (Impact, CJ), more languages/regional content
- Marketplace for templates & niches
- API access for developers
- **🎭 Character-to-character collaboration (cross-promo)**
- **🔥 DM Engine v3 add-ons — coupon engine, voice note replies, comment-to-story, multi-product cart link, sell-through close chat**
- Influencer UGC marketplace (real humans, later)

---

## 18. COST ESTIMATES (AI APIs, per unit)

### 💡 Cost model (v1.2 FINAL) — Platform Pool: HUM pay karte hain, price mein bundled

| Item | Who pays | Approx cost |
|---|---|---|
| Veo Fast clips (~8s, hero shots) | **Platform (default)** | ~$1.2–3 per clip |
| Cheap fallback clips (Kling/Pika — b-roll) | **Platform (default)** | ~$0.10–0.50 per clip |
| **30-sec reel ka total video cost** | **Platform (default)** | **~$1.5–3 target** (BYOK pe: ₹0 hamara) |
| ElevenLabs voiceover | Platform | ~$0.10–0.30 per reel |
| HeyGen avatar (later) | Platform | ~$1–3/min subscription |
| GPT-4.x scripts | Platform | ~$0.01–0.05 per script |
| Gemini scoring | Platform | ~$0.001 per product |
| FFmpeg render (compute) | Platform | ~$0.01–0.05 per reel |

**Pricing fit (kaise profitable rahein):**
```
Starter $19/mo → 10 videos  → video cost ~$15–30  → BARELY breakeven ⚠️
Pro     $49/mo → 40 videos  → video cost ~$60–120 → LOSS banta hai ⚠️
```
**Isliye pricing v1.2 ke hisaab se REALISTIC karni padegi (recommendation):**
| Plan | Price | Videos/mo | Est video cost | Margin check |
|---|---|---|---|---|
| Starter | $29 | 10 | $15–30 | tight → $39 karo ya 8 videos |
| Pro | $79 | 30 | $45–90 | ✅ healthy |
| Agency | $249 | 120 | $180–360 | ✅ healthy |
| BYOK discount | −30% subscription | unlimited* | ₹0 video cost | ✅ extra profit |

**Rules:**
- Plan video quota = **hard cap**; extra = credits kharido (markup se margin)
- Track `cost_usd` per job + `provider` (`platform_pool` vs `byok`) → har plan ka real margin dashboard pe
- Daily platform spend circuit breaker (jaise $X/day/workspace cap)
- Cache: same product ke clips reuse, script edits pe video re-render na ho
- Free plan: **video NAHI** (sirf trial ke 2 videos) — caption/content free, video paid-only (cost control)

---

## 19. KPIs & METRICS

**Product:** WAU/MAU, activation rate (% completing onboarding + first post in 24h), D30 retention, autopilot enabled %
**Content:** videos rendered/day, render success rate, avg render time, posts published/day
**Business:** MRR, trial→paid conversion, churn, ARPU, CAC/LTV
**Quality:** posts with >X engagement, clicks per post, customer-earned commissions tracked
**Infra:** job failure rate, p95 render latency, API uptime, cost per active workspace/day

---

## 20. RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| **Platform pool cost explodes** (video = biggest cost) | Per-plan hard video caps, daily $ circuit breaker, `cost_usd`/job + margin dashboard, Veo Fast + cheap fallbacks, clip caching, free plan pe video nahi |
| **BYOK user keys ka misuse/leak** | Encrypted store (KMS), user kabhi bhi revoke, keys kabhi logs/metrics mein na dikhein, server-side isolated use only |
| **Character impersonation/ToS risk** | Character sirf **user ke apne connected accounts** pe bolta hai (apna hi account = allowed), platform AI-disclosure labels, approval mode default, guardrails prevent claims user ne na kahi hon |
| Google Veo API pricing/access/policy change | Provider abstraction (Veo↔Kling↔Pika↔Runway interchangeable), monthly cost review, BYOK as pressure valve |
| Meta/TikTok app review delay | Apply in Phase 0; MVP ships with YouTube + manual export (download MP4 + upload guide) |
| Amazon PA API quota (needs qualifying sales) | Warm-up plan + ClickBank/Digistore first (easier access) |
| **Platform bans on automation** | Official APIs only, rate limits, human-like schedules, caps |
| **DM/comment auto-reply = spam flag risk** | Default semi-approval mode, daily DM caps (100/ws default), quiet hours, 1 DM per user per product, blocklist + sentiment skip, high-quality replies only (no bulk spam), WhatsApp opt-in strictly |
| ToS/legal (FTC disclosure, no income promises) | Compliance agent auto-disclosure; marketing review |
| Content quality / hallucinated claims | Compliance agent + human approval mode default for new users |
| Chargeback/abuse on free trial | Card required, render caps, device fingerprinting |
| Single point: many fragile APIs | Circuit breakers, retries, queue isolation per provider |

---

## 21. ENVIRONMENT & SECRETS

```
# Core
DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET, APP_URL

# OAuth apps
GOOGLE_CLIENT_ID/SECRET
META_APP_ID/SECRET + long-lived token refresh
TIKTOK_CLIENT_KEY/SECRET
YOUTUBE/OAUTH creds, X_API_KEY, PINTEREST_APP_ID, LINKEDIN_CLIENT

# Affiliate
AMAZON_PA_ACCESS_KEY/SECRET/Partner_TAG
CLICKBANK_*, DIGISTORE_*, SHAREASALE_*, IMPACT_*, CJ_*

# AI (platform-side keys)
OPENAI_API_KEY, ELEVENLABS_API_KEY,
HEYGEN_API_KEY, IMAGE_PROVIDER_KEY, FALLBACK_VIDEO_PROVIDER_*
# Video = PLATFORM POOL (default): hamari GCP/Gemini keys (server-side, secret)
GEMINI_API_KEY (platform pool), GCP_PROJECT_ID
# BYOK: user keys DB mein encrypted (connections.api_key_enc) — yahan NAHI

# Billing
STRIPE_SECRET/WEBHOOK_SECRET, RAZORPAY_KEY/SECRET

# Infra
S3/R2_BUCKET+KEYS, CLOUDFLARE_WORKER_TOKEN, SHORT_DOMAIN,
SENTRY_DSN, POSTHOG_KEY, DOPPLER/SSM
```

---

## 22. OPEN QUESTIONS (decisions aap lene hain)

1. **Brand name** final kya rakhein?
2. **MVP focus market:** India (Razorpay, Amazon.in, Hindi content) ya global (Stripe, Amazon.com)? Ya dono?
3. **MVP mein video kitni priority?** (Phase 1 text-only jaldi launch vs Phase 2 video ke saath late launch)
4. **Free plan video:** abhi plan = free pe video nahi (2 trial videos only) — ya aap chahte ho free pe limited video? (cost risk)
5. **Mobile app** zaroori hai abhi ya web se kaam chalega?
6. **Pricing currency:** USD, INR, ya both?
7. **Team/agency features** kitni jaldi chahiye?
8. Koi **specific affiliate network** jo pehle support karna hai? (Amazon, ClickBank, Digistore…)
9. **Landing page/marketing site** bhi isi plan mein chahiye ya alag?
10. **Character default mode:** naye user ke liye comments/DM auto-reply ON rakhein ya approval-mandatory? (risk vs wow-factor balance)
11. **Character naam priority:** agar user ke alag-alag platforms ke alag-alag handles hain toh primary kaunsa? (most followers wala ya user choose kare)
12. **Google connect方式:** OAuth (easy par quota access limited) vs Gemini API key paste (reliable, thoda technical) — dono rakhun ya pehle ek?

---

### ✅ Review checklist (aap ye batao — kya missing / improve karna hai):
- [ ] Features complete lag rahe? Kuch missing?
- [ ] **Video model final: Platform Pool default + BYOK optional — ye sahi hai?** (pricing §14 bhi isi ke hisaab se $29/$79/$249 — confirm?)
- [ ] **🎭 Character module detail theek hai?** (naming, thinking engine, discussion, guardrails — kya add karun? jaise character ka apna voice/face in videos?)
- [ ] Video pipeline sahi? (platform key → Veo Fast + cheap fallbacks → FFmpeg)
- [ ] OAuth/logins saare platforms cover hue?
- [ ] Pricing plans theek hain? (naye video-cost based numbers)
- [ ] Roadmap order sahi hai?
- [ ] Koi legal/compliance cheez chhut gayi? (esp. character automation + AI labels)
- [ ] Tech stack choice theek hai ya kuch change?

*Jaise hi aap feedback do, main plan.md update karke **v1.3** bana dunga — phir implementation shuru (Phase 0).*
