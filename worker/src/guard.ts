import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { isPrivateHost } from "../../src/lib/email-extractor";

/**
 * Garde anti-adresses internes : le service ne lit que des sites publics.
 * Il tourne sur un serveur qui héberge d'autres services (bases, API internes) :
 * aucune adresse locale, privée ou de métadonnées ne doit jamais être atteinte.
 */

export class GuardError extends Error {}

const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

/** true si l'adresse IP (v4 ou v6) n'est pas routable sur Internet. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(ip) === 4) return isPrivateHost(ip);
  if (isIP(ip) === 6) {
    // Adresse IPv4 encapsulée (::ffff:10.0.0.1)
    const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isPrivateHost(mapped[1]);
    return (
      ip === "::" || ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe8") ||
      ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb") || ip.startsWith("ff") || ip.startsWith("64:ff9b:")
    );
  }
  return true; // ni IPv4 ni IPv6 : refusé
}

/** Contrôle sans réseau : protocole, port, nom d'hôte. */
export function checkUrlShape(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new GuardError("Adresse invalide");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new GuardError("Protocole refusé");
  if (!ALLOWED_PORTS.has(url.port)) throw new GuardError("Port refusé");
  if (url.username || url.password) throw new GuardError("Identifiants dans l'adresse refusés");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isPrivateHost(host) || (isIP(host) !== 0 && isPrivateAddress(host))) throw new GuardError("Adresse interne refusée");
  return url;
}

const resolved = new Map<string, { ok: boolean; at: number }>();
const RESOLVE_TTL_MS = 10 * 60 * 1000;

/** Contrôle complet : la forme de l'adresse, puis toutes les adresses IP du nom d'hôte. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = checkUrlShape(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0) return url;

  const cached = resolved.get(host);
  if (cached && Date.now() - cached.at < RESOLVE_TTL_MS) {
    if (!cached.ok) throw new GuardError("Adresse interne refusée");
    return url;
  }
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new GuardError("Nom de domaine introuvable");
  }
  const ok = addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
  resolved.set(host, { ok, at: Date.now() });
  if (resolved.size > 5000) resolved.clear();
  if (!ok) throw new GuardError("Adresse interne refusée");
  return url;
}
