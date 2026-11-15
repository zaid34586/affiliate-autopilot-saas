/**
 * Phase 7 — Status Page Core Tests
 */

import { describe, it, expect } from "vitest";
import {
  deriveStatus,
  computeUptime,
  rollingUptime,
  overallStatus,
  isValidIncidentTransition,
  incidentDurationMs,
  formatDuration,
  severityRank,
  classifyLatency,
  STATUS_PROVIDERS,
} from "./status-core";

describe("deriveStatus", () => {
  it("returns unknown with no checks", () => {
    expect(deriveStatus([], 100)).toBe("unknown");
  });

  it("returns operational when all pass and uptime healthy", () => {
    expect(deriveStatus([true, true, true], 100)).toBe("operational");
    expect(deriveStatus([true, true, true], 99.5)).toBe("operational");
  });

  it("returns degraded on partial failures", () => {
    expect(deriveStatus([true, false, true], 100)).toBe("degraded");
  });

  it("returns degraded when uptime below 99%", () => {
    expect(deriveStatus([true, true], 98)).toBe("degraded");
  });

  it("returns down when all checks fail", () => {
    expect(deriveStatus([false, false, false], 95)).toBe("down");
  });
});

describe("computeUptime", () => {
  it("computes percentage", () => {
    expect(computeUptime(99, 100)).toBe(99);
    expect(computeUptime(100, 100)).toBe(100);
    expect(computeUptime(1, 3)).toBe(33.33);
  });

  it("returns 100 with no checks", () => {
    expect(computeUptime(0, 0)).toBe(100);
  });
});

describe("rollingUptime", () => {
  it("increments counters and recomputes uptime", () => {
    const r1 = rollingUptime(0, 0, true);
    expect(r1).toEqual({ ok: 1, total: 1, uptime: 100 });

    const r2 = rollingUptime(9, 10, false);
    expect(r2.ok).toBe(9);
    expect(r2.total).toBe(11);
    expect(r2.uptime).toBe(81.82);
  });
});

describe("overallStatus", () => {
  it("returns operational when everything is fine", () => {
    expect(overallStatus(["operational", "operational", "operational"])).toBe("operational");
  });

  it("returns outage when any provider is down", () => {
    expect(overallStatus(["operational", "down"])).toBe("outage");
  });

  it("returns degraded when any provider is degraded", () => {
    expect(overallStatus(["operational", "degraded"])).toBe("degraded");
  });

  it("returns maintenance when all are maintenance", () => {
    expect(overallStatus(["maintenance", "maintenance"])).toBe("maintenance");
  });

  it("outage takes precedence over degraded", () => {
    expect(overallStatus(["degraded", "down"])).toBe("outage");
  });

  it("returns operational for empty list", () => {
    expect(overallStatus([])).toBe("operational");
  });
});

describe("isValidIncidentTransition", () => {
  it("allows valid forward transitions", () => {
    expect(isValidIncidentTransition("investigating", "identified")).toBe(true);
    expect(isValidIncidentTransition("investigating", "monitoring")).toBe(true);
    expect(isValidIncidentTransition("investigating", "resolved")).toBe(true);
    expect(isValidIncidentTransition("identified", "resolved")).toBe(true);
    expect(isValidIncidentTransition("monitoring", "resolved")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(isValidIncidentTransition("resolved", "identified")).toBe(false);
    expect(isValidIncidentTransition("resolved", "monitoring")).toBe(false);
    expect(isValidIncidentTransition("identified", "investigating")).toBe(false);
  });

  it("allows reopening a resolved incident", () => {
    expect(isValidIncidentTransition("resolved", "investigating")).toBe(true);
  });
});

describe("incidentDurationMs / formatDuration", () => {
  it("uses resolvedAt when present", () => {
    const start = new Date("2026-11-15T10:00:00Z");
    const end = new Date("2026-11-15T11:30:00Z");
    expect(incidentDurationMs({ startedAt: start, resolvedAt: end })).toBe(90 * 60 * 1000);
  });

  it("formats minutes, hours, days", () => {
    expect(formatDuration(30 * 60 * 1000)).toBe("30m");
    expect(formatDuration(90 * 60 * 1000)).toBe("1h 30m");
    expect(formatDuration(50 * 60 * 60 * 1000)).toBe("2d 2h");
  });

  it("never returns negative", () => {
    const start = new Date("2026-11-15T12:00:00Z");
    const end = new Date("2026-11-15T10:00:00Z");
    expect(incidentDurationMs({ startedAt: start, resolvedAt: end })).toBe(0);
  });
});

describe("severityRank", () => {
  it("orders critical first", () => {
    expect(severityRank("critical")).toBe(0);
    expect(severityRank("major")).toBe(1);
    expect(severityRank("minor")).toBe(2);
  });
});

describe("classifyLatency", () => {
  it("classifies bands", () => {
    expect(classifyLatency(100)).toBe("good");
    expect(classifyLatency(500)).toBe("fair");
    expect(classifyLatency(2000)).toBe("slow");
    expect(classifyLatency(null)).toBe("unknown");
  });
});

describe("STATUS_PROVIDERS", () => {
  it("has unique providers with display names", () => {
    const keys = STATUS_PROVIDERS.map((p) => p.provider);
    expect(new Set(keys).size).toBe(keys.length);
    expect(STATUS_PROVIDERS.every((p) => p.displayName.length > 0)).toBe(true);
  });

  it("covers core integrations from roadmap (IG, TikTok, Veo)", () => {
    const keys = new Set(STATUS_PROVIDERS.map((p) => p.provider));
    expect(keys.has("instagram")).toBe(true);
    expect(keys.has("tiktok")).toBe(true);
    expect(keys.has("veo")).toBe(true);
  });
});
