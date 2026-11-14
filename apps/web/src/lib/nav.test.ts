import { describe, expect, it } from "vitest";
import { ALL_NAV, MAIN_NAV, BOTTOM_NAV, findNavItem } from "@/lib/nav";

describe("nav config", () => {
  it("sidebar has 10 main modules + 3 bottom items", () => {
    expect(MAIN_NAV).toHaveLength(10);
    expect(BOTTOM_NAV).toHaveLength(3);
    expect(ALL_NAV).toHaveLength(13);
  });

  it("har item ka unique href + index hai", () => {
    const hrefs = ALL_NAV.map((n) => n.href);
    const indexes = ALL_NAV.map((n) => n.index);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it("findNavItem href se sahi module dhoondhta hai", () => {
    expect(findNavItem("/dashboard/dm-inbox")?.module).toBe("DM Sales Engine");
    expect(findNavItem("/dashboard/nope")).toBeUndefined();
  });

  it("overview ke alawa har module ka phase badge defined hai", () => {
    for (const item of ALL_NAV) {
      expect(item.phase).toBeTruthy();
      expect(item.bullets.length).toBeGreaterThan(0);
    }
  });
});
