// Feat prerequisite checking. PF1 keeps prerequisites as text ("Prerequisites: Str 13, base attack
// bonus +1."), so this parses the common clause shapes and checks them against the actor: ability
// scores, base attack bonus, caster level, character and class level, skill ranks, race, size,
// spellcasting, proficiencies (from any source, not only feats), class features, traits and other
// feats, including "X or Y" alternatives. Anything it can't read is reported as "check manually"
// rather than guessed; only a name that really is a feat can be reported missing.

const ABILITIES = { str: "str", dex: "dex", con: "con", int: "int", wis: "wis", cha: "cha" };
const norm = (s) => s.toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").replace(/[^a-z0-9]+/g, " ").trim();
const fullNorm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); // keeps "(planes)"

// Names from the compendium indexes (loaded at startup), gathered once
let names = null;
function known() {
  if (names) return names;
  const items = (test) => game.packs.filter((p) => p.documentName === "Item" && test(p.collection)).flatMap((p) => [...p.index]);
  const feats = items((id) => /feats/i.test(id)).filter((e) => e.type === "feat");
  names = {
    feats: new Set(feats.map((e) => norm(e.name))),
    // Feat names with "and" in them, so splitting clauses on "and" leaves them whole
    andFeats: [...new Set(feats.map((e) => e.name.replace(/\s*\([^)]*\)\s*$/, "")).filter((n) => /\sand\s/i.test(n)))],
    races: new Set(items((id) => /races/i.test(id)).map((e) => norm(e.name))),
  };
  return names;
}

const SKILLS = () => Object.entries(pf1.config.skills).map(([key, label]) => [fullNorm(label), key]);

function prerequisiteClauses(feat) {
  const div = document.createElement("div");
  div.innerHTML = (feat.system.description?.value ?? "").replace(/@UUID\[[^\]]+\](?:\{([^}]+)\})?/g, "$1").replace(/<\/p>|<br\s*\/?>/g, "\n");
  const m = div.textContent.match(/Prerequisites?\s*:?\s*([^\n]*?)(?:\.\s|\.$|\n|$)/i);
  if (!m) return [];
  let text = m[1].replace(/(?<!(?:Light|Medium|Heavy)\s)Armor Proficiency,\s*(Light|Medium|Heavy)\b(?!\s+Armor)/gi, "Armor Proficiency ($1)"); // keep the comma from splitting it
  for (const name of known().andFeats) {
    const at = text.toLowerCase().indexOf(name.toLowerCase());
    if (at >= 0) text = text.slice(0, at) + name.replace(/\sand\s/gi, " \u0001 ") + text.slice(at + name.length);
  }
  return text
    .split(/,|;|\band\b/)
    .map((s) => s.replace(/\u0001/g, "and").trim())
    .filter(Boolean);
}

function casterLevel(actor) {
  const books = actor.system.attributes?.spells?.spellbooks ?? {};
  return Math.max(0, ...Object.values(books).filter((b) => b.inUse).map((b) => b.cl?.total ?? 0));
}

// Proficiency "feats" are often granted by a class instead; PF1 totals every source on the actor
const PROFICIENCIES = [
  [/^shield proficiency$/i, "armorProf", "shl"],
  [/^tower shield proficiency$/i, "armorProf", "twr"],
  [/^armor proficiency \(?light\)?$|^light armor proficiency$/i, "armorProf", "lgt"],
  [/^armor proficiency \(?medium\)?$|^medium armor proficiency$/i, "armorProf", "med"],
  [/^armor proficiency \(?heavy\)?$|^heavy armor proficiency$/i, "armorProf", "hvy"],
  [/^simple weapon proficiency$/i, "weaponProf", "simple"],
  [/^martial weapon proficiency$/i, "weaponProf", "martial"],
];

const SIZES = ["fine", "dim", "tiny", "sm", "med", "lg", "huge", "grg", "col"];
const SIZE_WORDS = { fine: "fine", diminutive: "dim", tiny: "tiny", small: "sm", medium: "med", large: "lg", huge: "huge", gargantuan: "grg", colossal: "col" };

function classLevel(actor, name) {
  const classes = actor.itemTypes.class.filter((c) => norm(c.name) === norm(name));
  return classes.length ? classes.reduce((sum, c) => sum + (c.system.level ?? 0), 0) : null;
}

function skillRanks(actor, skillName) {
  const want = fullNorm(skillName);
  const key = SKILLS().find(([label]) => label === want)?.[1];
  const skills = actor.system.skills ?? {};
  if (key) return skills[key]?.rank ?? 0;
  // Craft (alchemy), Perform (sing), Profession (sailor): a named sub-skill
  const m = skillName.match(/^(craft|perform|profession)\s*\(([^)]+)\)$/i);
  if (!m) return null;
  const parent = SKILLS().find(([label]) => label === fullNorm(m[1]))?.[1];
  const subs = Object.values(skills[parent]?.subSkills ?? {});
  return subs.find((s) => norm(s.name ?? "") === norm(m[2]))?.rank ?? 0;
}

const isRace = (name) => known().races.has(norm(name));
function hasRace(actor, name) {
  const race = actor.race;
  if (!race) return false;
  const subtypes = (race._source.system.creatureSubtypes ?? []).map(norm);
  return norm(race.name) === norm(name) || subtypes.includes(norm(name));
}

