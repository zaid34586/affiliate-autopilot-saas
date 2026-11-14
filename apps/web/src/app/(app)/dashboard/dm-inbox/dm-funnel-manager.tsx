"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Settings,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  Send,
  Zap,
  Shield,
  Clock,
  Users,
  X,
  Save,
  Loader2,
} from "lucide-react";

type FunnelStepType = "greet" | "pitch" | "link" | "followup";

interface FunnelStep {
  id?: string;
  stepType: FunnelStepType;
  order: number;
  template: string;
  delayHours: number;
  conditions: Record<string, unknown>;
}

interface Funnel {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  steps: FunnelStep[];
  createdAt: string;
}

interface Trigger {
  id: string;
  keywords: { set: string[]; semantic: boolean };
  mode: string;
  cooldownHours: number;
  dailyCap: number;
  funnelIds: string[];
}

const STEP_TYPE_LABELS: Record<FunnelStepType, string> = {
  greet: "Greeting",
  pitch: "Pitch",
  link: "Send Link",
  followup: "Follow-up",
};

const STEP_TYPE_COLORS: Record<FunnelStepType, string> = {
  greet: "bg-blue-500/10 text-blue-500",
  pitch: "bg-purple-500/10 text-purple-500",
  link: "bg-signal/10 text-signal",
  followup: "bg-amber-500/10 text-amber-500",
};

