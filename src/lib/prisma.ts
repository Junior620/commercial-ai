import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

/**
 * Postgres (Supabase *Session* pooler, etc.) expose souvent un tout petit nombre de
 * sessions simultanées côté projet (ex. ~15) partagées entre **tous** les clients
 * (autre terminal, Prisma Studio, scripts…). D’où EMAXCONNSESSION.
 *
 * En dev Next/Turbopack, on ne garde par défaut qu’**une** connexion réutilisable par
 * process pour laisser de la marge aux autres outils.
 *
 * `DATABASE_POOL_MAX` — plafond explicite (1–15).
 */
function getOrCreatePgPool(connectionString: string): Pool {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool;

  // Serverless (Vercel) : chaque instance garde peu de connexions ; utiliser de préférence
  // le « Transaction pooler » Supabase (port 6543) dans DATABASE_URL.
  const fallback = process.env.NODE_ENV === "production" ? 2 : 3;
  const raw = process.env.DATABASE_POOL_MAX?.trim();
  const parsed =
    raw && raw.length > 0 ? Number.parseInt(raw, 10) : Number.NaN;
  const max = Number.isFinite(parsed)
    ? Math.min(15, Math.max(1, parsed))
    : fallback;

  const pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 20_000,
  });

  pool.on("error", (err) => {
    console.error("[pg pool]", err.message);
  });

  globalForPrisma.pgPool = pool;
  return pool;
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL n'est pas défini : impossible d'accéder à la base de données.");
  }
  const client = new PrismaClient({ adapter: new PrismaPg(getOrCreatePgPool(connectionString)) });
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Client Prisma créé à la première utilisation : une variable manquante produit
 * une erreur explicite au lieu d'un « cannot read properties of null ».
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
