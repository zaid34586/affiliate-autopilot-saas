import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../components/page-header";
import { getPostList, getAllTags } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog — Affiliate Marketing Guides",
  description:
    "Practical guides on Instagram affiliate marketing, DM funnels, product research, Reel hooks, and compliance — from the Affiliate Autopilot team.",
  alternates: { canonical: "/blog" },
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogPage() {
  const posts = getPostList();
  const tags = getAllTags();
  const [featured, ...rest] = posts;

  return (
    <>
      <PageHeader
        kicker="Blog"
        title={
          <>
            Writing that comes
            <span className="text-signal">from inside the system.</span>
          </>
        }
        sub="Practical guides on affiliate systems, DM funnels, and AI content engines — no listicle bait."
      />

      <section className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-16">
        {featured && (
          <>
            <p className="label text-signal">Latest</p>
            <Link
              href={`/blog/${featured.slug}`}
              className="panel mt-5 block p-6 transition-colors hover:border-signal/50"
            >
              <div className="flex flex-wrap items-center gap-3 text-xs text-bone-3">
                <time dateTime={featured.date}>{formatDate(featured.date)}</time>
                <span>·</span>
                <span>{featured.readingMinutes} min read</span>
                <span>·</span>
                <span>{featured.author}</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight md:text-2xl">
                {featured.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-bone-2">
                {featured.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {featured.tags.map((t) => (
                  <span key={t} className="label rounded-full border border-line px-2.5 py-1">
                    {t}
                  </span>
                ))}
              </div>
              <span className="mt-4 inline-block text-sm text-signal">Read guide →</span>
            </Link>
          </>
        )}

        {rest.length > 0 && (
          <>
            <p className="label mt-10 text-signal">All posts</p>
            <div className="mt-5 grid gap-4">
              {rest.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="panel block p-5 transition-colors hover:border-signal/50"
                >
                  <div className="flex flex-wrap items-center gap-3 text-xs text-bone-3">
                    <time dateTime={p.date}>{formatDate(p.date)}</time>
                    <span>·</span>
                    <span>{p.readingMinutes} min read</span>
                  </div>
                  <h2 className="mt-2 font-semibold tracking-tight">{p.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-bone-2">
                    {p.description}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}

        {tags.length > 0 && (
          <>
            <p className="label mt-10 text-signal">Topics</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t.tag} className="label rounded-full border border-line px-3 py-1.5">
                  {t.tag} · {t.count}
                </span>
              ))}
            </div>
          </>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-signal px-6 py-3">
            Get early access →
          </Link>
          <Link href="/docs" className="btn-ghost px-6 py-3">
            Read docs
          </Link>
        </div>
      </section>
    </>
  );
}
