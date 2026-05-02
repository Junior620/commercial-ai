import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type EmailGenerationMission =
  | "COMMODITY_SALES"
  | "STARTUP_FUNDING_PARTNER";

interface GenerateEmailParams {
  prospectName: string;
  companyName: string;
  country: string;
  sector: string;
  product: string;
  prospectType?: "COMMERCIAL" | "FINANCIAL";
  financialCategory?: string | null;
  language: string;
  tone: "FORMAL" | "FRIENDLY" | "TECHNICAL" | "PREMIUM";
  campaignProduct: string;
  /** Campagnes fin. : demande exploratoire financement / partenariat institutionnel */
  emailMission?: EmailGenerationMission;
  senderName?: string;
  senderCompany?: string;
  customInstructions?: string;
}

interface GeneratedEmail {
  subject: string;
  body: string;
}

type ClassificationResult = {
  classification: string;
  suggestedReply: string;
};

function getSenderInfo() {
  return {
    name: process.env.SENDER_NAME?.trim() || "The Team",
    position: process.env.SENDER_POSITION?.trim() || "",
    company: process.env.SENDER_COMPANY?.trim() || "Our Company",
    phone: process.env.SENDER_PHONE?.trim() || "",
    website: process.env.SENDER_WEBSITE?.trim() || "",
  };
}

const TONE_MAP: Record<string, string> = {
  FORMAL: "formel et professionnel",
  FRIENDLY: "amical et chaleureux, tout en restant professionnel",
  TECHNICAL: "technique et precis, oriente specifications produit",
  PREMIUM: "premium et exclusif, ton haut de gamme",
};

const TONE_SALES_PLAYBOOK: Record<
  GenerateEmailParams["tone"],
  string
> = {
  FORMAL:
    "Structure claire (probleme -> solution -> preuve -> CTA). Mettre l'accent sur fiabilite, conformite et execution.",
  FRIENDLY:
    "Voix humaine et relationnelle. Montrer une comprehension du contexte client, puis proposer une prochaine etape simple.",
  TECHNICAL:
    "Etre concret: specs, qualite, process, stabilite d'approvisionnement, certifications et usages applicatifs.",
  PREMIUM:
    "Positionnement valeur: qualite superieure, constance, service personnalise, exclusivite. Rester sobre et credible.",
};

const LANG_MAP: Record<string, string> = {
  fr: "francais",
  en: "anglais",
  es: "espagnol",
  pt: "portugais",
  de: "allemand",
  ar: "arabe",
};

function normalizeLanguageCode(input: string | null | undefined): string {
  const raw = (input || "").trim().toLowerCase().replace("_", "-");
  if (!raw) return "en";
  if (raw === "auto") return "en";
  if (
    raw === "fr" ||
    raw.startsWith("fr-") ||
    raw === "french" ||
    raw === "francais" ||
    raw === "français"
  ) {
    return "fr";
  }
  if (raw === "en" || raw.startsWith("en-") || raw === "english") return "en";
  if (raw === "es" || raw.startsWith("es-") || raw === "spanish") return "es";
  if (raw === "pt" || raw.startsWith("pt-") || raw === "portuguese") return "pt";
  if (raw === "de" || raw.startsWith("de-") || raw === "german") return "de";
  if (raw === "ar" || raw.startsWith("ar-") || raw === "arabic") return "ar";
  return raw.slice(0, 2);
}

function getSalutationInstructions(langCode: string): string {
  switch (langCode) {
    case "fr":
      return `8. Salutation uniquement en francais (ex : "Bonjour [prenom ou nom]," "Bonjour Madame, Bonjour Monsieur,"). INTERDIT : "Dear", "Hi", toute formulation anglophone dans l ouverture.`;
    case "es":
      return `8. Saludo solo en español (ej: "Estimado/a …," "Hola …,"). PROHIBIDO usar "Dear".`;
    case "pt":
      return `8. Saudacao apenas em portugues (ex: "Olá …," "Prezado/a …"). Nao usar "Dear".`;
    case "de":
      return `8. Ansprache nur auf Deutsch (z. B. "Guten Tag …," "Sehr geehrte …"). Kein "Dear".`;
    case "ar":
      return `8. Ouverture en arabe moderne standard, ton professionnel. Pas d ouverture en anglais.`;
    default:
      return `8. Commence par "Dear [nom du contact]," ou "Dear [nom entreprise] Team," PAS "Dear Sir/Madam".`;
  }
}

