import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const publicPages = [
    { path: "/", priority: 1.0 },
    { path: "/features", priority: 0.9 },
    { path: "/pricing", priority: 0.9 },
    { path: "/solutions", priority: 0.7 },
    { path: "/integrations", priority: 0.7 },
    { path: "/about", priority: 0.5 },
    { path: "/contact", priority: 0.5 },
    { path: "/security", priority: 0.5 },
    { path: "/blog", priority: 0.6 },
    { path: "/changelog", priority: 0.4 },
    { path: "/legal/terms", priority: 0.3 },
    { path: "/legal/privacy", priority: 0.3 },
    { path: "/legal/refunds", priority: 0.3 },
    { path: "/legal/cookies", priority: 0.3 },
    { path: "/legal/acceptable-use", priority: 0.3 },
    { path: "/demo", priority: 0.6 },
    { path: "/customers", priority: 0.4 },
    { path: "/resources", priority: 0.5 },
    { path: "/help", priority: 0.5 },
    { path: "/docs", priority: 0.5 },
  ];

  return publicPages.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.path === "/" || p.path === "/blog" ? "weekly" : "monthly",
    priority: p.priority,
  }));
}
