import { NextResponse } from "next/server";
import type { z } from "zod";

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Lit et valide le corps JSON d'une requête. */
export async function parseJsonBody<T>(req: Request, schema: z.ZodType<T>): Promise<ParseResult<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.length ? `${issue.path.join(".")} : ` : "";
    return {
      ok: false,
      response: NextResponse.json({ error: `${field}${issue?.message ?? "Données invalides"}` }, { status: 400 }),
    };
  }
  return { ok: true, data: parsed.data };
}

export function prismaErrorCode(err: unknown): string {
  return err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
}

/** Journalise l'erreur côté serveur et renvoie un message générique au client. */
export function serverError(context: string, err: unknown, message = "Erreur interne") {
  console.error(`[${context}]`, err);
  return NextResponse.json({ error: message }, { status: 500 });
}
