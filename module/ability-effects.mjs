// What an ability that isn't a spell does to a creature that fails its save, read from the item's text
// (class abilities, hexes, monster and template abilities, racial traits, alchemical items): "must
// succeed on a Fortitude save or be paralyzed for 1d4+1 rounds", "is nauseated for 1 round; a Fortitude
// save negates", "blinded permanently. A successful Fortitude save reduces this to dazzled for 1d4
// rounds". The result has the spell-data.mjs shape (effect, onSave), so the spell rows apply it.
// Rulings (DECISIONS.md, Rolls and buffs):
//   - an effect that can't be read still gets its save; the row says to apply the effect by hand;
//   - a condition whose duration can't be read isn't applied: the row reminds the GM;
//   - wrong readings go in CORRECTIONS, by the item's name.

// Words in rules text → PF1's condition ids
const CONDITIONS = {
  shaken: "shaken", frightened: "frightened", panicked: "panicked", sickened: "sickened", nauseated: "nauseated",
  staggered: "staggered", dazed: "dazed", stunned: "stunned", confused: "confused", blinded: "blind", blind: "blind",
  deafened: "deaf", deaf: "deaf", dazzled: "dazzled", fatigued: "fatigued", exhausted: "exhausted", entangled: "entangled",
  paralyzed: "paralyzed", prone: "prone", cowering: "cowering", fascinated: "fascinated", grappled: "grappled",
  "flat-footed": "flatFooted", unconscious: "unconscious", asleep: "sleep", helpless: "helpless", petrified: "petrified",
  slowed: "slowed", immobilized: "immobilized",
};
// Verbs that put the condition on the creature by themselves ("staggers creatures for 1 round and deafens them")
const VERBS = {
  staggers: "staggered", deafens: "deaf", blinds: "blind", dazes: "dazed", stuns: "stunned", nauseates: "nauseated",
  sickens: "sickened", frightens: "frightened", panics: "panicked", paralyzes: "paralyzed", entangles: "entangled",
  fascinates: "fascinated", confuses: "confused", exhausts: "exhausted", fatigues: "fatigued", dazzles: "dazzled",
};
const COND_WORD = new RegExp(`\\b(${[...Object.keys(CONDITIONS), ...Object.keys(VERBS)].join("|")})\\b`, "i");
const SAVE_TYPES = { fortitude: "fort", reflex: "ref", will: "will" };
const SAVE_WORD = /\b(fortitude|reflex|will)\b|\bsav(e|es|ing throw)\b/i;
// The condition is put on the creature ("or be paralyzed", "is nauseated", "becomes shaken", "knocked prone")
const STATE_VERB = /\b(be|become|becomes|is|are|knocked|knocks|left|falls?)\s+(?:\w+\s+){0,2}$/i;
const UNTIL_ACTED = new Set(["prone"]); // ends when the creature acts (stands up), not after a time
const ABILITY_WORDS = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };

// Items whose text reads wrong: by name in lower case, an entry in the spell-data.mjs format (or
// { skip: true } for abilities whose save isn't against the targets, like a bomb's splash)
export const CORRECTIONS = {};

/** "1d4+1 rounds", "1 minute", "permanently", "a number of rounds equal to your Wisdom modifier (minimum 1)". */
function durationAfter(text) {
  const t = text.slice(0, 140).toLowerCase();
  if (/^\s*(?:,\s*)?permanently\b/.test(t) || /^\s*(?:,\s*)?for (?:an unlimited time|ever)\b/.test(t)) return { formula: null };
  let m = t.match(/^\s*(?:,\s*)?for (\d+d\d+(?:\s*[+-]\s*\d+)?|\d+|one|two|three|four|five|six|ten) (round|minute|hour)s?\b/);
  if (m) {
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10 };
    const n = words[m[1]] ?? m[1].replace(/\s+/g, "");
    const per = { round: 1, minute: 10, hour: 600 }[m[2]];
    return { formula: per === 1 ? String(n) : `(${n}) * ${per}` };
  }
  m = t.match(/^\s*(?:,\s*)?for (?:a number of rounds|rounds) equal to (?:your|its|his|her|the [\w' ]+?'s?) (strength|dexterity|constitution|intelligence|wisdom|charisma) (?:modifier|bonus)(?:\s*\(minimum (\d+)\))?/);
  if (m) return { formula: `max(${m[2] ?? 1}, @abilities.${ABILITY_WORDS[m[1]]}.mod)` };
  return null;
}

