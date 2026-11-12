import { afterEach, describe, expect, it } from "vitest";
import { decideSend, type SendCandidate } from "@/lib/send-rules";
import { checkOutreachAllowed, isGenericAddress, strictOptInCountries } from "@/lib/compliance";
import { checkEmailSyntax } from "@/lib/email-validation";
import { companyKey } from "@/lib/dedup";
import { staticChecks } from "@/lib/config-health";
import { cleanEnrichment } from "@/lib/scraping/pipeline";
import { friendlyApifyError } from "@/lib/apify";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-12T09:00:00Z");

type CandidateOverrides = Partial<Omit<SendCandidate, "prospect">> & { prospect?: Partial<SendCandidate["prospect"]> };

function candidate(overrides: CandidateOverrides = {}): SendCandidate {
  const { prospect, ...rest } = overrides;
  return {
    emailType: "INITIAL",
    approvedAt: new Date("2026-11-11T10:00:00Z"),
    campaignStatus: "ACTIVE",
    suppressed: false,
    contactedByThisCampaign: false,
    minDaysBetweenCampaigns: 30,
    now,
    ...rest,
    prospect: {
      email: "achats@chocolaterie-durand.fr",
      country: "FR",
      status: "NEW",
      prospectType: "COMMERCIAL",
      targetFit: "CORE",
      emailInvalidReason: null,
      lastContactedAt: null,
      ...prospect,
    },
  };
}

describe("decideSend : un email ne part que si tout est réuni", () => {
  it("envoie un email approuvé d'une campagne active", () => {
    expect(decideSend(candidate())).toEqual({ send: true });
  });

  it("retient un email non approuvé (il reste en attente)", () => {
    expect(decideSend(candidate({ approvedAt: null }))).toMatchObject({ send: false, action: "hold" });
  });

  it("retient les emails d'une campagne en pause", () => {
    expect(decideSend(candidate({ campaignStatus: "PAUSED" }))).toMatchObject({ send: false, action: "hold" });
  });

  it("annule pour une adresse en liste d'exclusion, même approuvée", () => {
    expect(decideSend(candidate({ suppressed: true }))).toMatchObject({ send: false, action: "cancel" });
  });

  it.each([
    ["désinscrit", { status: "UNSUBSCRIBED" }],
    ["à ne plus contacter", { status: "COLD" }],
    ["financier", { prospectType: "FINANCIAL" }],
    ["hors cible", { targetFit: "OUT_OF_SCOPE" }],
    ["adresse invalide", { emailInvalidReason: "Le domaine n'existe pas" }],
  ])("annule pour un prospect %s", (_label, prospect) => {
    expect(decideSend(candidate({ prospect }))).toMatchObject({ send: false, action: "cancel" });
  });

  it("retient un premier contact si une autre campagne vient d'écrire au prospect", () => {
    const recent = candidate({ prospect: { lastContactedAt: new Date(now.getTime() - 10 * DAY) } });
    expect(decideSend(recent)).toMatchObject({ send: false, action: "hold" });
    const old = candidate({ prospect: { lastContactedAt: new Date(now.getTime() - 45 * DAY) } });
    expect(decideSend(old)).toEqual({ send: true });
  });

  it("laisse partir une relance de la même campagne malgré un contact récent", () => {
    const followUp = candidate({
      emailType: "FOLLOWUP_1",
      contactedByThisCampaign: true,
      prospect: { lastContactedAt: new Date(now.getTime() - 4 * DAY) },
    });
    expect(decideSend(followUp)).toEqual({ send: true });
  });

  it("pays à accord préalable : adresse générique acceptée pour un premier contact, jamais de relance", () => {
    const generic = { email: "info@kakao-handel.de", country: "DE" };
    expect(decideSend(candidate({ prospect: generic }))).toEqual({ send: true });
    expect(decideSend(candidate({ emailType: "FOLLOWUP_1", contactedByThisCampaign: true, prospect: generic }))).toMatchObject({
      send: false,
      action: "cancel",
    });
  });

  it("pays à accord préalable : adresse nominative refusée", () => {
    expect(decideSend(candidate({ prospect: { email: "hans.mueller@kakao-handel.de", country: "DE" } }))).toMatchObject({
      send: false,
      action: "cancel",
    });
  });
});