const FINANCIAL_CATEGORY_GUIDANCE: Record<string, string> = {
  bank:
    "Angle banque/trade finance: fiabilite d'execution, couverture documentaire, securisation des flux import/export.",
  dfi:
    "Angle DFI/multilateral: impact developpement, inclusion des producteurs, conformite et gouvernance.",
  impact_fund:
    "Angle impact fund: impact mesurable ESG, traçabilite, resilience climatique, performance durable.",
  commodity_fund:
    "Angle commodity fund/hedge: gestion de volatilite, securisation d'approvisionnement, discipline risque/prix.",
  corporate:
    "Angle corporate strategique: partenariat long terme, qualite constante, capacite industrielle, execution multi-pays.",
  vc_pe:
    "Angle VC/PE: scalabilite, traction commerciale, efficience operationnelle, feuille de route de croissance.",
  family_office:
    "Angle family office/angels: horizon long terme, capital patient, gouvernance et impact terrain.",
  agency:
    "Angle agences/programmes: alignement avec programmes publics, conformite, capacite de deploiement local.",
};

const SYSTEM_PROMPT_COMMODITY =
  "Tu es un expert en prospection commerciale B2B dans les secteurs du cacao et du cafe (beurre/poudre/masse/feves de cacao, grains/cafe vert/moulu/soluble). Tu reponds UNIQUEMENT en JSON valide, sans texte avant ni apres.";

const SYSTEM_PROMPT_STARTUP_FUNDING =
  "Tu es un expert en relations investisseurs et partenariats financiers B2B (banques trade finance DFI fonds impact commodity finance VC institutional). Tu rediges une sollicitation professionnelle pour une startup projet dans la chaine valeur agricole durable cacao cafe. Jamais comme un vulgaire email de vente de marchandises. Tu reponds UNIQUEMENT en JSON valide, sans texte avant ni apres.";

function fundingPitchFromEnv(): string {
  const one = process.env.FUNDING_PITCH_SUMMARY?.trim();
  if (one) return one;
  return "Projet/industrial venture dans la chaine de valeur cacao et cafe (origine tractabilite developpement fournisseur) en phase de structuration ou de croissance cherchant dialogue avec financements institutions strategiques adaptes.";
}

// ─── Lazy singleton clients ──────────────────────────────────────

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;