/** A class feature, racial trait or other ability by name, found on the sheet. */
function hasAbility(actor, name) {
  const want = norm(name);
  return actor.items.some((i) => i.type === "feat" && (norm(i.name) === want || norm(i.name).startsWith(`${want} `)));
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
  for (const [pattern, trait, key] of PROFICIENCIES) {
    if (!pattern.test(clause)) continue;
    const have = new Set(actor.system.traits?.[trait]?.total ?? []).has(key);
    return { clause, met: have, detail: have ? "proficient" : "not proficient" };
  }
  // "Bluff 5 ranks", "Knowledge (planes) 3 ranks", "5 ranks in Stealth"
  if ((m = clause.match(/^(.+?)\s+(\d+)\s+ranks?$/i) ?? clause.match(/^(\d+)\s+ranks?\s+in\s+(.+)$/i))) {
    const [skill, needed] = /^\d/.test(m[1]) ? [m[2], Number(m[1])] : [m[1], Number(m[2])];
    const have = skillRanks(actor, skill.trim());
    if (have !== null) return { clause, met: have >= needed, detail: `you have ${have}` };
  }
  // "8th-level fighter", "fighter level 8": that class's level, not the character's
  if ((m = clause.match(/^(\d+)(?:st|nd|rd|th)[- ]level\s+([a-z][a-z' -]*)$/i) ?? clause.match(/^([a-z][a-z' -]*?)\s+level\s+(\d+)(?:st|nd|rd|th)?$/i))) {
    const [level, name] = /^\d/.test(m[1]) ? [Number(m[1]), m[2]] : [Number(m[2]), m[1]];
    if (!/^(character|caster)$/i.test(name.trim())) {
      const have = classLevel(actor, name) ?? 0;
      return { clause, met: have >= level, detail: `you have ${have} ${name.trim()} level${have === 1 ? "" : "s"}` };
    }
  }
  if ((m = clause.match(/character level\s*(\d+)|(\d+)(?:st|nd|rd|th)[- ]level/i))) {
    const have = actor.system.details?.level?.value ?? 0;
    return { clause, met: have >= Number(m[1] ?? m[2]), detail: `you are level ${have}` };
  }
  if ((m = clause.match(/^(\d+)\s+Hit Dice$/i))) {
    const have = actor.system.attributes?.hd?.total ?? 0;
    return { clause, met: have >= Number(m[1]), detail: `you have ${have}` };
  }
  // "base Fortitude save bonus +4": the sum of the classes' base saves (the actor's own field stays 0)
  if ((m = clause.match(/^base (fortitude|reflex|will) sav(?:e|ing throw)(?: bonus)? (?:of )?\+?(\d+)$/i))) {
    const save = { fortitude: "fort", reflex: "ref", will: "will" }[m[1].toLowerCase()];
    const have = actor.itemTypes.class.reduce((sum, c) => sum + (c.system.savingThrows?.[save]?.base ?? 0), 0);
    return { clause, met: have >= Number(m[2]), detail: `you have +${have}` };
  }
  // "Small size or smaller", "Large size or larger", "size Large or larger"
  if ((m = clause.match(/^(fine|diminutive|tiny|small|medium|large|huge|gargantuan|colossal)(?: size)?(?: or (smaller|larger))?$/i) ?? clause.match(/^size (fine|diminutive|tiny|small|medium|large|huge|gargantuan|colossal)(?: or (smaller|larger))?$/i))) {
    const want = SIZES.indexOf(SIZE_WORDS[m[1].toLowerCase()]);
    const have = SIZES.indexOf(actor.system.traits?.size?.base ?? "med");
    const met = m[2]?.toLowerCase() === "smaller" ? have <= want : m[2] ? have >= want : have === want;
    return { clause, met, detail: `you are ${pf1.config.sizeChart?.[SIZES[have]] ?? SIZES[have]}` };
  }
  if ((m = clause.match(/^ability to cast (arcane|divine|psychic)? ?spells(?: of (\d+)(?:st|nd|rd|th) level)?$/i))) {
    const books = Object.values(actor.system.attributes?.spells?.spellbooks ?? {}).filter((b) => b.inUse && (!m[1] || b.kind === m[1].toLowerCase()));
    return { clause, met: books.length > 0, detail: books.length ? "you can" : "no such spellbook" };
  }
  // Depends on a choice made when taking it ("Weapon Focus with selected weapon")
  if (/\b(selected|chosen|choosen)\b/i.test(clause)) return { clause, met: null, detail: "check manually" };

  // "X or Y": met if any alternative is; missing only if every alternative is definitely missing
  if (/\sor\s/i.test(clause)) {
    const parts = clause.split(/\s+or\s+/i).map((p) => checkClause(p.trim(), actor));
    if (parts.some((p) => p.met === true)) return { clause, met: true };
    if (parts.every((p) => p.met === false)) return { clause, met: false, detail: "none of these" };
    return { clause, met: null, detail: "check manually" };
  }

  // A race
  if (isRace(clause)) {
    const met = hasRace(actor, clause);
    return { clause, met, detail: met ? null : `you are ${actor.race?.name ?? "raceless"}` };
  }
  // A class feature or trait by name ("channel energy class feature", "Halfling Jinx trait")
  if ((m = clause.match(/^(.+?)\s+(?:class feature|class ability|racial trait|trait|ability)$/i))) {
    return hasAbility(actor, m[1]) ? { clause, met: true } : { clause, met: null, detail: "not found on the sheet; check manually" };
  }
  // Another feat, by name. Only something that really is a feat can be reported missing.
  if (actor.itemTypes.feat.some((f) => norm(f.name) === norm(clause))) return { clause, met: true };
  if (known().feats.has(norm(clause))) return { clause, met: false, detail: "feat not found on sheet", maybe: true };
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
