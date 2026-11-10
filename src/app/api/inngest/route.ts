import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { functions } from "@/inngest/functions";

// Chaque step Inngest est une requête distincte : 300 s suffisent largement
// (un lot Apify ou une génération IA). Ajuster selon le plan Vercel.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