export function DmFunnelManager() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSteps, setFormSteps] = useState<FunnelStep[]>([
    { stepType: "greet", order: 0, template: "Hey {{handle}}! Thanks for your interest 👋", delayHours: 0, conditions: {} },
    { stepType: "pitch", order: 1, template: "I think you'd love {{product}} — it's been a game changer for my audience.", delayHours: 2, conditions: {} },
    { stepType: "link", order: 2, template: "Here's the link with current details: {{link}}", delayHours: 1, conditions: { hasLink: true } },
    { stepType: "followup", order: 3, template: "Let me know if you have any questions!", delayHours: 24, conditions: {} },
  ]);

  const load = useCallback(async () => {
    try {
      const [fRes, tRes] = await Promise.all([
        fetch("/api/dashboard/dm-funnels"),
        fetch("/api/dashboard/dm-triggers"),
      ]);
      if (fRes.ok) {
        const data = await fRes.json();
        setFunnels(data.funnels ?? []);
      }
      if (tRes.ok) {
        const data = await tRes.json();
        setTriggers(data.triggers ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await load();
    }
    void init();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const openModal = (funnel?: Funnel) => {
    if (funnel) {
      setEditingFunnel(funnel);
      setFormName(funnel.name);
      setFormDesc(funnel.description ?? "");
      setFormSteps(funnel.steps.map((s) => ({ ...s })));
    } else {
      setEditingFunnel(null);
      setFormName("");
      setFormDesc("");
      setFormSteps([
        { stepType: "greet", order: 0, template: "Hey {{handle}}! Thanks for your interest 👋", delayHours: 0, conditions: {} },
        { stepType: "pitch", order: 1, template: "I think you'd love {{product}} — it's been a game changer for my audience.", delayHours: 2, conditions: {} },
        { stepType: "link", order: 2, template: "Here's the link with current details: {{link}}", delayHours: 1, conditions: { hasLink: true } },
        { stepType: "followup", order: 3, template: "Let me know if you have any questions!", delayHours: 24, conditions: {} },
      ]);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFunnel(null);
  };

  const updateStep = (index: number, field: keyof FunnelStep, value: unknown) => {
    setFormSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addStep = () => {
    const nextOrder = formSteps.length > 0 ? Math.max(...formSteps.map((s) => s.order)) + 1 : 0;
    setFormSteps((prev) => [...prev, { stepType: "followup", order: nextOrder, template: "", delayHours: 0, conditions: {} }]);
  };

  const removeStep = (index: number) => {
    setFormSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const saveFunnel = async () => {
    if (!formName.trim()) return;
    setSaving(editingFunnel?.id ?? "new");
    try {
      const method = editingFunnel ? "PATCH" : "POST";
      const url = editingFunnel ? `/api/dashboard/dm-funnels/${editingFunnel.id}` : "/api/dashboard/dm-funnels";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim() || null,
          steps: formSteps.map((s) => ({
            stepType: s.stepType,
            order: s.order,
            template: s.template,
            delayHours: s.delayHours,
            conditions: s.conditions,
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setToast({ msg: editingFunnel ? "Funnel updated" : "Funnel created", type: "success" });
      closeModal();
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to save", type: "error" });
    } finally {
      setSaving(null);
    }
  };

  const deleteFunnel = async (id: string) => {
    if (!confirm("Delete this funnel? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/dashboard/dm-funnels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setToast({ msg: "Funnel deleted", type: "success" });
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to delete", type: "error" });
    }
  };

  const mapTriggerFunnel = async (triggerId: string, funnelId: string, action: "add" | "remove") => {
    try {
      const res = await fetch(`/api/dashboard/dm-triggers/${triggerId}/funnel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funnelId, action }),
      });
      if (!res.ok) throw new Error("Mapping failed");
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed to map", type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="grid-dots flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 text-signal animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DM Funnels</h1>
          <p className="text-sm text-bone-3">Multi-step auto-funnel: greet → pitch → link → follow-up</p>
        </div>
        <button onClick={() => openModal()} className="btn-signal flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New funnel
        </button>
      </div>

      {/* Funnels List */}
      <div className="space-y-4">
        {funnels.length === 0 ? (
          <div className="grid-dots rounded-xl border border-dashed border-ink-4 px-6 py-12 text-center">
            <span className="label rounded border border-ink-4 bg-ink-2 px-2 py-1 text-amber">No funnels yet</span>
            <p className="mt-3 text-bone-2">Create a funnel to automate multi-step DM sequences</p>
          </div>
        ) : (
          funnels.map((funnel) => (
            <div key={funnel.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-medium truncate">{funnel.name}</h3>
                    <span className={`label rounded px-2 py-0.5 ${funnel.enabled ? "border-signal/40 bg-signal/10 text-signal" : "border-ink-4 bg-ink text-bone-3"}`}>
                      {funnel.enabled ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs text-bone-3">{funnel.steps.length} steps</span>
                  </div>
                  {funnel.description && <p className="mt-1 text-sm text-bone-3">{funnel.description}</p>}

                  {/* Steps preview */}
                  <div className="mt-3 space-y-2">
                    {funnel.steps.map((step) => (
                      <div
                        key={`${step.stepType}-${step.order}`}
                        className="flex items-center gap-3 text-sm p-2 rounded-lg bg-ink-2"
                      >
                        <span className={`label rounded px-2 py-0.5 ${STEP_TYPE_COLORS[step.stepType]}`}>
                          {STEP_TYPE_LABELS[step.stepType]}
                        </span>
                        <span className="text-bone-3 font-mono text-xs flex-1 truncate">{step.template}</span>
                        {step.delayHours > 0 && (
                          <span className="label text-bone-3">
                            <Clock className="h-2.5 w-2.5 mr-1" /> +{step.delayHours}h
                          </span>
                        )}
                        {Object.keys(step.conditions).length > 0 && (
                          <span className="label text-bone-3">
                            <Shield className="h-2.5 w-2.5 mr-1" /> conditional
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openModal(funnel)} className="btn-ghost text-xs">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteFunnel(funnel.id)}
                    className="btn-ghost text-xs text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Trigger → Funnel Mapping */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight mb-4">Trigger → Funnel Mapping</h2>
        <p className="text-sm text-bone-3 mb-4">Assign funnels to keyword triggers. A trigger can start a funnel instead of a single reply.</p>
        {triggers.length === 0 ? (
          <div className="grid-dots rounded-xl border border-dashed border-ink-4 px-6 py-8 text-center">
            <span className="label rounded border border-ink-4 bg-ink-2 px-2 py-1 text-amber">No triggers configured</span>
            <p className="mt-3 text-bone-2">Create triggers in the DM Inbox to use with funnels</p>
          </div>
        ) : (
          <div className="space-y-3">
            {triggers.map((trigger) => (
              <div key={trigger.id} className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-signal/10">
                      <Zap className="h-5 w-5 text-signal" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">Keywords: {trigger.keywords.set.join(", ")} {trigger.keywords.semantic ? "+ semantic" : ""}</p>
                      <p className="text-xs text-bone-3">Mode: {trigger.mode} • Cooldown: {trigger.cooldownHours}h • Daily cap: {trigger.dailyCap}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {funnels.map((funnel) => (
                      <button
                        key={funnel.id}
                        onClick={() => mapTriggerFunnel(trigger.id, funnel.id, trigger.funnelIds.includes(funnel.id) ? "remove" : "add")}
                        className={`btn-ghost text-xs flex items-center gap-1 ${trigger.funnelIds.includes(funnel.id) ? "text-signal" : ""}`}
                      >
                        {trigger.funnelIds.includes(funnel.id) ? (
                          <X className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        {funnel.name}
                      </button>
                    ))}
                  </div>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-ink-3">
              <h2 className="text-lg font-semibold">{editingFunnel ? "Edit funnel" : "New funnel"}</h2>
              <button onClick={closeModal} className="btn-ghost">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label text-bone-3">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Welcome funnel"
                  className="field mt-1.5"
                />
              </div>
              <div>
                <label className="label text-bone-3">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Optional description"
                  className="field mt-1.5 min-h-[60px]"
                />
              </div>

              <h3 className="text-sm font-medium text-bone-2">Steps (in order)</h3>
              <div className="space-y-3">
                {formSteps.map((step, i) => (
                  <div key={i} className="rounded-xl border border-ink-3 bg-ink p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="label text-bone-3">Step {i + 1}</span>
                      {formSteps.length > 1 && (
                        <button onClick={() => removeStep(i)} className="btn-ghost text-xs text-danger p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label text-bone-3">Type</label>
                        <select
                          value={step.stepType}
                          onChange={(e) => updateStep(i, "stepType", e.target.value)}
                          className="field mt-1.5"
                        >
                          <option value="greet">Greeting</option>
                          <option value="pitch">Pitch</option>
                          <option value="link">Send Link</option>
                          <option value="followup">Follow-up</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-bone-3">Delay (hours)</label>
                        <input
                          type="number"
                          min="0"
                          max="168"
                          value={step.delayHours}
                          onChange={(e) => updateStep(i, "delayHours", parseInt(e.target.value) || 0)}
                          className="field mt-1.5"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label text-bone-3">Template</label>
                      <textarea
                        value={step.template}
                        onChange={(e) => updateStep(i, "template", e.target.value)}
                        placeholder="Hey handle! Check out product — link"
                        className="field mt-1.5 min-h-[80px] font-mono text-sm"
                      />
                      <p className="mt-1 text-xs text-bone-3">Variables: \u007B\u007Bhandle\u007D\u007D, \u007B\u007Bproduct\u007D\u007D, \u007B\u007Blink\u007D\u007D, \u007B\u007Bname\u007D\u007D, \u007B\u007Bprice\u007D\u007D</p>
                    </div>
                    <div>
                      <label className="label text-bone-3">Conditions (JSON)</label>
                      <textarea
                        value={JSON.stringify(step.conditions, null, 2)}
                        onChange={(e) => {
                          try {
                            updateStep(i, "conditions", JSON.parse(e.target.value));
                          } catch {
                            /* invalid JSON, ignore */
                          }
                        }}
                        placeholder='{"hasLink": true, "sentiment": "positive"}'
                        className="field mt-1.5 min-h-[60px] font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addStep} className="btn-ghost text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add step
              </button>

              <div className="flex justify-end gap-2 pt-4 border-t border-ink-3">
                <button onClick={closeModal} className="btn-ghost">
                  Cancel
                </button>
                <button
                  onClick={saveFunnel}
                  disabled={!!saving}
                  className="btn-signal flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : editingFunnel ? "Save changes" : "Create funnel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}