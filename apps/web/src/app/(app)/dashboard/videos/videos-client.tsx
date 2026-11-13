"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Download,
  Film,
  Gauge,
  Globe,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";

type VideoMode = "showcase" | "listicle";
type RenderStatus = "queued" | "rendering" | "done" | "failed";

interface ProductOption {
  id: string;
  title: string;
  price: string | null;
  currency: string | null;
  category: string | null;
  rating: string | null;
  reviewCount: number | null;
  imageUrl: string | null;
  aiScore: number | null;
}

interface VideoListItem {
  id: string;
  title: string | null;
  mode: string;
  provider: string;
  renderStatus: RenderStatus;
  progressPct: number;
  failureReason: string | null;
  retryCount: number;
  durationSec: number | null;
  costUsd: string | null;
  createdAt: string;
  hasFile: boolean;
  hasThumb: boolean;
}

interface ScriptPreview {
  productId: string;
  productTitle: string;
  script: { mode: string; hook: string; points: string[]; cta: string };
  scenes: Array<{ index: number; role: string; narration: string; durationSec: number }>;
  totalDurationSec: number;
  sceneCount: number;
}

interface QuotaError {
  message: string;
  reason?: string;
  upsell?: {
    topupPack: { videos: number; priceUsd: number };
    upgradeHint: string | null;
  };
}

type PostStatus = "scheduled" | "publishing" | "published" | "failed";

interface VideoPost {
  platform: "instagram" | "youtube";
  status: PostStatus;
  sandbox: boolean;
  permalink: string | null;
  platformPostId: string | null;
}

interface VideoListItem {
  id: string;
  title: string | null;
  mode: string;
  provider: string;
  renderStatus: RenderStatus;
  progressPct: number;
  failureReason: string | null;
  retryCount: number;
  durationSec: number | null;
  costUsd: string | null;
  createdAt: string;
  hasFile: boolean;
  hasThumb: boolean;
  autoPostPlatform: string | null;
  posts: VideoPost[];
}

interface BudgetData {
  plan: string;
  providerMode: "mock" | "byok" | "platform_pool";
  monthly: { used: number; limit: number; remaining: number };
  today: {
    renders: number;
    renderCap: number;
    spendUsd: number;
    spendCapUsd: number;
    breakerTripped: boolean;
  };
  creditsBalance: number;
  cost: { doneCount: number; totalUsd: number; avgUsd: number | null };
  topupPack: { videos: number; priceUsd: number };
}

const POST_PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Globe className="h-3.5 w-3.5" />,
  youtube: <Film className="h-3.5 w-3.5" />,
};

function postRowClass(p: VideoPost): string {
  if (p.sandbox) return "border-amber/40 bg-amber/10";
  if (p.status === "published") return "border-signal/40 bg-signal/10";
  if (p.status === "failed") return "border-danger/40 bg-danger/10";
  return "border-ink-3 bg-ink";
}

function postIconClass(p: VideoPost): string {
  if (p.sandbox) return "text-amber";
  if (p.status === "published") return "text-signal";
  if (p.status === "failed") return "text-danger";
  return "text-bone-3";
}

function postStatusClass(p: VideoPost): string {
  if (p.status === "published") return "bg-signal/20 text-signal";
  if (p.status === "failed") return "bg-danger/20 text-danger";
  if (p.status === "publishing") return "bg-signal/20 text-signal";
  return "bg-ink text-bone-3";
}

const MODES: Array<{ key: VideoMode; label: string; hint: string }> = [
  { key: "showcase", label: "Product showcase", hint: "One product, hero reveal" },
  { key: "listicle", label: "Listicle", hint: "Numbered reasons to buy" },
];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCost(costUsd: string | null): string | null {
  if (costUsd == null) return null;
  const n = Number(costUsd);
  if (!Number.isFinite(n)) return null;
  return `$${n.toFixed(3)}`;
}