describe("compliance", () => {
  afterEach(() => {
    delete process.env.STRICT_OPTIN_COUNTRIES;
  });

  it("reconnaît les adresses génériques d'entreprise", () => {
    for (const email of ["info@x.de", "contact@x.fr", "sales@x.com", "einkauf@x.de", "compras@x.es", "inkoop@x.nl", "export.team@x.be"]) {
      expect(isGenericAddress(email), email).toBe(true);
    }
    for (const email of ["hans.mueller@x.de", "j.dupont@x.fr", "maria@x.es"]) {
      expect(isGenericAddress(email), email).toBe(false);
    }
  });

  it("n'applique la règle stricte qu'aux pays listés", () => {
    expect(checkOutreachAllowed("j.dupont@x.fr", "FR")).toEqual({ allowed: true, strict: false });
    expect(checkOutreachAllowed("jan@x.nl", "NL").allowed).toBe(false);
    expect(checkOutreachAllowed("info@x.nl", "NL")).toEqual({ allowed: true, strict: true });
  });

  it("lit la liste des pays depuis STRICT_OPTIN_COUNTRIES", () => {
    process.env.STRICT_OPTIN_COUNTRIES = "it, AT";
    expect(strictOptInCountries()).toEqual(["IT", "AT"]);
    expect(checkOutreachAllowed("hans@x.de", "DE").allowed).toBe(true);
    expect(checkOutreachAllowed("luca@x.it", "IT").allowed).toBe(false);
  });
});

describe("checkEmailSyntax", () => {
  it("accepte une adresse professionnelle normale", () => {
    expect(checkEmailSyntax("Achats@Chocolaterie-Durand.fr")).toEqual({ valid: true });
  });

  it.each(["pas-une-adresse", "a@b", "double..point@x.fr", "info@example.com", "noreply@x.fr", "logo@2x.png", "x@yopmail.com"])(
    "rejette %s",
    (email) => {
      expect(checkEmailSyntax(email).valid).toBe(false);
    }
  );
});

describe("companyKey : un seul contact par entreprise", () => {
  it("utilise le domaine du site quand il est propre à l'entreprise", () => {
    expect(companyKey({ website: "https://www.Durand-Chocolat.fr/contact", email: "x@gmail.com" })).toBe("durand-chocolat.fr");
  });

  it("se rabat sur le domaine de l'adresse si le site est une page de réseau social", () => {
    expect(companyKey({ website: "https://facebook.com/durand", email: "info@durand-chocolat.fr" })).toBe("durand-chocolat.fr");
  });

  it("ne regroupe pas les webmails", () => {
    expect(companyKey({ website: null, email: "durand@gmail.com" })).toBeNull();
  });
});

describe("staticChecks : configuration bloquante", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  const blockers = (address?: string) =>
    staticChecks({ companyAddress: address })
      .filter((c) => c.blocking && c.status === "error")
      .map((c) => c.id);

  it("bloque sur une adresse locale, un secret absent et une adresse postale absente", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "commercial@ste-scpb.com";
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    delete process.env.UNSUBSCRIBE_SECRET;
    delete process.env.COMPANY_ADDRESS;
    expect(blockers()).toEqual(["app_url", "unsubscribe_secret", "postal_address"]);
  });

  it("ne bloque plus quand tout est renseigné", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "commercial@ste-scpb.com";
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    process.env.NEXT_PUBLIC_APP_URL = "https://commercial-ai.ste-scpb.com";
    process.env.UNSUBSCRIBE_SECRET = "0123456789abcdef0123456789abcdef";
    expect(blockers("BP 1234, Douala, Cameroun")).toEqual([]);
  });
});

describe("recherche de prospects", () => {
  it("nettoie et dédoublonne les emails renvoyés par Apify", () => {
    const cleaned = cleanEnrichment({
      "durand-chocolat.fr": ["Info@Durand-Chocolat.fr", "info@durand-chocolat.fr", "pas une adresse"],
      "vide.fr": ["rien"],
    });
    expect(cleaned["durand-chocolat.fr"]).toEqual(["info@durand-chocolat.fr"]);
    expect(cleaned["vide.fr"]).toBeUndefined();
  });

  it("traduit les erreurs Apify courantes", () => {
    expect(friendlyApifyError("Monthly usage hard limit exceeded")).toMatch(/Quota mensuel Apify/);
    expect(friendlyApifyError("By launching this job you will exceed the memory limit of 8192MB")).toMatch(/mémoire/);
    expect(friendlyApifyError("Autre erreur")).toBe("Autre erreur");
  });
});
