// Feat prerequisite checking. PF1 keeps prerequisites as text ("Prerequisites: Str 13, base attack
// bonus +1."), so this parses the common clause shapes and checks them against the actor:
// ability scores, base attack bonus, caster level, character level, and other feats. Anything it
// can't read is reported as "check manually" rather than guessed.

const ABILITIES = { str: "str", dex: "dex", con: "con", int: "int", wis: "wis", cha: "cha" };
const norm = (s) => s.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").replace(/[^a-z0-9]+/g, " ").trim();

function prerequisiteClauses(feat) {
  const div = document.createElement("div");
  div.innerHTML = (feat.system.description?.value ?? "").replace(/@UUID\[[^\]]+\](?:\{([^}]+)\})?/g, "$1").replace(/<\/p>|<br\s*\/?>/g, "\n");
  const m = div.textContent.match(/Prerequisites?\s*:?\s*([^\n]*?)(?:\.\s|\.$|\n|$)/i);
  if (!m) return [];
  return m[1]
    .split(/,|;|\band\b/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function casterLevel(actor) {
  const books = actor.system.attributes?.spells?.spellbooks ?? {};
  return Math.max(0, ...Object.values(books).filter((b) => b.inUse).map((b) => b.cl?.total ?? 0));
}

function checkClause(clause, actor) {
  let m;
  if ((m = clause.match(/^(Str|Dex|Con|Int|Wis|Cha)\w*\s+(\d+)/i))) {
    const have = actor.system.abilities?.[ABILITIES[m[1].toLowerCase()]]?.total ?? 0;
    return { clause, met: have >= Number(m[2]), detail: `you have ${have}` };
  }
  if ((m = clause.match(/base attack bonus\s*\+?(\d+)/i))) {
    const have = actor.system.attributes?.bab?.total ?? 0;
    return { clause, met: have >= Number(m[1]), detail: `you have +${have}` };
  }
  if ((m = clause.match(/caster level\s*(\d+)/i))) {
    const have = casterLevel(actor);
    return { clause, met: have >= Number(m[1]), detail: `you have ${have}` };
  }
  if ((m = clause.match(/character level\s*(\d+)|(\d+)(?:st|nd|rd|th)[- ]level/i))) {
    const have = actor.system.details?.level?.value ?? 0;
    return { clause, met: have >= Number(m[1] ?? m[2]), detail: `you are level ${have}` };
  }
  // Another feat, by name
  const name = norm(clause);
  const known = actor.itemTypes.feat.some((f) => norm(f.name) === name);
  if (known) return { clause, met: true };
  if (/^[A-Z][\w' -]+(\s*\([^)]*\))?$/.test(clause) && clause.split(" ").length <= 5) {
    return { clause, met: false, detail: "feat not found on sheet", maybe: true };
  }
  return { clause, met: null, detail: "check manually" };
}

/**
 * @returns {{status: "met"|"unmet"|"unknown", results: object[], summary: string}}
 */
export function checkPrerequisites(feat, actor) {
  const results = prerequisiteClauses(feat).map((c) => checkClause(c, actor));
  const unmet = results.filter((r) => r.met === false);
  const unknown = results.filter((r) => r.met === null);
  const status = unmet.length ? "unmet" : unknown.length ? "unknown" : "met";
  const summary = !results.length
    ? "No prerequisites"
    : results.map((r) => `${r.met === true ? "✓" : r.met === false ? "✗" : "?"} ${r.clause}${r.detail ? ` (${r.detail})` : ""}`).join("; ");
  return { status, results, summary };
}
