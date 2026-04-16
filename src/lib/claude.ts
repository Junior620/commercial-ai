import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

interface GenerateEmailParams {
  prospectName: string;
  companyName: string;
  country: string;
  sector: string;
  product: string;
  language: string;
  tone: "FORMAL" | "FRIENDLY" | "TECHNICAL" | "PREMIUM";
  campaignProduct: string;
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

const LANG_MAP: Record<string, string> = {
  fr: "francais",
  en: "anglais",
  es: "espagnol",
  pt: "portugais",
  de: "allemand",
  ar: "arabe",
};

const SYSTEM_PROMPT =
  "Tu es un expert en prospection commerciale B2B dans le secteur du cacao et de ses derives (beurre de cacao, poudre de cacao, masse de cacao, feves de cacao). Tu reponds UNIQUEMENT en JSON valide, sans texte avant ni apres.";

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

async function runWithAnthropic(prompt: string): Promise<string> {
  const client = getAnthropicClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY is not set");

  const message = await client.messages.create({
    model: anthropicModel,
    max_tokens: 1024,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Unexpected Anthropic response type");
  }
  return block.text;
}

async function runWithOpenAI(prompt: string): Promise<string> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY is not set");

  const completion = await client.chat.completions.create({
    model: openaiModel,
    max_completion_tokens: 1024,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");
  return content;
}

// ─── Fallback orchestrator ───────────────────────────────────────

async function runLLM(prompt: string): Promise<string> {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.trim();

  if (!hasAnthropic && !hasOpenAI) {
    throw new Error(
      "Aucune cle IA configuree. Definissez ANTHROPIC_API_KEY ou OPENAI_API_KEY."
    );
  }

  if (hasAnthropic) {
    try {
      return await runWithAnthropic(prompt);
    } catch (err) {
      if (!hasOpenAI) throw err;
      console.warn(
        "[AI] Anthropic failed, falling back to OpenAI:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return await runWithOpenAI(prompt);
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
  const tonDesc = TONE_MAP[params.tone] || TONE_MAP.FORMAL;
  const langDesc = LANG_MAP[params.language] || params.language;
  const sender = getSenderInfo();

  const senderName = params.senderName || sender.name;
  const senderCompany = params.senderCompany || sender.company;
  const senderPosition = sender.position;

  const prompt = `Genere un email de prospection commerciale B2B avec ces parametres :

DESTINATAIRE :
- Nom du contact : ${params.prospectName}
- Entreprise : ${params.companyName}
- Pays : ${params.country}
- Secteur : ${params.sector || "non specifie"}
- Produit d'interet : ${params.product || "non specifie"}

EXPEDITEUR :
- Nom : ${senderName}
- Poste : ${senderPosition}
- Entreprise : ${senderCompany}

CAMPAGNE :
- Produit a promouvoir : ${params.campaignProduct}
- Ton : ${tonDesc}
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
8. Commence directement par "Dear [nom du contact]," ou "Dear [nom entreprise] Team," — PAS "Dear Sir/Madam".
9. Ne repete pas le nom de l'entreprise du prospect plus de 2 fois dans le mail.
10. Mentionne des avantages concrets : qualite constante, livraison fiable, prix competitifs, certifications, etc.

FORMAT DE REPONSE (JSON uniquement) :
{
  "subject": "objet court et accrocheur",
  "body": "corps du mail SANS signature finale"
}`;

  const raw = await runLLM(prompt);
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
  const langDesc = LANG_MAP[language] || language;
  const sender = getSenderInfo();

  const prompt = `Voici l'email initial envoye :
Objet: ${originalSubject}
Corps: ${originalBody}

Genere la relance numero ${followUpNumber} pour ${prospectName}.
- Expediteur : ${sender.name}, ${sender.position} chez ${sender.company}
- Ton : ${tonDesc}
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
