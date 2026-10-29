const BOT_NAME = "scraper-ai";
const TIMEOUT_MS = 15_000;

// Zwykłe zapytanie HTTP – bez proxy. Strony, które blokują adresy IP serwerów,
// w praktyce omija się przez residential proxy, ale w tym projekcie celowo z niego nie korzystamy.
function httpGet(url: string | URL, userAgent: string): Promise<Response> {
  return fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

export async function fetchPage(url: string, userAgent: string): Promise<string> {
  const res = await httpGet(url, userAgent);
  // 403 / 429 to typowy znak, że strona blokuje scrapery
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} dla ${url}`);
  return res.text();
}

// ── robots.txt ──────────────────────────────────────────────────────────────
// Nawiązanie do części „Prawo i etyka”: zanim pobierzemy stronę, pytamy, czy wolno.
// Obsługuje grupy User-agent, Allow/Disallow, symbole * i $ oraz zasadę
// „wygrywa najdłuższa pasująca reguła” z RFC 9309.

type Rule = { allow: boolean; pattern: string };

export function parseRobots(text: string, botName = BOT_NAME): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | undefined;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (key === "user-agent") {
      // Kolejne linie User-agent bez reguł pomiędzy należą do tej samej grupy
      if (!current || current.rules.length) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current && value) {
      current.rules.push({ allow: key === "allow", pattern: value });
    }
  }

  const bot = botName.toLowerCase();
  const own = groups.filter((g) => g.agents.some((a) => a !== "*" && bot.includes(a)));
  const chosen = own.length ? own : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

export function isPathAllowed(rules: Rule[], path: string): boolean {
  let best: Rule | undefined;
  for (const rule of rules) {
    if (!patternToRegex(rule.pattern).test(path)) continue;
    const longer = !best || rule.pattern.length > best.pattern.length;
    const tieAllow = best && rule.pattern.length === best.pattern.length && rule.allow;
    if (longer || tieAllow) best = rule;
  }
  return best?.allow ?? true;
}

export async function isAllowedByRobots(pageUrl: string, userAgent: string): Promise<boolean> {
  const url = new URL(pageUrl);
  try {
    const res = await httpGet(new URL("/robots.txt", url.origin), userAgent);
    if (!res.ok) return true; // brak robots.txt = brak ograniczeń
    return isPathAllowed(parseRobots(await res.text()), url.pathname + url.search);
  } catch {
    return true; // nie udało się pobrać robots.txt – błąd sieci i tak wyjdzie przy pobieraniu strony
  }
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}
