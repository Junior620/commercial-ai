import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

const TONE_MAP = {
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

export async function generateEmail(
  params: GenerateEmailParams
): Promise<GeneratedEmail> {
  const tonDesc = TONE_MAP[params.tone] || TONE_MAP.FORMAL;
  const langDesc = LANG_MAP[params.language] || params.language;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Tu es un expert en redaction d'emails commerciaux B2B dans le secteur du cacao et de ses derives (beurre de cacao, poudre de cacao, masse de cacao, feves de cacao).

Genere un email de prospection commerciale avec les parametres suivants :

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
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse email JSON");

  return JSON.parse(jsonMatch[0]) as GeneratedEmail;
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

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Tu es un expert en relances commerciales B2B dans le secteur du cacao.

Voici l'email initial envoye :
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
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse follow-up JSON");

  return JSON.parse(jsonMatch[0]) as GeneratedEmail;
}

export async function classifyResponse(
  responseContent: string,
  originalEmailSubject: string
): Promise<{
  classification: string;
  suggestedReply: string;
}> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyse cette reponse a un email commercial B2B (secteur cacao) :

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
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse classification JSON");

  return JSON.parse(jsonMatch[0]);
}
