import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  normalizeEmail,
  sanitizeHandle,
  validateSignup,
} from "@/lib/validators";

describe("validators", () => {
  it("normalizeEmail trims aur lowercase karta hai", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(normalizeEmail(undefined)).toBe("");
  });

  it("isValidEmail sahi format check karta hai", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("bad-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });

  it("validateSignup valid input pe khaali errors deta hai", () => {
    const errors = validateSignup({
      name: "Rohit Sharma",
      email: "rohit@example.com",
      password: "secret123",
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("validateSignup chhote password pe error deta hai", () => {
    const errors = validateSignup({
      name: "Rohit",
      email: "r@e.com",
      password: "short",
    });
    expect(errors.password).toBeDefined();
  });

  it("validateSignup reports both errors for invalid email and short name", () => {
    const errors = validateSignup({
      name: "R",
      email: "not-an-email",
      password: "longenough1",
    });
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it("sanitizeHandle @, spaces aur weird chars hata deta hai", () => {
    expect(sanitizeHandle("@fit with rohit")).toBe("fitwithrohit");
    expect(sanitizeHandle("  tech$guru!! ")).toBe("techguru");
    expect(sanitizeHandle(undefined)).toBe("");
  });
});
