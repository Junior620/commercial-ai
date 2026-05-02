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

  const fallback = process.env.NODE_ENV === "production" ? 5 : 1;
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

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("DATABASE_URL is not set — Prisma will not be available");
    return null as unknown as PrismaClient;
  }
  const pool = getOrCreatePgPool(connectionString);
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const c = createPrismaClient();
    globalForPrisma.prisma = c;
    return c;
  })();
