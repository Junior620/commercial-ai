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

// ─── Public API ──────────────────────────────────────────────────

export async function generateEmail(
  params: GenerateEmailParams
): Promise<GeneratedEmail> {
  const tonDesc = TONE_MAP[params.tone] || TONE_MAP.FORMAL;
  const langDesc = LANG_MAP[params.language] || params.language;

  const prompt = `Genere un email de prospection commerciale avec les parametres suivants :

- Destinataire : ${params.prospectName} de ${params.companyName} (${params.country})
- Secteur d'activite : ${params.sector}
- Produit d'interet du prospect : ${params.product}
- Produit a promouvoir : ${params.campaignProduct}
- Ton : ${tonDesc}
- Langue : ${langDesc}
${params.senderName ? `- Expediteur : ${params.senderName}${params.senderCompany ? ` de ${params.senderCompany}` : ""}` : ""}
${params.customInstructions ? `- Instructions supplementaires : ${params.customInstructions}` : ""}

Regles :
1. L'email doit paraitre naturel, ecrit par un humain, jamais robotique
2. Personnalise selon le profil du prospect
3. Inclus un appel a l'action clair
4. Ne depasse pas 200 mots pour le corps
5. L'objet doit etre accrocheur et court (max 60 caracteres)

Reponds UNIQUEMENT au format JSON :
{
  "subject": "l'objet du mail",
  "body": "le corps du mail complet avec salutation et signature"
}`;

  const raw = await runLLM(prompt);
  return parseJson<GeneratedEmail>(raw);
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

  const prompt = `Voici l'email initial envoye :
Objet: ${originalSubject}
Corps: ${originalBody}

Genere la relance numero ${followUpNumber} pour ${prospectName}.
- Ton : ${tonDesc}
- Langue : ${langDesc}

Regles :
1. Change completement l'angle d'approche par rapport au mail precedent
2. Reste bref (max 100 mots)
3. Ne sois pas insistant, reste courtois
4. Ajoute une nouvelle proposition de valeur
5. L'objet doit mentionner que c'est un suivi sans etre repetitif

Reponds UNIQUEMENT au format JSON :
{
  "subject": "l'objet du mail de relance",
  "body": "le corps du mail de relance"
}`;

  const raw = await runLLM(prompt);
  return parseJson<GeneratedEmail>(raw);
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