function StatusBadge({ status }: { status: RenderStatus }) {
  const map: Record<RenderStatus, { label: string; cls: string }> = {
    queued: { label: "Queued", cls: "border border-amber/40 bg-amber/10 text-amber" },
    rendering: { label: "Rendering", cls: "border border-signal/40 bg-signal/10 text-signal" },
    done: { label: "Ready", cls: "border border-signal/40 bg-signal/10 text-signal" },
    failed: { label: "Failed", cls: "border border-danger/40 bg-danger/10 text-danger" },
  };
  const m = map[status];
  return (
    <span className={`label rounded px-2 py-1 ${m.cls}`}>
      {status === "rendering" && (
        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
      )}
      {m.label}
    </span>
  );
}

export function VideosClient() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [mode, setMode] = useState<VideoMode>("showcase");
  const [autoPostPlatform, setAutoPostPlatform] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ScriptPreview | null>(null);
  const [quotaError, setQuotaError] = useState<QuotaError | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // quick-add product form
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: "",
    price: "",
    category: "",
    rating: "",
    reviewCount: "",
    imageUrl: "",
  });

  const activeRef = useRef(false);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/videos");
      if (!res.ok) return;
      const data = await res.json();
      const list: VideoListItem[] = data.videos ?? [];
      setVideos(list);
      activeRef.current = list.some(
        (v) => v.renderStatus === "queued" || v.renderStatus === "rendering"
      );
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/products");
      if (!res.ok) return;
      const data = await res.json();
      const list: ProductOption[] = data.products ?? [];
      setProducts(list);
      setSelectedProductId((prev) => prev || list[0]?.id || "");
      if (list.length === 0) setShowAdd(true); // no products → open quick-add
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/videos/budget");
      if (!res.ok) return;
      const data = await res.json();
      setBudget(data as BudgetData);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const [postingId, setPostingId] = useState<string | null>(null);

  async function handlePost(videoId: string, platform: "instagram" | "youtube") {
    setPostingId(`${videoId}:${platform}`);
    try {
      const res = await fetch(`/api/dashboard/videos/${videoId}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ msg: data.error ?? "Post failed.", type: "error" });
      } else if (data.success) {
        setToast({ msg: `Posted to ${platform} ${data.sandbox ? "(sandbox)" : ""}.`, type: "success" });
        fetchVideos(); // refresh to show new post status
      } else {
        setToast({ msg: data.error ?? "Post failed.", type: "error" });
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Network error", type: "error" });
    } finally {
      setPostingId(null);
    }
  }

  useEffect(() => {
    const load = async () => {
      await fetchProducts();
      await fetchVideos();
      await fetchBudget();
    };
    void load();
    const id = setInterval(() => {
      if (activeRef.current) {
        void fetchVideos();
        void fetchBudget();
      }
    }, 2500);
    return () => clearInterval(id);
  }, [fetchProducts, fetchVideos, fetchBudget]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleGenerate() {
    if (!selectedProductId) {
      setToast({ msg: "Select a product first.", type: "error" });
      return;
    }
    setGenerating(true);
    setQuotaError(null);
    try {
      const res = await fetch("/api/dashboard/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProductId, mode, autoPostPlatform }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setQuotaError({
          message: data.error ?? "Render limit reached.",
          reason: data.reason,
          upsell: data.upsell,
        });
      } else if (!res.ok) {
        setToast({ msg: data.error ?? "Failed to queue the render.", type: "error" });
      } else {
        setToast({
          msg: `Render queued — ${data.sceneCount} scenes, ${
            data.provider === "byok"
              ? "your key"
              : data.provider === "mock"
                ? "sandbox"
                : "platform pool"
          }.`,
          type: "success",
        });
        setPreview(null);
        activeRef.current = true;
        fetchVideos();
        fetchBudget();
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Network error", type: "error" });
    } finally {
      setGenerating(false);
    }
  }

  async function handlePreview() {
    if (!selectedProductId) {
      setToast({ msg: "Select a product first.", type: "error" });
      return;
    }
    setPreviewing(true);
    try {
      const res = await fetch("/api/dashboard/videos/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProductId, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ msg: data.error ?? "Failed to build the script.", type: "error" });
      } else {
        setPreview(data as ScriptPreview);
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Network error", type: "error" });
    } finally {
      setPreviewing(false);
    }
  }

  async function handleRetry(id: string) {
    setRetryingId(id);
    setQuotaError(null);
    try {
      const res = await fetch(`/api/dashboard/videos/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (res.status === 403) {
        setQuotaError({
          message: data.error ?? "Render limit reached.",
          reason: data.reason,
          upsell: data.upsell,
        });
      } else if (!res.ok) {
        setToast({ msg: data.error ?? "Retry failed.", type: "error" });
      } else {
        setToast({ msg: "Re-queued for rendering.", type: "success" });
        activeRef.current = true;
        fetchVideos();
        fetchBudget();
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Network error", type: "error" });
    } finally {
      setRetryingId(null);
    }
  }

  async function handleAddProduct() {
    if (newProduct.title.trim().length < 2) {
      setToast({ msg: "Enter a product title.", type: "error" });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newProduct.title.trim(),
          price: newProduct.price || null,
          category: newProduct.category || null,
          rating: newProduct.rating || null,
          reviewCount: newProduct.reviewCount || null,
          imageUrl: newProduct.imageUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ msg: data.error ?? "Failed to add product.", type: "error" });
      } else {
        setToast({ msg: "Product added.", type: "success" });
        setNewProduct({ title: "", price: "", category: "", rating: "", reviewCount: "", imageUrl: "" });
        setShowAdd(false);
        await fetchProducts();
        if (data.product?.id) setSelectedProductId(data.product.id);
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Network error", type: "error" });
    } finally {
      setAdding(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;
  const activeCount = videos.filter(
    (v) => v.renderStatus === "queued" || v.renderStatus === "rendering"
  ).length;

  return (
    <div className="space-y-6">
      {/* ── Create a video ── */}
      <div className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Clapperboard className="h-4 w-4 text-signal" />
            Create a video
          </h2>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => setShowAdd((s) => !s)}
          >
            <Plus className="h-3.5 w-3.5" />
            {showAdd ? "Close" : "Add product"}
          </button>
        </div>

        {/* quick-add product */}
        {showAdd && (
          <div className="mt-4 rounded-lg border border-ink-3 bg-ink px-4 py-4">
            <p className="label text-bone-3">Quick add product</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input
                className="field sm:col-span-2 lg:col-span-1"
                placeholder="Product title *"
                value={newProduct.title}
                onChange={(e) => setNewProduct((p) => ({ ...p, title: e.target.value }))}
              />
              <input
                className="field"
                placeholder="Price (e.g. 49.99)"
                inputMode="decimal"
                value={newProduct.price}
                onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
              />
              <input
                className="field"
                placeholder="Category (e.g. electronics)"
                value={newProduct.category}
                onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))}
              />
              <input
                className="field"
                placeholder="Rating 0–5 (optional)"
                inputMode="decimal"
                value={newProduct.rating}
                onChange={(e) => setNewProduct((p) => ({ ...p, rating: e.target.value }))}
              />
              <input
                className="field"
                placeholder="Review count (optional)"
                inputMode="numeric"
                value={newProduct.reviewCount}
                onChange={(e) => setNewProduct((p) => ({ ...p, reviewCount: e.target.value }))}
              />
              <input
                className="field"
                placeholder="Image URL (optional)"
                value={newProduct.imageUrl}
                onChange={(e) => setNewProduct((p) => ({ ...p, imageUrl: e.target.value }))}
              />
            </div>
            <button
              type="button"
              className="btn-signal mt-3"
              onClick={handleAddProduct}
              disabled={adding}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add product
            </button>
            <p className="mt-2 text-xs text-bone-3">
              Scripts only state price, rating, and review figures you enter here — never invented ones.
            </p>
          </div>
        )}

        {/* product + mode + auto-post selectors */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div>
            <label className="label mb-2 block text-bone-3">Product</label>
            <select
              className="field"
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                setPreview(null);
                setQuotaError(null);
              }}
              disabled={loading || products.length === 0}
            >
              {products.length === 0 && (
                <option value="">{loading ? "Loading…" : "No products yet — add one above"}</option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.price ? ` — ${p.currency === "USD" || !p.currency ? "$" : `${p.currency} `}${p.price}` : ""}
                </option>
              ))}
            </select>
            {selectedProduct && (
              <p className="mt-2 text-xs text-bone-3">
                {selectedProduct.category ?? "Uncategorized"}
                {selectedProduct.rating ? ` · ★ ${selectedProduct.rating}` : ""}
                {selectedProduct.reviewCount ? ` · ${selectedProduct.reviewCount} reviews` : ""}
              </p>
            )}
          </div>

          <div>
            <label className="label mb-2 block text-bone-3">Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setMode(m.key);
                    setPreview(null);
                  }}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    mode === m.key
                      ? "border-signal bg-signal/10"
                      : "border-ink-4 hover:border-bone-3"
                  }`}
                >
                  <span className={`block text-sm font-medium ${mode === m.key ? "text-signal" : "text-bone-2"}`}>
                    {m.label}
                  </span>
                  <span className="label mt-0.5 block text-bone-3">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label mb-2 block text-bone-3">Auto-post</label>
            <select className="field" value={autoPostPlatform ?? ""} onChange={(e) => setAutoPostPlatform(e.target.value || null)}>
              <option value="">Off</option>
              <option value="instagram">Instagram Reels</option>
              <option value="youtube">YouTube Shorts</option>
            </select>
            <p className="mt-2 text-xs text-bone-3">
              Requires an active connection in Integrations. Off = sandbox (demo).
            </p>
          </div>
        </div>

        {/* actions */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-ghost"
            onClick={handlePreview}
            disabled={previewing || !selectedProductId}
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Preview script
          </button>
          <button
            type="button"
            className="btn-signal"
            onClick={handleGenerate}
            disabled={generating || !selectedProductId}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            Generate video
          </button>
          {activeCount > 0 && (
            <span className="label text-bone-3">{activeCount} in queue</span>
          )}
        </div>

        {/* quota / upsell error */}
        {quotaError && (
          <div className="mt-4 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3">
            <p className="flex items-start gap-2 text-sm text-amber">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {quotaError.message}
            </p>
            {quotaError.upsell && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-bone-2">
                <span className="label rounded border border-ink-4 bg-ink px-2 py-1">
                  Top-up: {quotaError.upsell.topupPack.videos} videos · ${quotaError.upsell.topupPack.priceUsd}
                </span>
                {quotaError.upsell.upgradeHint && <span>{quotaError.upsell.upgradeHint}</span>}
                <a href="/pricing" className="text-signal underline underline-offset-2">
                  View plans
                </a>
              </div>
            )}
          </div>
        )}

        {/* script preview */}
        {preview && (
          <div className="mt-4 rounded-lg border border-ink-3 bg-ink px-4 py-4">
            <div className="flex items-center justify-between">
              <p className="label text-bone-3">
                Script preview · {preview.sceneCount} scenes · ~{preview.totalDurationSec}s
              </p>
              <button
                type="button"
                className="text-bone-3 hover:text-bone"
                onClick={() => setPreview(null)}
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm font-medium text-bone">{preview.script.hook}</p>
            <ul className="mt-2 space-y-1 text-sm text-bone-2">
              {preview.script.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-signal">{preview.script.cta}</p>
            <p className="mt-3 text-xs text-bone-3">
              Captions are burned word-by-word; voiceover is added when an ElevenLabs key is configured.
            </p>
          </div>
        )}
      </div>

      {/* ── Budget & quotas ── */}
      {budget && (
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Gauge className="h-4 w-4 text-signal" />
              Budget & quotas
            </h2>
            <span className="label rounded border border-ink-4 bg-ink px-2 py-1 text-bone-3">
              {budget.plan} plan
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* monthly quota */}
            <div className="rounded-lg border border-ink-3 bg-ink px-4 py-3">
              <p className="label text-bone-3">Monthly videos</p>
              <p className="mt-1.5 text-lg font-semibold text-bone">
                {budget.monthly.used}
                <span className="text-sm font-normal text-bone-3"> / {budget.monthly.limit}</span>
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-4">
                <div
                  className={`h-full transition-all duration-500 ${
                    budget.monthly.used >= budget.monthly.limit ? "bg-amber" : "bg-signal"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((budget.monthly.used / Math.max(1, budget.monthly.limit)) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-bone-3">
                {budget.monthly.remaining} remaining
                {budget.creditsBalance > 0 ? ` + ${budget.creditsBalance} top-up credits` : ""}
              </p>
            </div>

            {/* renders today */}
            <div className="rounded-lg border border-ink-3 bg-ink px-4 py-3">
              <p className="label text-bone-3">Renders today</p>
              <p className="mt-1.5 text-lg font-semibold text-bone">
                {budget.today.renders}
                <span className="text-sm font-normal text-bone-3"> / {budget.today.renderCap}</span>
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-4">
                <div
                  className={`h-full transition-all duration-500 ${
                    budget.today.renders >= budget.today.renderCap ? "bg-amber" : "bg-signal"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((budget.today.renders / Math.max(1, budget.today.renderCap)) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-bone-3">Daily render cap (UTC)</p>
            </div>

            {/* spend today + breaker */}
            <div className="rounded-lg border border-ink-3 bg-ink px-4 py-3">
              <p className="label text-bone-3">Platform spend today</p>
              <p className="mt-1.5 text-lg font-semibold text-bone">
                ${budget.today.spendUsd.toFixed(2)}
                <span className="text-sm font-normal text-bone-3"> / ${budget.today.spendCapUsd}</span>
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-4">
                <div
                  className={`h-full transition-all duration-500 ${
                    budget.today.breakerTripped ? "bg-danger" : "bg-signal"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((budget.today.spendUsd / Math.max(0.01, budget.today.spendCapUsd)) * 100))}%`,
                  }}
                />
              </div>
              {budget.today.breakerTripped ? (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Circuit breaker active — resumes tomorrow
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-bone-3">Cost circuit breaker</p>
              )}
            </div>

            {/* cost per video */}
            <div className="rounded-lg border border-ink-3 bg-ink px-4 py-3">
              <p className="label text-bone-3">Cost per finished reel</p>
              <p className="mt-1.5 text-lg font-semibold text-bone">
                {budget.cost.avgUsd != null ? `$${budget.cost.avgUsd.toFixed(3)}` : "—"}
              </p>
              <p className="mt-2 text-xs text-bone-3">
                {budget.cost.doneCount} done · ${budget.cost.totalUsd.toFixed(3)} total
              </p>
              <p className="mt-1.5 text-xs text-bone-3">
                Provider:{" "}
                {budget.providerMode === "byok"
                  ? "your Gemini key"
                  : budget.providerMode === "mock"
                    ? "sandbox (no spend)"
                    : "platform pool"}
              </p>
            </div>
          </div>

          {/* top-up pack — informational until checkout ships */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-4 bg-ink px-4 py-3">
            <div>
              <p className="text-sm font-medium text-bone">
                Top-up pack: {budget.topupPack.videos} extra videos · ${budget.topupPack.priceUsd}
              </p>
              <p className="mt-0.5 text-xs text-bone-3">
                {budget.creditsBalance > 0
                  ? `${budget.creditsBalance} credits in your balance — spent automatically after your monthly quota.`
                  : "Used automatically once your monthly quota runs out. No rollover."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="label rounded border border-ink-4 px-2 py-1 text-bone-3">
                checkout coming with billing
              </span>
              <a href="/pricing" className="btn-ghost px-3 py-1.5 text-xs">
                View plans
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Render queue ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Render queue</h2>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            onClick={() => fetchVideos()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {videos.length === 0 ? (
          <div className="grid-dots flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-4 px-6 py-12 text-center">
            <Film className="h-7 w-7 text-bone-3" />
            <p className="mt-3 text-sm font-medium text-bone-2">No renders yet</p>
            <p className="mt-1 max-w-sm text-xs text-bone-3">
              Pick a product above and press Generate video — the reel appears here with live progress.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {videos.map((v) => (
              <div key={v.id} className="panel overflow-hidden">
                {/* thumb / player */}
                <div className="relative aspect-[9/16] max-h-56 w-full bg-ink">
                  {playingId === v.id && v.hasFile ? (
                    <video
                      className="h-full w-full object-contain"
                      src={`/api/dashboard/videos/${v.id}/file?type=final`}
                      controls
                      autoPlay
                      playsInline
                    />
                  ) : v.hasThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/dashboard/videos/${v.id}/file?type=thumb`}
                      alt={v.title ?? "Video thumbnail"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Clapperboard className="h-8 w-8 text-ink-4" />
                    </div>
                  )}

                  <div className="absolute left-2 top-2 flex gap-1.5">
                    <StatusBadge status={v.renderStatus} />
                  </div>

                  {v.renderStatus === "done" && v.hasFile && (
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
                      onClick={() => setPlayingId(playingId === v.id ? null : v.id)}
                      aria-label={playingId === v.id ? "Close player" : "Play video"}
                    >
                      {playingId !== v.id && (
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-signal text-ink">
                          <Play className="h-5 w-5 fill-current" />
                        </span>
                      )}
                    </button>
                  )}

                  {v.renderStatus === "rendering" && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-4">
                        <div
                          className="h-full bg-signal transition-all duration-500"
                          style={{ width: `${Math.max(3, v.progressPct)}%` }}
                        />
                      </div>
                      <p className="label mt-1 text-signal">{v.progressPct}%</p>
                    </div>
                  )}
                </div>

                {/* meta */}
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-bone" title={v.title ?? ""}>
                      {v.title ?? "Untitled product"}
                    </p>
                    <span className="label shrink-0 rounded border border-ink-4 px-1.5 py-0.5 text-bone-3">
                      {v.mode}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-bone-3">
                    <span>
                      {v.provider === "byok"
                        ? "Your key"
                        : v.provider === "mock"
                          ? "Sandbox"
                          : "Platform pool"}
                    </span>
                    {v.durationSec != null && <span>{v.durationSec}s</span>}
                    {v.costUsd != null && <span className="text-bone-2">{formatCost(v.costUsd)}</span>}
                    <span>{timeAgo(v.createdAt)}</span>
                    {v.retryCount > 0 && <span>retry {v.retryCount}</span>}
                  </div>

                  {v.renderStatus === "failed" && (
                    <div className="mt-2.5">
                      <p className="line-clamp-2 text-xs text-danger" title={v.failureReason ?? ""}>
                        {v.failureReason ?? "Render failed."}
                      </p>
                      <button
                        type="button"
                        className="btn-ghost mt-2 px-3 py-1.5 text-xs"
                        onClick={() => handleRetry(v.id)}
                        disabled={retryingId === v.id}
                      >
                        {retryingId === v.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Retry render
                      </button>
                    </div>
                  )}

                  {v.renderStatus === "done" && (
                    <div className="mt-2 space-y-2">
                      {/* post status per platform */}
                      {(v.posts?.length ?? 0) > 0 ? (
                        v.posts.map((p) => (
                          <div
                            key={p.platform}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${postRowClass(p)}`}
                          >
                            <div className="flex items-center gap-1.5">
                              {(() => POST_PLATFORM_ICONS[p.platform])() as React.ReactElement}
                              <span className="font-medium capitalize">{p.platform}</span>
                              {p.sandbox && <span className="label bg-amber/20 text-amber px-1.5 py-0.5">Sandbox</span>}
                              <span className={`label ${postStatusClass(p)}`}>{p.status}</span>
                            </div>
                            {p.status === "published" && p.permalink && (
                              <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-signal hover:underline text-xs">
                                View
                              </a>
                            )}
                            {p.status === "failed" && (
                              <button
                                type="button"
                                className="btn-ghost px-2.5 py-1 text-xs"
                                onClick={() => handlePost(v.id, p.platform)}
                                disabled={postingId === `${v.id}:${p.platform}`}
                              >
                                {postingId === `${v.id}:${p.platform}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                Retry
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        // No posts yet — show manual post buttons for each platform
                        <div className="flex flex-wrap gap-2">
                          {["instagram", "youtube"].map((platform) => (
                            <button
                              key={platform}
                              type="button"
                              className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5"
                              onClick={() => handlePost(v.id, platform as "instagram" | "youtube")}
                              disabled={postingId === `${v.id}:${platform}`}
                            >
                              {postingId === `${v.id}:${platform}` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                POST_PLATFORM_ICONS[platform]
                              )}
                              Post to {platform.charAt(0).toUpperCase() + platform.slice(1)}
                            </button>
                          ))}
                        </div>
                      )}

                      {v.hasFile && (
                        <a
                          href={`/api/dashboard/videos/${v.id}/file?type=final`}
                          download
                          className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5 w-fit"
                          aria-label="Download video"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${
              toast.type === "success"
                ? "border border-signal/40 bg-signal/10 text-signal"
                : "border border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
