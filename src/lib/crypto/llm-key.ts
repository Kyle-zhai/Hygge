import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const secret = process.env.LLM_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "LLM_KEY_ENCRYPTION_SECRET is missing or too short (need ≥16 chars)",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptLLMKey(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, encrypted]);
  return PREFIX + combined.toString("base64");
}

export function decryptLLMKey(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  if (!isEncrypted(ciphertext)) return ciphertext; // plaintext legacy row
  const key = getKey();
  const payload = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const data = payload.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
