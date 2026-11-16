import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyHmacSignature,
  resolveWorkspaceByAccountId,
  resolveWorkspaceByPhoneNumber,
  selectTriggersForEvent,
  extractKeywords,
  renderTemplate,
  extractWhatsAppContext,
  parseInstagramComments,
} from "./webhook-core";

const SECRET = "test-secret";

describe("verifyHmacSignature", () => {
  const payload = JSON.stringify({ object: "instagram", entry: [] });

  it("accepts a valid sha256 signature with prefix", () => {
    const sig = `sha256=${crypto.createHmac("sha256", SECRET).update(payload).digest("hex")}`;
    expect(verifyHmacSignature(payload, sig, SECRET, "sha256")).toBe(true);
  });

  it("accepts a valid sha1 signature (PubSubHubbub)", () => {
    const sig = `sha1=${crypto.createHmac("sha1", SECRET).update(payload).digest("hex")}`;
    expect(verifyHmacSignature(payload, sig, SECRET, "sha1")).toBe(true);
  });

  it("rejects a wrong signature", () => {
    expect(verifyHmacSignature(payload, "sha256=deadbeef", SECRET, "sha256")).toBe(false);
  });

  it("rejects a signature from a different secret", () => {
    const sig = `sha256=${crypto.createHmac("sha256", "other").update(payload).digest("hex")}`;
    expect(verifyHmacSignature(payload, sig, SECRET, "sha256")).toBe(false);
  });

  it("rejects missing signature / secret without throwing", () => {
    expect(verifyHmacSignature(payload, null, SECRET)).toBe(false);
    expect(verifyHmacSignature(payload, "sha256=aa", null)).toBe(false);
    expect(verifyHmacSignature("", "sha256=aa", SECRET)).toBe(false);
  });

  it("rejects length-mismatched signatures without timingSafeEqual throwing", () => {
    expect(verifyHmacSignature(payload, "sha256=short", SECRET)).toBe(false);
    expect(verifyHmacSignature(payload, "sha256=" + "a".repeat(100), SECRET)).toBe(false);
  });
});

describe("resolveWorkspaceByAccountId (Instagram tenant isolation)", () => {
  const conns = [
    { workspaceId: "ws-1", provider: "instagram", accountId: "ig-123", status: "active" },
    { workspaceId: "ws-2", provider: "instagram", accountId: "ig-456", status: "active" },
    { workspaceId: "ws-3", provider: "instagram", accountId: "ig-789", status: "revoked" },
    { workspaceId: "ws-4", provider: "facebook", accountId: "ig-123", status: "active" },
  ];

  it("maps IG business account id to the owning workspace", () => {
    expect(resolveWorkspaceByAccountId(conns, "instagram", "ig-123")).toBe("ws-1");
    expect(resolveWorkspaceByAccountId(conns, "instagram", "ig-456")).toBe("ws-2");
  });

  it("returns null for unknown account (must no-op, not fall back)", () => {
    expect(resolveWorkspaceByAccountId(conns, "instagram", "ig-999")).toBeNull();
    expect(resolveWorkspaceByAccountId(conns, "instagram", null)).toBeNull();
    expect(resolveWorkspaceByAccountId(conns, "instagram", undefined)).toBeNull();
  });

  it("ignores revoked connections and other providers", () => {
    expect(resolveWorkspaceByAccountId(conns, "instagram", "ig-789")).toBeNull();
    // facebook connection with same account id must not match instagram lookup
    expect(resolveWorkspaceByAccountId(conns, "facebook", "ig-123")).toBe("ws-4");
  });
});

describe("resolveWorkspaceByPhoneNumber (WhatsApp tenant isolation)", () => {
  const conns = [
    { workspaceId: "ws-1", provider: "whatsapp", phoneNumberId: "pn-1", status: "active" },
    { workspaceId: "ws-2", provider: "whatsapp", phoneNumberId: "pn-2", status: "active" },
    { workspaceId: "ws-3", provider: "whatsapp", phoneNumberId: null, status: "active" },
  ];

  it("maps phone_number_id to the owning workspace", () => {
    expect(resolveWorkspaceByPhoneNumber(conns, "pn-1")).toBe("ws-1");
    expect(resolveWorkspaceByPhoneNumber(conns, "pn-2")).toBe("ws-2");
  });

  it("returns null for unknown number — NO first-workspace fallback", () => {
    expect(resolveWorkspaceByPhoneNumber(conns, "pn-999")).toBeNull();
    expect(resolveWorkspaceByPhoneNumber(conns, null)).toBeNull();
    expect(resolveWorkspaceByPhoneNumber(conns, "")).toBeNull();
  });
});

