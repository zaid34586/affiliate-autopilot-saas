/**
 * Phase 7 — Templates Library Core Tests
 */

import { describe, it, expect } from "vitest";
import {
  TEMPLATE_NICHES,
  TEMPLATE_FORMATS,
  isTemplateNiche,
  isTemplateFormat,
  extractVariables,
  fillTemplate,
  validateTemplate,
  scoreTemplate,
  filterTemplates,
  recommendTemplates,
  BUILTIN_TEMPLATES,
  TemplateRecord,
} from "./templates-core";

function rec(overrides: Partial<TemplateRecord>): TemplateRecord {
  return {
    id: "id-1",
    key: "key-1",
    workspaceId: null,
    niche: "fitness",
    format: "reel_script",
    title: "Template Title",
    description: "A description long enough.",
    body: "Body with {{product}} variable.",
    variables: ["product"],
    tags: [],
    builtin: true,
    usageCount: 0,
    ...overrides,
  };
}

describe("taxonomy", () => {
  it("has 10 niches and 6 formats", () => {
    expect(TEMPLATE_NICHES).toHaveLength(10);
    expect(TEMPLATE_FORMATS).toHaveLength(6);
  });

  it("isTemplateNiche accepts valid, rejects invalid", () => {
    expect(isTemplateNiche("fitness")).toBe(true);
    expect(isTemplateNiche("SAAS")).toBe(false); // case-sensitive
    expect(isTemplateNiche(42)).toBe(false);
    expect(isTemplateNiche(undefined)).toBe(false);
  });

  it("isTemplateFormat accepts valid, rejects invalid", () => {
    expect(isTemplateFormat("dm_sequence")).toBe(true);
    expect(isTemplateFormat("story")).toBe(false);
    expect(isTemplateFormat(null)).toBe(false);
  });
});

describe("extractVariables", () => {
  it("extracts unique variables in order", () => {
    expect(extractVariables("{{b}} and {{a}} and {{b}}")).toEqual(["b", "a"]);
  });

  it("allows spaces inside braces", () => {
    expect(extractVariables("{{ product }}")).toEqual(["product"]);
  });

  it("allows digits and underscores in names", () => {
    expect(extractVariables("{{product_2}} {{v2}}")).toEqual(["product_2", "v2"]);
  });

  it("returns empty for no variables", () => {
    expect(extractVariables("plain text")).toEqual([]);
    expect(extractVariables("{{}}")).toEqual([]); // empty name not matched
  });
});

describe("fillTemplate", () => {
  it("fills all variables", () => {
    const r = fillTemplate("Buy {{product}} for {{price}}!", {
      product: "Shoes",
      price: "$20",
    });
    expect(r.text).toBe("Buy Shoes for $20!");
    expect(r.missing).toEqual([]);
    expect(r.unused).toEqual([]);
  });

  it("reports missing variables and leaves placeholders visible", () => {
    const r = fillTemplate("Hi {{name}}, try {{product}}", { name: "Sam" });
    expect(r.text).toContain("Hi Sam");
    expect(r.text).toContain("{{product}}"); // not silently dropped
    expect(r.missing).toEqual(["product"]);
  });

  it("treats empty-string values as missing", () => {
    const r = fillTemplate("{{a}}", { a: "" });
    expect(r.missing).toEqual(["a"]);
    expect(r.text).toBe("{{a}}");
  });

  it("reports unused supplied keys", () => {
    const r = fillTemplate("{{a}}", { a: "x", junk: "y" });
    expect(r.text).toBe("x");
    expect(r.unused).toEqual(["junk"]);
  });

  it("handles duplicate variables consistently", () => {
    const r = fillTemplate("{{x}}-{{x}}", { x: "1" });
    expect(r.text).toBe("1-1");
    expect(r.missing).toEqual([]);
  });
});

describe("validateTemplate", () => {
  const good = {
    niche: "fitness",
    format: "hook",
    title: "Good Title",
    description: "Long enough description here.",
    body: "This is a body with enough characters.",
  };

  it("accepts a valid template", () => {
    expect(validateTemplate(good)).toEqual({ valid: true, errors: [] });
  });

  it("rejects short title / description / body", () => {
    expect(validateTemplate({ ...good, title: "ab" }).valid).toBe(false);
    expect(validateTemplate({ ...good, description: "short" }).valid).toBe(false);
    expect(validateTemplate({ ...good, body: "tiny" }).valid).toBe(false);
  });

  it("rejects invalid niche and format", () => {
    const r = validateTemplate({ ...good, niche: "crypto", format: "tiktok" });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(2);
  });

  it("rejects unbalanced {{ }} in body", () => {
    expect(validateTemplate({ ...good, body: "unclosed {{variable here" }).valid).toBe(false);
    expect(validateTemplate({ ...good, body: "extra }} closing here }} ok" }).valid).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(validateTemplate({}).valid).toBe(false);
  });
});

