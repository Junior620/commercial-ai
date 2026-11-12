import { config } from "./config";
import { fetchPage } from "./fetcher";

/** Règles robots.txt qui s'appliquent à ce robot (ou à tous). */
export interface RobotsRules {
  disallow: string[];
  allow: string[];
}

const EMPTY: RobotsRules = { disallow: [], allow: [] };

/** Extrait les règles du groupe qui nomme ce robot, sinon du groupe « * ». */
export function parseRobots(text: string, botName: string): RobotsRules {
  const groups: { agents: string[]; rules: RobotsRules }[] = [];
  let current: { agents: string[]; rules: RobotsRules } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { disallow: [], allow: [] } };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "disallow" && value) current.rules.disallow.push(value);
    if (field === "allow" && value) current.rules.allow.push(value);
  }

  const own = groups.filter((g) => g.agents.some((a) => a !== "*" && botName.includes(a)));
  const chosen = own.length ? own : groups.filter((g) => g.agents.includes("*"));
  return {
    disallow: chosen.flatMap((g) => g.rules.disallow),
    allow: chosen.flatMap((g) => g.rules.allow),
  };
}

function matches(rule: string, path: string): boolean {
  const pattern = rule
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\\\$$/, "$");
  return new RegExp(`^${pattern}`).test(path);
}

/** La règle la plus précise l'emporte ; à égalité, l'autorisation. */
export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  const longest = (list: string[]) => list.filter((r) => matches(r, path)).reduce((max, r) => Math.max(max, r.length), -1);
  const disallowed = longest(rules.disallow);
  if (disallowed < 0) return true;
  return longest(rules.allow) >= disallowed;
}

const cache = new Map<string, Promise<RobotsRules>>();

/** Règles du site (mises en cache). Un robots.txt absent ou illisible n'interdit rien. */
export function robotsFor(origin: string): Promise<RobotsRules> {
  let rules = cache.get(origin);
  if (!rules) {
    rules = fetchPage(`${origin}/robots.txt`, 8000)
      .then((page) => (page.html ? parseRobots(page.html.slice(0, 200_000), config.botName) : EMPTY))
      .catch(() => EMPTY);
    cache.set(origin, rules);
    if (cache.size > 3000) cache.clear();
  }
  return rules;
}
