import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("UNSUBSCRIBE_SECRET doit être défini en production");
  }
  return "dev-only-unsubscribe-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** Jeton signé (non devinable) identifiant l'adresse à désinscrire. */
export function createUnsubscribeToken(email: string): string {
  const payload = Buffer.from(email.trim().toLowerCase()).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Renvoie l'email si le jeton est valide, sinon null. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const email = Buffer.from(payload, "base64url").toString("utf8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

export function unsubscribeUrl(email: string): string {
  return `${getAppUrl()}/unsubscribe?t=${encodeURIComponent(createUnsubscribeToken(email))}`;
}

/** URL one-click (RFC 8058) appelée en POST par Gmail / Yahoo. */
export function oneClickUnsubscribeUrl(email: string): string {
  return `${getAppUrl()}/api/unsubscribe?t=${encodeURIComponent(createUnsubscribeToken(email))}`;
}