describe("selectTriggersForEvent (disabled + cross-tenant isolation)", () => {
  const triggers = [
    { id: "t1", workspaceId: "ws-1", postId: null, enabled: true },
    { id: "t2", workspaceId: "ws-1", postId: "post-a", enabled: true },
    { id: "t3", workspaceId: "ws-1", postId: "post-b", enabled: true },
    { id: "t4", workspaceId: "ws-1", postId: null, enabled: false }, // disabled
    { id: "t5", workspaceId: "ws-2", postId: null, enabled: true }, // other tenant
    { id: "t6", workspaceId: "ws-2", postId: "post-a", enabled: true }, // other tenant
  ];

  it("disabled triggers never fire", () => {
    const selected = selectTriggersForEvent(triggers, { workspaceId: "ws-1", postId: "post-a" });
    expect(selected.map((t) => t.id)).not.toContain("t4");
  });

  it("cross-tenant triggers never fire", () => {
    const selected = selectTriggersForEvent(triggers, { workspaceId: "ws-1", postId: "post-a" });
    expect(selected.map((t) => t.id)).not.toContain("t5");
    expect(selected.map((t) => t.id)).not.toContain("t6");
    expect(selected.every((t) => t.workspaceId === "ws-1")).toBe(true);
  });

  it("post-bound trigger only fires for its post; unbound fires for any", () => {
    const forA = selectTriggersForEvent(triggers, { workspaceId: "ws-1", postId: "post-a" });
    expect(forA.map((t) => t.id).sort()).toEqual(["t1", "t2"]);

    const forB = selectTriggersForEvent(triggers, { workspaceId: "ws-1", postId: "post-b" });
    expect(forB.map((t) => t.id).sort()).toEqual(["t1", "t3"]);
  });

  it("events with no post only fire unbound triggers", () => {
    const none = selectTriggersForEvent(triggers, { workspaceId: "ws-1", postId: null });
    expect(none.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("extractKeywords", () => {
  it("matches exact keywords case-insensitively", () => {
    expect(extractKeywords("Send me the LINK please", ["link"], false)).toBe("link");
    expect(extractKeywords("no match here", ["link"], false)).toBeNull();
  });

  it("semantic mode matches price/link/buy phrases", () => {
    expect(extractKeywords("kitna price hai?", ["link"], true)).toBeTruthy();
    expect(extractKeywords("where to buy this", [], true)).toBe("where to buy");
  });
});

describe("renderTemplate", () => {
  it("replaces known vars", () => {
    expect(renderTemplate("Hi {{name}} → {{link}}", { name: "Rohit", link: "https://x/abc" })).toBe(
      "Hi Rohit → https://x/abc"
    );
  });

  it("renders unknown vars as empty — never a fake placeholder", () => {
    expect(renderTemplate("Buy {{product}} at {{price}}", {})).toBe("Buy  at ");
    expect(renderTemplate("Buy {{product}}", { product: undefined })).toBe("Buy ");
  });
});

describe("extractWhatsAppContext", () => {
  it("extracts phone_number_id and message ids", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "pn-42" },
                messages: [{ id: "wamid.A" }, { id: "wamid.B" }],
                statuses: [{ id: "wamid.C" }],
              },
            },
          ],
        },
      ],
    };
    const ctx = extractWhatsAppContext(payload);
    expect(ctx.phoneNumberId).toBe("pn-42");
    expect(ctx.messageIds).toEqual(["wamid.A", "wamid.B", "wamid.C"]);
  });

  it("tolerates malformed payloads", () => {
    expect(extractWhatsAppContext({})).toEqual({ phoneNumberId: null, messageIds: [] });
    expect(extractWhatsAppContext({ entry: [] })).toEqual({ phoneNumberId: null, messageIds: [] });
  });
});

describe("parseInstagramComments", () => {
  it("parses comment changes with entry id", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "ig-biz-1",
          changes: [
            {
              field: "comments",
              value: {
                id: "c-1",
                text: "price?",
                from: { username: "fan_rohan" },
                media: { id: "m-9" },
              },
            },
          ],
        },
      ],
    };
    expect(parseInstagramComments(payload)).toEqual([
      { entryId: "ig-biz-1", commentId: "c-1", mediaId: "m-9", text: "price?", username: "fan_rohan" },
    ]);
  });

  it("ignores non-instagram objects and non-comment fields", () => {
    expect(parseInstagramComments({ object: "page", entry: [] })).toEqual([]);
    expect(
      parseInstagramComments({
        object: "instagram",
        entry: [{ id: "x", changes: [{ field: "messages", value: { id: "c" } }] }],
      })
    ).toEqual([]);
  });
});
