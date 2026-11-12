import type { Metadata } from "next";
import { Hero } from "./sections/hero";
import { TrustBar } from "./sections/trust-bar";
import { Problem } from "./sections/problem";
import { Loop } from "./sections/loop";
import { Features } from "./sections/features";
import { How } from "./sections/how";
import { Character } from "./sections/character";
import { PricingTeaser } from "./sections/pricing-teaser";
import { Faq } from "./sections/faq";
import { FinalCta } from "./sections/final-cta";

export const metadata: Metadata = {
  title: "Affiliate Autopilot — Your Affiliate Marketing Team, Running 24/7",
  description:
    "AI finds best-selling products, builds links, generates reels, publishes posts, and sends DMs with links when users ask. The 24/7 autopilot for affiliate marketers.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Your Affiliate Marketing Team, Running 24/7.",
    description:
      "Research → content → video → publish → DM → optimize. All automatic, 24/7.",
    type: "website",
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do I need my own Google Flow / Gemini account?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The video engine runs on our platform pool — cost is included in your plan, one click and the reel is ready. If you add your own Gemini key you get 30% off (BYOK), but it's not required.",
      },
    },
    {
      "@type": "Question",
      name: "Will it post from my accounts without my control?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You decide. Autopilot has 4 levels: Manual (approve every post), Semi (draft preview), Full (auto with limits), Fire-and-forget. New users default to Semi, and quiet hours + daily caps always apply.",
      },
    },
    {
      "@type": "Question",
      name: "Won't sending DMs from comments get my account banned?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "That's why there's an anti-spam layer: one DM per user (24h cooldown), daily caps, quiet hours, blocklist, negative sentiment skip — all designed within platform rules.",
      },
    },
    {
      "@type": "Question",
      name: "How are earnings tracked?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every short link tracks clicks, and affiliate networks sync conversions. Dashboard shows post → click → sale fully attributed — which post earned how much commission.",
      },
    },
  ],
};

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Affiliate Autopilot",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI marketing operating system for affiliate marketers — research, content, video, publishing, DM sales, and analytics, all on 24/7 autopilot.",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Starter", price: "29", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "79", priceCurrency: "USD" },
    { "@type": "Offer", name: "Agency", price: "249", priceCurrency: "USD" },
  ],
  url: SITE_URL,
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Hero />
      <TrustBar />
      <Problem />
      <Loop />
      <Features />
      <How />
      <Character />
      <PricingTeaser />
      <Faq />
      <FinalCta />
    </>
  );
}