/** The conditions a sentence puts on a creature: [[id, formula | null]] and the ones whose duration is unknown. */
function conditionsIn(sentence) {
  const found = [];
  const unknown = [];
  const re = new RegExp(COND_WORD.source, "gi");
  for (const m of sentence.matchAll(re)) {
    const before = sentence.slice(0, m.index);
    const word = m[1].toLowerCase();
    const verb = VERBS[word];
    if (!verb && !STATE_VERB.test(before) && !/\b(or|and)\s+$/i.test(before)) continue;
    const id = verb ?? CONDITIONS[word];
    if (found.some(([f]) => f === id) || unknown.includes(id)) continue;
    // "be permanently paralyzed"; prone lasts until the creature stands up
    // a verb's duration follows its object: "deafens them for 1d4 rounds"
    let after = sentence.slice(m.index + m[0].length);
    if (verb) after = after.replace(/^\s+(?:them|it|him|her|the target|creatures|targets|the creature)\b/i, "");
    const d = /\bpermanently\s+$/i.test(before) || UNTIL_ACTED.has(id) ? { formula: null } : durationAfter(after);
    if (d) found.push([id, d.formula]);
    else unknown.push(id);
  }
  return { found, unknown };
}

const cache = new Map(); // item name + text → reading

/**
 * Items that share one text listing every variant ("Grenade (bang grenade)": "...Bang Grenade: Deals no
 * damage but staggers creatures... Bio Grenade: ..."): only the variant's own entry.
 */
function ownPart(name, text) {
  const variant = name.match(/\(([^)]+)\)\s*$/)?.[1];
  if (!variant) return text;
  const lower = text.toLowerCase();
  const at = lower.search(new RegExp(`${variant.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`));
  if (at < 0) return text;
  const rest = text.slice(text.indexOf(":", at) + 1);
  const end = rest.search(/[.)]\s*[A-Z][a-z]+(?: [A-Za-z]+){0,2}\s*:\s/);
  return rest.slice(0, end < 0 ? undefined : end + 1);
}

/**
 * The effect of a failed save against this item, in the spell-data.mjs shape:
 * { effect?, onSave?, unread?: true, reminder?: "nauseated (duration in its text)" } or null for no save.
 */
export function abilityDef(item, saveType = null) {
  if (!item || item.type === "spell") return null;
  const correction = CORRECTIONS[item.name.toLowerCase()];
  if (correction) return correction.skip ? null : correction;
  const html = item.system?.description?.value ?? "";
  const key = `${item.name}|${saveType}|${html.length}|${html.slice(0, 200)}`;
  if (cache.has(key)) return cache.get(key);
  const text = html
    .replace(/@Condition\[([^\]|;]+)[^\]]*\](?:\{([^}]*)\})?/g, (_, id, label) => label ?? id)
    .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const sentences = ownPart(item.name, text).split(/(?<=[.;])\s+/);
  const effect = { conditions: [] };
  const onSave = { conditions: [] };
  const unknown = [];
  sentences.forEach((sentence, i) => {
    const next = sentences[i + 1] ?? "";
    const aboutSave = SAVE_WORD.test(sentence) || SAVE_WORD.test(next);
    if (!aboutSave || !COND_WORD.test(sentence)) return;
    // A sentence about another save (a list of several items' effects, like the grenades): not this action's
    const named = (sentence.match(/\b(fortitude|reflex|will)\b/i) ?? next.match(/\b(fortitude|reflex|will)\b/i))?.[1]?.toLowerCase();
    if (saveType && named && SAVE_TYPES[named] !== saveType) return;
    // "A successful Fortitude save reduces this to dazzled for 1d4 rounds": what a save leaves
    const reduced = sentence.match(/\bsuccessful\b[^.]*?\breduces?\b[^.]*?\bto\b(.*)$/i);
    if (reduced) {
      const r = conditionsIn(`be ${reduced[1]}`);
      onSave.conditions.push(...r.found);
      return;
    }
    const { found, unknown: u } = conditionsIn(sentence);
    for (const c of found) if (!effect.conditions.some(([id]) => id === c[0])) effect.conditions.push(c);
    for (const id of u) if (!unknown.includes(id) && !effect.conditions.some(([c]) => c === id)) unknown.push(id);
  });
  let out;
  if (effect.conditions.length || onSave.conditions.length) {
    out = { effect: effect.conditions.length ? effect : null, ...(onSave.conditions.length ? { onSave } : {}) };
    if (unknown.length) out.reminder = unknown;
  } else if (unknown.length) out = { effect: null, reminder: unknown };
  else out = { effect: null, unread: true };
  cache.set(key, out);
  return out;
}
