"use client";

import { useState, useEffect } from "react";
import {
  User,
  Cpu,
  CreditCard,
  Bell,
  Shield,
  Users,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Globe,
  Palette,
  Key,
  Trash2,
  Plus,
  ExternalLink,
  Settings as SettingsIcon,
} from "lucide-react";

type BrandProfile = {
  niche: string;
  audienceDesc: string;
  tone: string;
  languages: string[];
  bannedWords: string[];
  voiceSampleRef?: string;
};

type AIKeys = {
  geminiKey?: string;
  elevenlabsKey?: string;
};

type NotificationPrefs = {
  email: {
    dailyReport: boolean;
    weeklyReport: boolean;
    autopilotErrors: boolean;
    billingAlerts: boolean;
    newFeatures: boolean;
  };
  inApp: {
    autopilotStatus: boolean;
    dmReplies: boolean;
    conversionAlerts: boolean;
  };
};

type SecuritySettings = {
  twoFactorEnabled: boolean;
  sessions: { id: string; device: string; ip: string; lastActive: string; current: boolean }[];
};

type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "editor" | "analyst" | "viewer";
  invitedAt: string;
  status: "active" | "pending";
};

const TONES = [
  "professional",
  "friendly",
  "witty",
  "authoritative",
  "casual",
  "enthusiastic",
  "minimalist",
  "storytelling",
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "hinglish", label: "Hinglish" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
];

const ROLES = [
  { value: "owner", label: "Owner", description: "Full access + billing + team management", color: "bg-purple-500" },
  { value: "admin", label: "Admin", description: "All features except billing", color: "bg-blue-500" },
  { value: "editor", label: "Editor", description: "Create/edit content, publish, manage connections", color: "bg-green-500" },
  { value: "analyst", label: "Analyst", description: "View analytics, reports, exports", color: "bg-amber-500" },
  { value: "viewer", label: "Viewer", description: "Read-only access to dashboard", color: "bg-gray-500" },
];

const TABS = [
  { id: "brand", label: "Brand voice", icon: Palette },
  { id: "ai", label: "AI keys (BYOK)", icon: Cpu },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "team", label: "Team (RBAC)", icon: Users },
] as const;

type TabId = typeof TABS[number]["id"];