describe("scoreTemplate", () => {
  const t = rec({
    title: "Fitness Reel Hook Pack",
    description: "Hooks for fitness reels",
    tags: ["hooks", "fitness"],
    body: "body text",
  });

  it("scores exact title match highest", () => {
    expect(scoreTemplate(t, "fitness reel hook pack")).toBeGreaterThan(50);
  });

  it("scores title substring > tag > description", () => {
    const inTitle = scoreTemplate(t, "reel hook");
    const inTags = scoreTemplate(t, "hooks");
    const inDesc = scoreTemplate(t, "fitness reels");
    expect(inTitle).toBeGreaterThan(inTags);
    expect(inTags).toBeGreaterThan(inDesc);
  });

  it("returns 0 for empty or non-matching query", () => {
    expect(scoreTemplate(t, "")).toBe(0);
    expect(scoreTemplate(t, "   ")).toBe(0);
    expect(scoreTemplate(t, "zzzznotfound")).toBe(0);
  });
});

describe("filterTemplates", () => {
  const templates: TemplateRecord[] = [
    rec({ id: "1", key: "a", title: "Fitness A", niche: "fitness", format: "hook", builtin: true, usageCount: 10 }),
    rec({ id: "2", key: "b", title: "Fitness B", niche: "fitness", format: "caption", builtin: true, usageCount: 5 }),
    rec({ id: "3", key: "c", title: "Beauty C", niche: "beauty", format: "hook", builtin: true, usageCount: 20 }),
    rec({ id: "4", key: "d", title: "Custom D", niche: "fitness", format: "hook", builtin: false, workspaceId: "ws-1", usageCount: 50 }),
    rec({ id: "5", key: "e", title: "Other WS E", niche: "fitness", format: "hook", builtin: false, workspaceId: "ws-2", usageCount: 99 }),
  ];

  it("scopes custom templates to own workspace only", () => {
    const out = filterTemplates(templates, { workspaceId: "ws-1" });
    const ids = out.map((t) => t.id);
    expect(ids).toContain("4"); // own custom
    expect(ids).not.toContain("5"); // other workspace
    expect(ids).toContain("1"); // builtins visible
  });

  it("filters by niche and format", () => {
    const out = filterTemplates(templates, { niche: "fitness", format: "hook", workspaceId: "ws-1" });
    expect(out.map((t) => t.id).sort()).toEqual(["1", "4"]);
  });

  it("can exclude builtins", () => {
    const out = filterTemplates(templates, { builtin: false, workspaceId: "ws-1" });
    expect(out.map((t) => t.id)).toEqual(["4"]);
  });

  it("search sorts by relevance and drops zero-score", () => {
    const out = filterTemplates(templates, { q: "Beauty", workspaceId: "ws-1" });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("3");
  });

  it("default sort: builtin first by usage desc, then customs", () => {
    const out = filterTemplates(templates, { workspaceId: "ws-1" });
    expect(out.map((t) => t.id)).toEqual(["3", "1", "2", "4"]);
  });
});

describe("recommendTemplates", () => {
  const templates: TemplateRecord[] = [
    rec({ id: "1", key: "a", niche: "fitness", builtin: true, usageCount: 3 }),
    rec({ id: "2", key: "b", niche: "fitness", builtin: true, usageCount: 9 }),
    rec({ id: "3", key: "c", niche: "fitness", builtin: true, usageCount: 6 }),
    rec({ id: "4", key: "d", niche: "beauty", builtin: true, usageCount: 100 }),
    rec({ id: "5", key: "e", niche: "fitness", builtin: false, workspaceId: "ws-1", usageCount: 1000 }),
  ];

  it("returns only builtin templates of that niche, sorted by usage", () => {
    const out = recommendTemplates(templates, "fitness");
    expect(out.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("respects limit", () => {
    expect(recommendTemplates(templates, "fitness", 2)).toHaveLength(2);
  });

  it("returns empty for niche with no templates", () => {
    expect(recommendTemplates(templates, "travel")).toEqual([]);
  });
});

describe("BUILTIN_TEMPLATES seed sanity", () => {
  it("has at least 20 builtin templates", () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(20);
  });

  it("every template passes validation", () => {
    for (const t of BUILTIN_TEMPLATES) {
      const v = validateTemplate(t);
      expect(v.valid, `${t.key}: ${v.errors.join(", ")}`).toBe(true);
    }
  });

  it("has unique keys", () => {
    const keys = BUILTIN_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses only valid niches and formats", () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(isTemplateNiche(t.niche), t.key).toBe(true);
      expect(isTemplateFormat(t.format), t.key).toBe(true);
    }
  });

  it("covers every niche", () => {
    const niches = new Set(BUILTIN_TEMPLATES.map((t) => t.niche));
    for (const n of TEMPLATE_NICHES) expect(niches.has(n)).toBe(true);
  });

  it("extractVariables finds at least one variable in most templates", () => {
    const withVars = BUILTIN_TEMPLATES.filter((t) => extractVariables(t.body).length > 0);
    expect(withVars.length).toBeGreaterThanOrEqual(BUILTIN_TEMPLATES.length - 2);
  });
});
