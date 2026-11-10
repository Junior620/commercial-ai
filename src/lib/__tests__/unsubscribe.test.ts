import { describe, expect, it } from "vitest";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/unsubscribe";

describe("jeton de désinscription", () => {
  it("vérifie un jeton valide", () => {
    const token = createUnsubscribeToken("Buyer@Example.com");
    expect(verifyUnsubscribeToken(token)).toBe("buyer@example.com");
  });

  it("refuse un jeton modifié", () => {
    const token = createUnsubscribeToken("buyer@example.com");
    const [, sig] = token.split(".");
    const forged = `${Buffer.from("victim@example.com").toString("base64url")}.${sig}`;
    expect(verifyUnsubscribeToken(forged)).toBeNull();
    expect(verifyUnsubscribeToken("n'importe quoi")).toBeNull();
    expect(verifyUnsubscribeToken(null)).toBeNull();
  });
});