export function SettingsClient() {
  const [activeTab, setActiveTab] = useState<TabId>("brand");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<TabId | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Brand profile
  const [brand, setBrand] = useState<BrandProfile>({
    niche: "",
    audienceDesc: "",
    tone: "friendly",
    languages: ["en"],
    bannedWords: [],
    voiceSampleRef: undefined,
  });

  // AI keys
  const [aiKeys, setAiKeys] = useState<AIKeys>({
    geminiKey: "",
    elevenlabsKey: "",
  });
  const [showGemini, setShowGemini] = useState(false);
  const [showElevenLabs, setShowElevenLabs] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    email: {
      dailyReport: true,
      weeklyReport: true,
      autopilotErrors: true,
      billingAlerts: true,
      newFeatures: false,
    },
    inApp: {
      autopilotStatus: true,
      dmReplies: true,
      conversionAlerts: true,
    },
  });

  // Security
  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    sessions: [],
  });

  // Team
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "analyst" | "viewer">("editor");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [brandRes, aiRes, notifRes, secRes, teamRes] = await Promise.all([
          fetch("/api/dashboard/settings/brand"),
          fetch("/api/dashboard/settings/ai-keys"),
          fetch("/api/dashboard/settings/notifications"),
          fetch("/api/dashboard/settings/security"),
          fetch("/api/dashboard/settings/team"),
        ]);

        if (mounted) {
          if (brandRes.ok) setBrand(await brandRes.json());
          if (aiRes.ok) setAiKeys(await aiRes.json());
          if (notifRes.ok) setNotifications(await notifRes.json());
          if (secRes.ok) setSecurity(await secRes.json());
          if (teamRes.ok) setTeam(await teamRes.json());
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  async function saveBrand() {
    setSaving("brand");
    try {
      const res = await fetch("/api/dashboard/settings/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brand),
      });
      if (res.ok) setToast({ msg: "Brand profile saved", type: "success" });
      else throw new Error("Failed to save");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to save", type: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function saveAIKeys() {
    setSaving("ai");
    try {
      const res = await fetch("/api/dashboard/settings/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiKeys),
      });
      if (res.ok) setToast({ msg: "AI keys saved", type: "success" });
      else throw new Error("Failed to save");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to save", type: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function saveNotifications() {
    setSaving("notifications");
    try {
      const res = await fetch("/api/dashboard/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifications),
      });
      if (res.ok) setToast({ msg: "Notification preferences saved", type: "success" });
      else throw new Error("Failed to save");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to save", type: "error" });
    } finally {
      setSaving(null);
    }
  }

  async function revokeSession(sessionId: string) {
    try {
      const res = await fetch(`/api/dashboard/settings/security/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ msg: "Session revoked", type: "success" });
      } else throw new Error("Failed to revoke");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to revoke", type: "error" });
    }
  }

  async function enable2FA() {
    try {
      const res = await fetch("/api/dashboard/settings/security/2fa", { method: "POST" });
      if (res.ok) {
        setToast({ msg: "2FA setup initiated — check your authenticator app", type: "success" });
      } else throw new Error("Failed to enable 2FA");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to enable 2FA", type: "error" });
    }
  }

  async function inviteMember() {
    if (!inviteEmail.trim()) return;
    try {
      const res = await fetch("/api/dashboard/settings/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        setToast({ msg: "Invitation sent", type: "success" });
        setInviteEmail("");
      } else throw new Error("Failed to invite");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to invite", type: "error" });
    }
  }

  async function updateMemberRole(memberId: string, newRole: TeamMember["role"]) {
    try {
      const res = await fetch(`/api/dashboard/settings/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setToast({ msg: "Role updated", type: "success" });
      } else throw new Error("Failed to update role");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to update role", type: "error" });
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this team member? They will lose access immediately.")) return;
    try {
      const res = await fetch(`/api/dashboard/settings/team/${memberId}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ msg: "Member removed", type: "success" });
      } else throw new Error("Failed to remove member");
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to remove member", type: "error" });
    }
  }

  function addBannedWord(word: string) {
    const trimmed = word.trim();
    if (trimmed && !brand.bannedWords.includes(trimmed)) {
      setBrand((prev) => ({ ...prev, bannedWords: [...prev.bannedWords, trimmed] }));
    }
  }

  function removeBannedWord(word: string) {
    setBrand((prev) => ({ ...prev, bannedWords: prev.bannedWords.filter((w) => w !== word) }));
  }

  function addLanguage(lang: string) {
    if (!brand.languages.includes(lang)) {
      setBrand((prev) => ({ ...prev, languages: [...prev.languages, lang] }));
    }
  }

  function removeLanguage(lang: string) {
    if (brand.languages.length > 1) {
      setBrand((prev) => ({ ...prev, languages: prev.languages.filter((l) => l !== lang) }));
    }
  }

  if (loading) {
    return (
      <div className="grid-dots flex items-center justify-center py-16">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 text-signal animate-spin" />
          <span className="label text-bone-3">Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 border-b border-ink-3 pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-signal text-ink border-b-2 border-signal"
                : "text-bone-2 hover:text-bone hover:bg-ink-2"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === "brand" && (
        <BrandTab brand={brand} setBrand={setBrand} save={saveBrand} saving={saving === "brand"}
          addBannedWord={addBannedWord} removeBannedWord={removeBannedWord}
          addLanguage={addLanguage} removeLanguage={removeLanguage} />
      )}

      {activeTab === "ai" && (
        <AITab aiKeys={aiKeys} setAiKeys={setAiKeys} save={saveAIKeys} saving={saving === "ai"}
          showGemini={showGemini} setShowGemini={setShowGemini}
          showElevenLabs={showElevenLabs} setShowElevenLabs={setShowElevenLabs} />
      )}

      {activeTab === "billing" && <BillingTab />}

      {activeTab === "notifications" && (
        <NotificationsTab notifications={notifications} setNotifications={setNotifications} save={saveNotifications} saving={saving === "notifications"} />
      )}

      {activeTab === "security" && (
        <SecurityTab security={security} setSecurity={setSecurity}
          revokeSession={revokeSession} enable2FA={enable2FA} />
      )}

      {activeTab === "team" && (
        <TeamTab team={team} setTeam={setTeam}
          inviteEmail={inviteEmail} setInviteEmail={setInviteEmail}
          inviteRole={inviteRole} setInviteRole={setInviteRole}
          inviteMember={inviteMember} updateMemberRole={updateMemberRole} removeMember={removeMember} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${
              toast.type === "success" ? "border border-signal/40 bg-signal/10 text-signal" : "border border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Components ───

function BrandTab({
  brand,
  setBrand,
  save,
  saving,
  addBannedWord,
  removeBannedWord,
  addLanguage,
  removeLanguage,
}: {
  brand: BrandProfile;
  setBrand: React.Dispatch<React.SetStateAction<BrandProfile>>;
  save: () => void;
  saving: boolean;
  addBannedWord: (word: string) => void;
  removeBannedWord: (word: string) => void;
  addLanguage: (lang: string) => void;
  removeLanguage: (lang: string) => void;
}) {
  const [bannedInput, setBannedInput] = useState("");
  const [langInput, setLangInput] = useState("");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Brand voice</h2>
        <p className="text-sm text-bone-3">Define how your AI Character speaks and writes.</p>
      </div>

      <section className="space-y-4">
        <h3 className="font-medium">Niche & audience</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label text-bone-3">Niche</label>
            <input
              type="text"
              value={brand.niche}
              onChange={(e) => setBrand((prev) => ({ ...prev, niche: e.target.value }))}
              placeholder="e.g. fitness supplements, tech gadgets, beauty skincare"
              className="field mt-1.5"
            />
          </div>
          <div>
            <label className="label text-bone-3">Target audience</label>
            <textarea
              value={brand.audienceDesc}
              onChange={(e) => setBrand((prev) => ({ ...prev, audienceDesc: e.target.value }))}
              placeholder="e.g. Women 25-40 interested in home workouts, busy professionals..."
              className="field mt-1.5 min-h-[80px]"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium">Tone & style</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label text-bone-3">Primary tone</label>
            <select
              value={brand.tone}
              onChange={(e) => setBrand((prev) => ({ ...prev, tone: e.target.value }))}
              className="field mt-1.5"
            >
              {TONES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-bone-3">Content languages</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {brand.languages.map((lang) => {
                const l = LANGUAGES.find((x) => x.code === lang);
                return (
                  <span key={lang} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-4 bg-ink px-2 py-1 text-sm text-bone-2">
                    {l?.label || lang}
                    <button onClick={() => removeLanguage(lang)} className="text-bone-3 hover:text-danger">×</button>
                  </span>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={langInput}
                onChange={(e) => setLangInput(e.target.value)}
                placeholder="Add language code (en, hi, es...)"
                className="field flex-1"
              />
              <button onClick={() => { addLanguage(langInput); setLangInput(""); }} className="btn-ghost text-sm">
                <Plus className="h-4 w-4 mr-1.5" /> Add
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium">Banned words (compliance)</h3>
        <p className="text-sm text-bone-3">These words will never appear in generated content.</p>
        <div className="flex flex-wrap gap-2">
          {brand.bannedWords.map((w) => (
            <span key={w} className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-sm text-danger">
              {w}
              <button onClick={() => removeBannedWord(w)} className="hover:text-bone">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={bannedInput}
            onChange={(e) => setBannedInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBannedWord(bannedInput); setBannedInput(""); } }}
            placeholder="Add banned word (press Enter)"
            className="field flex-1"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium">Voice sample (for voice clone)</h3>
        <p className="text-sm text-bone-3">Upload a 30-60 second clean audio sample for ElevenLabs voice cloning (Pro+).</p>
        <div className="panel p-5">
          <input type="file" accept="audio/*" className="field" />
          <p className="mt-2 text-xs text-bone-3">Supported: MP3, WAV, M4A — max 10MB</p>
        </div>
      </section>

      <div className="flex justify-end pt-4 border-t border-ink-3">
        <button onClick={save} disabled={saving} className="btn-signal flex items-center gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save brand profile
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function AITab({
  aiKeys,
  setAiKeys,
  save,
  saving,
  showGemini,
  setShowGemini,
  showElevenLabs,
  setShowElevenLabs,
}: {
  aiKeys: AIKeys;
  setAiKeys: React.Dispatch<React.SetStateAction<AIKeys>>;
  save: () => void;
  saving: boolean;
  showGemini: boolean;
  setShowGemini: (v: boolean) => void;
  showElevenLabs: boolean;
  setShowElevenLabs: (v: boolean) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">AI keys (BYOK)</h2>
        <p className="text-sm text-bone-3">Bring your own keys for −30% discount on video costs. Keys are AES-256 encrypted, server-only.</p>
      </div>

      <section className="space-y-4">
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                <Cpu className="h-5 w-5 text-indigo-500" />
              </span>
              <div>
                <h3 className="font-medium">Gemini API key</h3>
                <p className="text-sm text-bone-3">Powers video engine (Veo) — −30% on all plans</p>
              </div>
            </div>
            <button
              onClick={() => setShowGemini(!showGemini)}
              className="btn-ghost text-sm"
            >
              {showGemini ? <XCircle className="h-4 w-4" /> : <Key className="h-4 w-4" />}
              {showGemini ? " Hide" : " Show"}
            </button>
          </div>

          {showGemini && (
            <div className="mt-4 space-y-3">
              <input
                type={showGemini ? "text" : "password"}
                value={aiKeys.geminiKey || ""}
                onChange={(e) => setAiKeys((prev) => ({ ...prev, geminiKey: e.target.value }))}
                placeholder="AIzaSy... (Google AI Studio → Get API key)"
                className="field font-mono text-sm"
              />
              <div className="flex items-center gap-2 text-xs text-bone-3">
                <ExternalLink className="h-3.5 w-3.5" />
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-signal underline">
                  Get key from Google AI Studio
                </a>
              </div>
              <p className="text-xs text-bone-3">Format: <code className="font-mono">AIzaSy...</code> — never shared, encrypted at rest.</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                <Cpu className="h-5 w-5 text-violet-500" />
              </span>
              <div>
                <h3 className="font-medium">ElevenLabs API key</h3>
                <p className="text-sm text-bone-3">Powers voiceover + voice clone (Pro+)</p>
              </div>
            </div>
            <button
              onClick={() => setShowElevenLabs(!showElevenLabs)}
              className="btn-ghost text-sm"
            >
              {showElevenLabs ? <XCircle className="h-4 w-4" /> : <Key className="h-4 w-4" />}
              {showElevenLabs ? " Hide" : " Show"}
            </button>
          </div>

          {showElevenLabs && (
            <div className="mt-4 space-y-3">
              <input
                type={showElevenLabs ? "text" : "password"}
                value={aiKeys.elevenlabsKey || ""}
                onChange={(e) => setAiKeys((prev) => ({ ...prev, elevenlabsKey: e.target.value }))}
                placeholder="sk_... (ElevenLabs → Profile → API key)"
                className="field font-mono text-sm"
              />
              <div className="flex items-center gap-2 text-xs text-bone-3">
                <ExternalLink className="h-3.5 w-3.5" />
                <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-signal underline">
                  Get key from ElevenLabs
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="rounded-xl border border-amber/40 bg-amber/5 p-5">
        <p className="text-sm leading-relaxed text-bone-2">
          <strong className="text-amber">Note:</strong> Keys are encrypted with AES-256 and never leave our server.
          You can revoke anytime. Without keys, the platform pool is used (included in plan).
        </p>
      </div>

      <div className="flex justify-end pt-4 border-t border-ink-3">
        <button onClick={save} disabled={saving} className="btn-signal flex items-center gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save AI keys
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Billing</h2>
        <p className="text-sm text-bone-3">Manage your subscription, payment method, and invoices.</p>
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Current plan: Pro</h3>
            <p className="text-sm text-bone-3">$79/month — renews on 15th of each month</p>
          </div>
          <span className="label rounded border border-signal/40 bg-signal/10 px-1.5 py-0.5 text-signal">Active</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button className="btn-ghost w-full justify-start p-4">
          <CreditCard className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">Payment method</p>
            <p className="text-sm text-bone-3">Update card / UPI</p>
          </div>
        </button>
        <button className="btn-ghost w-full justify-start p-4">
          <ExternalLink className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">Invoices</p>
            <p className="text-sm text-bone-3">View & download history</p>
          </div>
        </button>
      </div>

      <div className="rounded-xl border border-amber/40 bg-amber/5 p-5">
        <p className="text-sm leading-relaxed text-bone-2">
          <strong className="text-amber">Note:</strong> Billing is handled by Stripe (international) / Razorpay (India).
          You will be redirected to their secure portal for payment changes.
        </p>
      </div>
    </div>
  );
}

function NotificationsTab({
  notifications,
  setNotifications,
  save,
  saving,
}: {
  notifications: NotificationPrefs;
  setNotifications: React.Dispatch<React.SetStateAction<NotificationPrefs>>;
  save: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
        <p className="text-sm text-bone-3">Choose what you want to be notified about.</p>
      </div>

      <section className="space-y-4">
        <h3 className="font-medium">Email notifications</h3>
        <div className="space-y-3">
          {[
            { key: "dailyReport", label: "Daily report", desc: "Morning summary of yesterday's performance" },
            { key: "weeklyReport", label: "Weekly AI report", desc: "Insights + next week's plan" },
            { key: "autopilotErrors", label: "Autopilot errors", desc: "When jobs fail or circuit breakers trigger" },
            { key: "billingAlerts", label: "Billing alerts", desc: "Renewals, failed payments, invoice ready" },
            { key: "newFeatures", label: "New features", desc: "Product updates and announcements" },
          ].map((n) => (
            <label key={n.key} className="flex items-center justify-between p-4 rounded-xl border border-ink-3 bg-ink-2">
              <div>
                <p className="font-medium">{n.label}</p>
                <p className="text-sm text-bone-3">{n.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.email[n.key as keyof typeof notifications.email]}
                onChange={(e) => setNotifications((prev) => ({
                  ...prev,
                  email: { ...prev.email, [n.key]: e.target.checked },
                }))}
                className="h-4 w-4 rounded border-ink-4 text-signal focus:ring-signal"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium">In-app notifications</h3>
        <div className="space-y-3">
          {[
            { key: "autopilotStatus", label: "Autopilot status changes", desc: "Paused, resumed, circuit breaker triggered" },
            { key: "dmReplies", label: "DM replies", desc: "When someone replies to your automated DMs" },
            { key: "conversionAlerts", label: "Conversion alerts", desc: "New sales/commissions detected" },
          ].map((n) => (
            <label key={n.key} className="flex items-center justify-between p-4 rounded-xl border border-ink-3 bg-ink-2">
              <div>
                <p className="font-medium">{n.label}</p>
                <p className="text-sm text-bone-3">{n.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={notifications.inApp[n.key as keyof typeof notifications.inApp]}
                onChange={(e) => setNotifications((prev) => ({
                  ...prev,
                  inApp: { ...prev.inApp, [n.key]: e.target.checked },
                }))}
                className="h-4 w-4 rounded border-ink-4 text-signal focus:ring-signal"
              />
            </label>
          ))}
        </div>
      </section>

      <div className="flex justify-end pt-4 border-t border-ink-3">
        <button onClick={save} disabled={saving} className="btn-signal flex items-center gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SecurityTab({
  security,
  setSecurity,
  revokeSession,
  enable2FA,
}: {
  security: SecuritySettings;
  setSecurity: React.Dispatch<React.SetStateAction<SecuritySettings>>;
  revokeSession: (id: string) => void;
  enable2FA: () => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Security</h2>
        <p className="text-sm text-bone-3">Manage 2FA, active sessions, and data export.</p>
      </div>

      <section className="space-y-4">
        <div className="panel p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-medium">Two-factor authentication (2FA)</h3>
            <p className="text-sm text-bone-3">Add an extra layer of security with TOTP (Google Authenticator, Authy, etc.)</p>
          </div>
          {security.twoFactorEnabled ? (
            <span className="label rounded border border-signal/40 bg-signal/10 px-1.5 py-0.5 text-signal">Enabled</span>
          ) : (
            <button onClick={enable2FA} className="btn-signal">
              <Shield className="h-4 w-4 mr-2" />
              Enable 2FA
            </button>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium">Active sessions</h3>
        {security.sessions.length === 0 ? (
          <div className="panel p-5 text-center text-bone-3">No active sessions</div>
        ) : (
          <div className="space-y-3">
            {security.sessions.map((s) => (
              <div key={s.id} className="panel p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-2">
                    <Globe className="h-5 w-5 text-bone-3" />
                  </div>
                  <div>
                    <p className="font-medium">{s.device}</p>
                    <p className="text-sm text-bone-3">{s.ip} · Last active: {s.lastActive}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.current && <span className="label rounded border border-signal/40 bg-signal/10 px-1.5 py-0.5 text-signal">Current</span>}
                  {!s.current && (
                    <button onClick={() => revokeSession(s.id)} className="btn-ghost text-xs text-danger hover:bg-danger/10">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="font-medium">Your data</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <button className="btn-ghost w-full justify-start p-4">
            <ExternalLink className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">Export data</p>
              <p className="text-sm text-bone-3">Download all your data (GDPR)</p>
            </div>
          </button>
          <button className="btn-ghost w-full justify-start p-4 text-danger hover:bg-danger/10">
            <Trash2 className="h-5 w-5 mr-2" />
            <div>
              <p className="font-medium">Delete account</p>
              <p className="text-sm text-bone-3">Permanently remove all data</p>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}

function TeamTab({
  team,
  setTeam,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviteMember,
  updateMemberRole,
  removeMember,
}: {
  team: TeamMember[];
  setTeam: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: "admin" | "editor" | "analyst" | "viewer";
  setInviteRole: (v: "admin" | "editor" | "analyst" | "viewer") => void;
  inviteMember: () => void;
  updateMemberRole: (id: string, role: TeamMember["role"]) => void;
  removeMember: (id: string) => void;
}) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Team (RBAC)</h2>
          <p className="text-sm text-bone-3">Invite collaborators and manage roles.</p>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="font-medium">Invite new member</h3>
        <div className="panel p-5 grid gap-4 sm:grid-cols-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@domain.com"
            className="field"
          />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "editor" | "analyst" | "viewer")} className="field">
            {ROLES.filter((r) => r.value !== "owner").map((r) => (
              <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
            ))}
          </select>
          <button onClick={inviteMember} className="btn-signal">
            <Plus className="h-4 w-4 mr-2" />
            Invite
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium">Team members</h3>
        {team.length === 0 ? (
          <div className="panel p-5 text-center text-bone-3">No team members yet. Invite someone above.</div>
        ) : (
          <div className="space-y-3">
            {team.map((m) => {
              const roleConfig = ROLES.find((r) => r.value === m.role)!;
              return (
                <div key={m.id} className="panel p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-2">
                      <User className="h-5 w-5 text-bone-3" />
                    </div>
                    <div>
                      <p className="font-medium">{m.name || m.email}</p>
                      <p className="text-sm text-bone-3">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`label rounded px-2 py-0.5 ${roleConfig.color} text-white`}>{roleConfig.label}</span>
                    <select
                      value={m.role}
                      onChange={(e) => updateMemberRole(m.id, e.target.value as "owner" | "admin" | "editor" | "analyst" | "viewer")}
                      className="field w-36 text-sm"
                    >
                      {ROLES.filter((r) => r.value !== "owner" || m.role === "owner").map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    {m.role !== "owner" && (
                      <button onClick={() => removeMember(m.id)} className="btn-ghost text-xs text-danger hover:bg-danger/10">
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-ink-3 bg-ink-2 p-5">
        <h4 className="font-medium">Role permissions</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-3">
                <th className="label py-2 text-left text-bone-3">Permission</th>
                {ROLES.map((r) => <th key={r.value} className="label py-2 text-center">{r.label}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-ink-3">
                <td className="py-2 text-bone-2">View dashboard</td>
                {ROLES.map((r) => <td key={r.value} className="py-2 text-center text-signal">✓</td>)}
              </tr>
              <tr className="border-b border-ink-3">
                <td className="py-2 text-bone-2">Create/edit content</td>
                {ROLES.map((r) => <td key={r.value} className="py-2 text-center">{["owner", "admin", "editor"].includes(r.value) ? <CheckCircle2 className="h-4 w-4 mx-auto text-signal" /> : <XCircle className="h-4 w-4 mx-auto text-bone-3" />}</td>)}
              </tr>
              <tr className="border-b border-ink-3">
                <td className="py-2 text-bone-2">Publish posts</td>
                {ROLES.map((r) => <td key={r.value} className="py-2 text-center">{["owner", "admin", "editor"].includes(r.value) ? <CheckCircle2 className="h-4 w-4 mx-auto text-signal" /> : <XCircle className="h-4 w-4 mx-auto text-bone-3" />}</td>)}
              </tr>
              <tr className="border-b border-ink-3">
                <td className="py-2 text-bone-2">Manage connections</td>
                {ROLES.map((r) => <td key={r.value} className="py-2 text-center">{["owner", "admin"].includes(r.value) ? <CheckCircle2 className="h-4 w-4 mx-auto text-signal" /> : <XCircle className="h-4 w-4 mx-auto text-bone-3" />}</td>)}
              </tr>
              <tr className="border-b border-ink-3">
                <td className="py-2 text-bone-2">View analytics</td>
                {ROLES.map((r) => <td key={r.value} className="py-2 text-center">{["owner", "admin", "editor", "analyst"].includes(r.value) ? <CheckCircle2 className="h-4 w-4 mx-auto text-signal" /> : <XCircle className="h-4 w-4 mx-auto text-bone-3" />}</td>)}
              </tr>
              <tr className="border-b border-ink-3">
                <td className="py-2 text-bone-2">Manage team</td>
                {ROLES.map((r) => <td key={r.value} className="py-2 text-center">{["owner", "admin"].includes(r.value) ? <CheckCircle2 className="h-4 w-4 mx-auto text-signal" /> : <XCircle className="h-4 w-4 mx-auto text-bone-3" />}</td>)}
              </tr>
              <tr className="border-b border-ink-3">
                <td className="py-2 text-bone-2">Billing access</td>
                {ROLES.map((r) => <td key={r.value} className="py-2 text-center">{["owner"].includes(r.value) ? <CheckCircle2 className="h-4 w-4 mx-auto text-signal" /> : <XCircle className="h-4 w-4 mx-auto text-bone-3" />}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}