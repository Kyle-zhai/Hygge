// URL-safe 8-char referral code. Excludes ambiguous chars (0/O, 1/I/l).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function isValidReferralCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Z2-9]{8}$/.test(code);
}