function getAnthropicClient(): Anthropic | null {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

function getOpenAIClient(): OpenAI | null {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

// ─── Provider helpers ────────────────────────────────────────────

const anthropicModel =
  process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.4";

async function runWithAnthropic(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const client = getAnthropicClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY is not set");

  const message = await client.messages.create({
    model: anthropicModel,
    max_tokens: 1024,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Unexpected Anthropic response type");
  }
  return block.text;
}

async function runWithOpenAI(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY is not set");

  const completion = await client.chat.completions.create({
    model: openaiModel,
    max_completion_tokens: 1024,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");
  return content;
}

// ─── Fallback orchestrator ───────────────────────────────────────

async function runLLM(
  prompt: string,
  systemPrompt: string = SYSTEM_PROMPT_COMMODITY
): Promise<string> {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.trim();

  if (!hasAnthropic && !hasOpenAI) {
    throw new Error(
      "Aucune cle IA configuree. Definissez ANTHROPIC_API_KEY ou OPENAI_API_KEY."
    );
  }

  if (hasAnthropic) {
    try {
      return await runWithAnthropic(prompt, systemPrompt);
    } catch (err) {
      if (!hasOpenAI) throw err;
      console.warn(
        "[AI] Anthropic failed, falling back to OpenAI:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return await runWithOpenAI(prompt, systemPrompt);
}

// ─── JSON parsing ────────────────────────────────────────────────

function parseJson<T>(raw: string): T {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not extract JSON from AI response");
  return JSON.parse(match[0]) as T;
}

function sanitizeGeneratedBody(body: string): string {
  // Supprime les placeholders type [Your Name], [Your Company], etc.
  let cleaned = body
    .replace(/\[?\s*your\s*name\s*\]?/gi, "")
    .replace(/\[?\s*your\s*company\s*\]?/gi, "")
    .replace(/\[?\s*your\s*email\s*\]?/gi, "")
    .replace(/\[?\s*your\s*phone(?:\s*number)?\s*\]?/gi, "")
    .replace(/\[?\s*company\s*name\s*\]?/gi, "")
    .replace(/\[?\s*email\s*address\s*\]?/gi, "")
    .replace(/\[?\s*phone\s*number\s*\]?/gi, "");

  // Supprime les signatures textuelles car la signature HTML est ajoutee automatiquement.
  cleaned = cleaned.replace(
    /\b(?:kind regards|best regards|regards|cordialement|sincerely)\b[\s\S]*$/i,
    ""
  );

  // Nettoyage des lignes vides multiples.
  cleaned = cleaned
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, idx, arr) => {
      if (line.trim() !== "") return true;
      return idx > 0 && arr[idx - 1].trim() !== "";
    })
    .join("\n")
    .trim();

  return cleaned;
}

// ─── Public API ──────────────────────────────────────────────────

export async function generateEmail(
  params: GenerateEmailParams
): Promise<GeneratedEmail> {
  const mission = params.emailMission ?? "COMMODITY_SALES";
  const tonDesc = TONE_MAP[params.tone] || TONE_MAP.FORMAL;
  const tonePlaybook = TONE_SALES_PLAYBOOK[params.tone] || TONE_SALES_PLAYBOOK.FORMAL;
  const langCode = normalizeLanguageCode(params.language);
  const langDesc = LANG_MAP[langCode] || langCode;
  const prospectType = params.prospectType || "COMMERCIAL";
  const financialCategory = params.financialCategory?.trim() || "";
  const financialGuidance =
    prospectType === "FINANCIAL"
      ? FINANCIAL_CATEGORY_GUIDANCE[financialCategory] ||
        "Angle finance B2B: fiabilite, conformite, gestion du risque, impact et execution."
      : "";
  const financialRulesBlock =
    prospectType === "FINANCIAL"
      ? `\nREGLES SPECIFIQUES PROSPECT FINANCIER :
FIN-1. Le prospect est financier. Adapte le discours au type d'institution: ${financialCategory || "non precise"}.
FIN-2. Mets en avant des elements attendus par un acteur financier: gestion du risque, conformite, traçabilite, stabilite d'approvisionnement et gouvernance.
FIN-3. Evite le discours purement "achat produit". Parle en termes de partenariat, mitigation du risque et creation de valeur durable.
FIN-4. ${financialGuidance}`
      : "";
  const sender = getSenderInfo();

  const senderName = params.senderName || sender.name;
  const senderCompany = params.senderCompany || sender.company;
  const senderPosition = sender.position;

  const langBlock =
    langCode === "fr"
      ? `LANGUE IMPERATIVE (priorite maximale) : email 100% en francais (objet + corps).\nPas d anglais hors noms propres, marques ou sigles (IFC, DFI…).\n\n`
      : `LANGUE IMPERATIVE (priorite maximale) : ecris l integralite de "subject" et "body" en ${langDesc} (code ISO ${langCode}), sans melange avec d autres langues (sauf noms propres / sigles).\n\n`;

  const fundingPitch = fundingPitchFromEnv();
  const institutionalAngle =
    financialGuidance ||
    "Adapte la demande au mandat probable de l institution (financement structuration partenariat programmes impact trade finance).";
  const fundingPartnerBlock = `\nREGLES SPECIFIQUES FINANCEMENT / PARTENARIAT INSTITUTIONNEL :
FP-1. Objectif : obtenir un premier echange professionnel (partenariat strategique et/ou financement) entre ${senderCompany} et l institution cible. Ce n est PAS un email pour vendre des lots de matieres premieres.
FP-2. Contexte projet (synthese a respecter, tu peux la reformuler) : ${fundingPitch}
FP-3. Adapte le ton et les formulations au mandat probable du destinataire (${financialCategory || "institution financiere"}). ${institutionalAngle}
FP-4. Propose un chemin concret : echange court (15-20 min) et/ou envoi d un teaser ou deck synthétique ; mentionne la confidentialite si pertinent. Ne demande pas "de l argent" de facon maladroite : cadre exploration alignment mandat.
FP-5. Honnetete : n invente AUCUN chiffre (CA, valorisation, serie, volumes) ; dis plutot que les elements detailles peuvent etre partages apres alignment.
FP-6. Reste sobre et credible (gouvernance, risque, impact, conformite, chaine d approvisionnement durable le cas echeant).`;

  let systemPrompt = SYSTEM_PROMPT_COMMODITY;
  let prompt: string;

  if (mission === "STARTUP_FUNDING_PARTNER") {
    systemPrompt = SYSTEM_PROMPT_STARTUP_FUNDING;
    prompt = `Redige un email de premiere prise de contact institutionnelle (financement / partenariat) avec ces parametres :

${langBlock}DESTINATAIRE / INSTITUTION :
- Interlocuteur : ${params.prospectName}
- Organisation : ${params.companyName}
- Pays : ${params.country}
- Secteur / activite percue : ${params.sector || "non specifie"}
- Categorie (si connue) : ${financialCategory || "non specifiee"}

NOTRE COTE (expediteur) :
- Nom : ${senderName}
- Poste : ${senderPosition}
- Structure : ${senderCompany}

PARAMETRES DE REDACTION :
- Ton : ${tonDesc}
- Guideline : ${tonePlaybook}
- Langue : ${langDesc}
${params.customInstructions ? `- Instructions supplementaires : ${params.customInstructions}` : ""}

REGLES STRICTES :
1. Email naturel, professionnel, jamais marketing agressif ni discours fournisseur purement commercial.
2. Accroche liee au role de l institution (mandat, impact, trade finance, risque, programme, etc.), pas un template generique.
3. Le corps : 120-180 mots maximum.
4. Objet : max 50 caracteres, specifique, evite les cliches type "Partnership Opportunity".
5. Pas de placeholders type [Your Name]. Pas de formule de signature finale (ajoutee par l app).
${getSalutationInstructions(langCode)}
7. Repete le nom de l organisation du destinataire au plus 2 fois.
8. Structure : contexte bref -> pourquoi cette institution -> proposition d etape utile (appel / document) -> CTA unique.
9. Evite tirets cadratins (—), idealement zero.
10. Respecte STRICTEMENT la langue (${langCode}).
${fundingPartnerBlock}

FORMAT DE REPONSE (JSON uniquement) :
{
  "subject": "objet court et accrocheur",
  "body": "corps du mail SANS signature finale"
}`;
  } else {
    prompt = `Genere un email de prospection commerciale B2B avec ces parametres :

${langBlock}DESTINATAIRE :
- Nom du contact : ${params.prospectName}
- Entreprise : ${params.companyName}
- Pays : ${params.country}
- Secteur : ${params.sector || "non specifie"}
- Produit d'interet : ${params.product || "non specifie"}
- Type de prospect : ${prospectType}
- Categorie financiere : ${financialCategory || "non specifiee"}

EXPEDITEUR :
- Nom : ${senderName}
- Poste : ${senderPosition}
- Entreprise : ${senderCompany}

CAMPAGNE :
- Produit a promouvoir : ${params.campaignProduct}
- Ton : ${tonDesc}
- Guideline ton commercial : ${tonePlaybook}
- Langue : ${langDesc}
${params.customInstructions ? `- Instructions specifiques : ${params.customInstructions}` : ""}

REGLES STRICTES :
1. L'email doit paraitre 100% naturel, comme ecrit par un humain. Pas de langage robotique.
2. Personnalise l'email selon le profil du prospect (son secteur, ses produits, son pays).
3. L'accroche doit etre engageante et specifique au prospect, PAS generique.
4. Inclus un appel a l'action clair et precis (appel, envoi de specs, etc.)
5. Le corps fait 120-180 mots maximum — concis et impactant.
6. L'objet doit etre accrocheur, specifique et court (max 50 caracteres). PAS de "Partnership Opportunity" ou cliches generiques.
7. NE METS JAMAIS de placeholders comme [Your Name], [Company], [Phone Number], [Position], etc. La signature sera ajoutee automatiquement. Termine le corps AVANT la signature (pas de "Best regards," ni de nom a la fin).
${getSalutationInstructions(langCode)}
9. Ne repete pas le nom de l'entreprise du prospect plus de 2 fois dans le mail.
10. Mentionne des avantages concrets : qualite constante, livraison fiable, prix competitifs, certifications, etc.
11. Style commercial obligatoire :
   - 1 phrase d'accroche specifique au prospect
   - 2-3 arguments de valeur MAX, orientes resultat business
   - 1 preuve de credibilite (ex: qualite, capacite, process, certif)
   - 1 CTA unique, direct et facile a accepter (ex: "15 min cette semaine ?")
12. Evite les longues listes et le jargon inutile. Priorite a la clarte et a la conversion.
13. Evite les tirets cadratins (—) et les parenthesees trop techniques. Prefere des phrases naturelles, fluides et conversationnelles.
14. N'utilise jamais plus d'un tiret cadratin (—) dans tout le corps du mail. Idealement, zero.
15. Respecte STRICTEMENT la langue demandee (${langCode}). L'objet et le corps doivent etre entierement dans cette langue, sans melange.
${financialRulesBlock}

FORMAT DE REPONSE (JSON uniquement) :
{
  "subject": "objet court et accrocheur",
  "body": "corps du mail SANS signature finale"
}`;
  }

  const raw = await runLLM(prompt, systemPrompt);
  const parsed = parseJson<GeneratedEmail>(raw);
  return {
    subject: parsed.subject?.trim() || "",
    body: sanitizeGeneratedBody(parsed.body || ""),
  };
}

export async function generateFollowUp(
  originalSubject: string,
  originalBody: string,
  followUpNumber: number,
  prospectName: string,
  language: string,
  tone: "FORMAL" | "FRIENDLY" | "TECHNICAL" | "PREMIUM"
): Promise<GeneratedEmail> {
  const tonDesc = TONE_MAP[tone] || TONE_MAP.FORMAL;
  const tonePlaybook = TONE_SALES_PLAYBOOK[tone] || TONE_SALES_PLAYBOOK.FORMAL;
  const langCode = normalizeLanguageCode(language);
  const langDesc = LANG_MAP[langCode] || langCode;
  const sender = getSenderInfo();

  const prompt = `Voici l'email initial envoye :
Objet: ${originalSubject}
Corps: ${originalBody}

Genere la relance numero ${followUpNumber} pour ${prospectName}.
- Expediteur : ${sender.name}, ${sender.position} chez ${sender.company}
- Ton : ${tonDesc}
- Guideline ton commercial : ${tonePlaybook}
- Langue : ${langDesc}

REGLES STRICTES :
1. Change completement l'angle d'approche par rapport au mail precedent
2. Reste bref (80-120 mots max)
3. Ne sois pas insistant, reste courtois et professionnel
4. Ajoute une nouvelle proposition de valeur ou un angle different
5. L'objet doit etre court et different du precedent (pas de "Following up" ou "Just checking in")
6. NE METS JAMAIS de placeholders comme [Your Name], [Company], etc. La signature sera ajoutee automatiquement.
7. Termine le corps AVANT la signature.
8. Commence par "Dear ${prospectName}," ou "Hi ${prospectName},"
9. Evite les tirets cadratins (—) et garde un style naturel, simple et humain.
10. N'utilise jamais plus d'un tiret cadratin (—) dans tout le corps du mail. Idealement, zero.
11. Respecte STRICTEMENT la langue demandee (${langCode}). L'objet et le corps doivent etre entierement dans cette langue, sans melange.

FORMAT DE REPONSE (JSON uniquement) :
{
  "subject": "objet court",
  "body": "corps du mail de relance SANS signature"
}`;

  const raw = await runLLM(prompt);
  const parsed = parseJson<GeneratedEmail>(raw);
  return {
    subject: parsed.subject?.trim() || "",
    body: sanitizeGeneratedBody(parsed.body || ""),
  };
}

export async function classifyResponse(
  responseContent: string,
  originalEmailSubject: string
): Promise<ClassificationResult> {
  const prompt = `Analyse cette reponse a un email commercial B2B (secteur cacao) :

Email original (objet) : ${originalEmailSubject}
Reponse recue : ${responseContent}

Classifie la reponse parmi ces categories :
- POSITIVE : interesse, veut continuer la discussion
- INFO_REQUEST : demande d'informations supplementaires
- PRICE_REQUEST : demande de prix ou devis
- MEETING_REQUEST : demande de rendez-vous ou appel
- NEGATIVE : refus poli
- NO_INTEREST : pas interesse du tout
- UNSUBSCRIBE : demande de desabonnement
- UNKNOWN : inclassable

Propose aussi un brouillon de reponse adapte.

Reponds UNIQUEMENT au format JSON :
{
  "classification": "LA_CATEGORIE",
  "suggestedReply": "le brouillon de reponse"
}`;

  const raw = await runLLM(prompt);
  return parseJson<ClassificationResult>(raw);
}
