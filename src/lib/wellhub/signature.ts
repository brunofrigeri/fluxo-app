import { createHmac, timingSafeEqual } from "node:crypto";

/** Wellhub signs the raw request body with HMAC-SHA1 and sends it upper-case in `X-Gympass-Signature`. */
export const SIGNATURE_HEADER = "x-gympass-signature";

export function sign(rawBody: string, secret: string): string {
  return createHmac("sha1", secret).update(rawBody, "utf8").digest("hex").toUpperCase();
}

/**
 * True when `header` is the signature of `rawBody` under `secret`. Pass the body exactly as it
 * arrived: re-serialising parsed JSON changes the bytes. Wellhub's docs show a `0X` prefix on the
 * value in the example, so both forms are accepted.
 */
export function verifySignature(rawBody: string, secret: string, header: string | null | undefined): boolean {
  if (!header || !secret) return false;
  const given = header.trim().toUpperCase().replace(/^0X/, "");
  const expected = sign(rawBody, secret);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
