import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog/posts";
import { postSeo, postJsonLd, readingTimeMinutes, renderBlogHtml } from "@/lib/blog/blog-core";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post not found" };

  const seo = postSeo(post, SITE_URL);
  return {
    title: `${seo.title} | Blog`,
    description: seo.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      ...seo.openGraph,
      url: seo.canonical,
      siteName: "Affiliate Autopilot",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
    },
  };
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post.slug, 3);
  const jsonLd = postJsonLd(post, SITE_URL);
  const html = renderBlogHtml(post.content);
  const minutes = readingTimeMinutes(post.content);

  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link href="/blog" className="label text-signal">
        ← Blog
      </Link>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-bone-3">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>·</span>
          <span>{minutes} min read</span>
          <span>·</span>
          <span>{post.author}</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-bone-2">{post.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <span key={t} className="label rounded-full border border-line px-2.5 py-1">
              {t}
            </span>
          ))}
        </div>
      </header>

      <div
        className="prose-blog mt-10"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <footer className="mt-12 rounded-xl border border-amber/40 bg-amber/5 px-5 py-4">
        <p className="label text-amber">Turn this into a system</p>
        <p className="mt-2 text-sm leading-relaxed text-bone-2">
          These guides describe the plays. Affiliate Autopilot runs them
          automatically — content engine, DM funnels, and analytics in one
          workspace.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-signal px-5 py-2.5 text-sm">
            Start free →
          </Link>
          <Link href="/features" className="btn-ghost px-5 py-2.5 text-sm">
            See features
          </Link>
        </div>
      </footer>

      {related.length > 0 && (
        <section className="mt-12">
          <p className="label text-signal">Keep reading</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="panel block p-4 transition-colors hover:border-signal/50"
              >
                <h3 className="text-sm font-semibold leading-snug">{r.title}</h3>
                <p className="mt-2 text-xs text-bone-3">{r.readingMinutes} min read</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
