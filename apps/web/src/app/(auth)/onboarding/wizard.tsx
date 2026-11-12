"use client";

import { useState, useTransition } from "react";
import { saveOnboardingProfile } from "../actions";

const NICHES = [
  "Fitness",
  "Tech & Gadgets",
  "Beauty & Skincare",
  "Home & Kitchen",
  "Personal Finance",
  "Food & Nutrition",
  "Fashion",
  "Travel",
];

const AFFILIATE_NETWORKS = [
  { id: "amazon", name: "Amazon Associates", note: "Physical products" },
  { id: "clickbank", name: "ClickBank", note: "Digital / recurring" },
  { id: "digistore", name: "Digistore24", note: "Digital courses" },
  { id: "shareasale", name: "ShareASale", note: "18k+ merchants" },
  { id: "impact", name: "Impact", note: "Brand marketplace" },
  { id: "cj", name: "CJ Affiliate", note: "Enterprise brands" },
];

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "X", "Pinterest", "Facebook"];

const TONES = ["Friendly", "Witty", "Expert", "Hype"];

const STEP_TITLES = [
  "Pick your niche",
  "Affiliate networks",
  "Your identity",
  "Meet your character",
];

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [networks, setNetworks] = useState<string[]>(["amazon"]);
  const [platforms, setPlatforms] = useState<string[]>(["Instagram"]);
  const [handle, setHandle] = useState("");
  const [tone, setTone] = useState("Friendly");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const finalNiche = niche === "Custom" ? customNiche.trim() : niche;

  const canNext =
    step === 0
      ? finalNiche.length > 1
      : step === 2
        ? handle.trim().length > 1
        : true;

  function submit() {
    if (!finalNiche || handle.trim().length < 2) {
      setError("Niche aur handle dono zaroori hain.");
      return;
    }
    const fd = new FormData();
    fd.set("niche", finalNiche);
    fd.set("tone", tone);
    fd.set("handle", handle.trim());
    setError(null);
    startTransition(async () => {
      const res = await saveOnboardingProfile(undefined, fd);
      if (res?.message) setError(res.message);
    });
  }

  const progress = ((step + 1) / STEP_TITLES.length) * 100;

  return (
    <div className="panel w-full max-w-2xl p-8">
      {/* header */}
      <div className="mb-7 flex items-center justify-between">
        <span className="label text-signal">
          Setup · step {step + 1}/{STEP_TITLES.length}
        </span>
        <span className="label text-bone-3">{STEP_TITLES[step]}</span>
      </div>
      <div className="mb-8 h-1 w-full overflow-hidden rounded-full bg-ink-3">
        <div
          className="h-full bg-signal transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── STEP 1: NICHE ── */}
      {step === 0 && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Aap kis niche mein kaam karoge?
          </h1>
          <p className="mt-2 text-sm text-bone-3">
            Isi se AI products, scripts aur audience decide karega. Baad mein
            settings mein change kar sakte ho.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...NICHES, "Custom"].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNiche(n)}
                className={`rounded-lg border px-3 py-3 text-sm transition-colors ${
                  niche === n
                    ? "border-signal bg-signal/10 text-signal"
                    : "border-ink-4 text-bone-2 hover:border-bone-3"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {niche === "Custom" && (
            <input
              autoFocus
              className="field mt-4"
              placeholder="Apna niche likho — e.g. Pet Care"
              value={customNiche}
              onChange={(e) => setCustomNiche(e.target.value)}
            />
          )}
        </div>
      )}

      {/* ── STEP 2: AFFILIATE ── */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Kaunse affiliate networks?
          </h1>
          <p className="mt-2 text-sm text-bone-3">
            Select karo — actual OAuth/key connect Phase 3 mein ek click se ho
            jayega. Planner abhi se jaan lega.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {AFFILIATE_NETWORKS.map((n) => {
              const on = networks.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() =>
                    setNetworks((prev) =>
                      on ? prev.filter((x) => x !== n.id) : [...prev, n.id],
                    )
                  }
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                    on
                      ? "border-signal bg-signal/10"
                      : "border-ink-4 hover:border-bone-3"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium">{n.name}</span>
                    <span className="label text-bone-3">{n.note}</span>
                  </span>
                  <span
                    className={`status-dot ${on ? "bg-signal" : "bg-ink-4"}`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 3: IDENTITY ── */}
      {step === 2 && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Aapka primary handle
          </h1>
          <p className="mt-2 text-sm text-bone-3">
            Is naam se aapka AI Character banega — yahi sab platforms pe use
            hoga.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="label mb-2 block text-bone-3">
                Social handle (character ka naam)
              </label>
              <input
                className="field"
                placeholder="fitwithrohit"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
              />
            </div>

            <div>
              <label className="label mb-2 block text-bone-3">
                Primary platform
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatforms([p])}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      platforms[0] === p
                        ? "border-signal bg-signal/10 text-signal"
                        : "border-ink-4 text-bone-2 hover:border-bone-3"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label mb-2 block text-bone-3">
                Brand tone
              </label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      tone === t
                        ? "border-signal bg-signal/10 text-signal"
                        : "border-ink-4 text-bone-2 hover:border-bone-3"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: CHARACTER REVEAL ── */}
      {step === 3 && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Apne character se milo 🎭
          </h1>
          <p className="mt-2 text-sm text-bone-3">
            Ye aapka AI persona hai — sochta hai, discuss karta hai, aur isi
            identity se sab kuch karta hai.
          </p>

          <div className="mt-6 grid-dots rounded-xl border border-ink-4 p-7 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-signal text-2xl font-bold text-ink">
              {(handle || "?").charAt(0).toUpperCase()}
            </div>
            <p className="mt-4 text-xl font-semibold tracking-tight">
              @{handle || "yourhandle"}
            </p>
            <p className="label mt-1 text-bone-3">
              {finalNiche || "niche"} · {tone} · {platforms[0]}
            </p>
            <p className="mx-auto mt-4 max-w-md text-sm text-bone-2">
              &ldquo;Main {handle || "aap"} hoon — {finalNiche?.toLowerCase()}{" "}
              audience ke liye roz strategy sochta hoon, comments ka reply
              karta hoon, aur sahi product sahi log tak pahunchata hoon.&rdquo;
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* nav */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          style={step === 0 ? { opacity: 0.35 } : undefined}
        >
          ← Back
        </button>

        {step < STEP_TITLES.length - 1 ? (
          <button
            type="button"
            className="btn-signal"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            className="btn-signal"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Launching…" : "Launch my workspace →"}
          </button>
        )}
      </div>
    </div>
  );
}
