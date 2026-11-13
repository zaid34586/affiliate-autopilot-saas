/**
 * Pure validation helpers — used by both server actions and client code.
 * That is why this file is not in "use server" (tests also run against it).
 */

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Signup errors — khaali object matlab valid. */
export function validateSignup(input: {
  name: unknown;
  email: unknown;
  password: unknown;
}): { name?: string[]; email?: string[]; password?: string[] } {
  const errors: { name?: string[]; email?: string[]; password?: string[] } = {};
  const name = String(input.name ?? "").trim();
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");

  if (name.length < 2) errors.name = ["Name kam se kam 2 characters ka ho"];
  if (!isValidEmail(email)) errors.email = ["Enter a valid email address"];
  if (password.length < 8)
    errors.password = ["Password kam se kam 8 characters ka ho"];

  return errors;
}

/** Handle → character naam: @, spaces, weird chars hatao. */
export function sanitizeHandle(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^\w.\-]/g, "")
    .slice(0, 40);
}
