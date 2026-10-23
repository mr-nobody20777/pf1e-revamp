// Save bonuses against kinds of effects: "+2 racial vs fear" (halfling), "+2 vs enchantment" (elf),
// "+2 vs poison, spells and spell-likes" (dwarf), "+1 trait bonus vs charm and compulsion spells",
// Remove Fear's "+4 morale vs fear", Death Ward's "+4 vs death spells", Mind Blank's "+8 resistance vs
// mind-affecting spells and effects". PF1 prints these as reminders on the save; here they're added
// when the save is rolled against a known effect.
//
// The effect is the chat card the save was rolled from (PF1 passes it as `reference`): its spell's
// school, subschool and descriptors, and whether it's a spell or a spell-like ability. Saves rolled
// without a card get no automatic bonus (the reminders still show).
//
// The bonuses come from the context notes of the character's active items (race, traits, feats,
// buffs) that target saving throws. A note is used when it reads like "+N <type> vs <effects>":
//   - each part of "vs A, B and C" is one alternative; words in a part all have to match ("death
//     spells" = death AND spell), and a part with no recognized word never matches.
//   - notes about creatures ("vs evil creatures": alignment wards handle those), conditional notes
//     ("when", "if", "once per day") and notes about existing effects or immunities are left alone.
// Stacking follows PF1: racial, untyped, dodge and circumstance bonuses stack; other types use only
// the highest, and only the part above the character's existing bonus of that type on that save.

import { MODULE_ID } from "./const.mjs";
import { evaluate } from "./util.mjs";

// Words in a note → test against the effect
const KEYWORDS = [
  [/\bfear\b|\bfrighten/, (e) => e.descriptors.has("fear")],
  [/\bcharm\b/, (e) => e.subschools.has("charm")],
  [/\bcompulsion/, (e) => e.subschools.has("compulsion")],
  [/\benchantment/, (e) => e.school === "enc"],
  [/\billusion/, (e) => e.school === "ill"],
  [/\bnecromancy|\bnecromantic/, (e) => e.school === "nec"],
  [/\bevocation/, (e) => e.school === "evo"],
  [/\btransmutation/, (e) => e.school === "trs"],
  [/\bconjuration/, (e) => e.school === "con"],
  [/\bdivination/, (e) => e.school === "div"],
  [/\babjuration/, (e) => e.school === "abj"],
  [/mind[- ]affecting/, (e) => e.descriptors.has("mindAffecting")],
  [/\bemotion/, (e) => e.descriptors.has("emotion")],
  [/\bdeath\b/, (e) => e.descriptors.has("death")],
  [/\bpoison/, (e) => e.descriptors.has("poison") || e.isPoison],
  [/\bdisease/, (e) => e.descriptors.has("disease")],
  [/\bcurse/, (e) => e.descriptors.has("curse")],
  [/\bpain\b/, (e) => e.descriptors.has("pain")],
  [/\bsleep\b/, (e) => /\bsleep\b/i.test(e.name)],
  [/\bparaly/, (e) => /paraly/i.test(e.text)],
  [/\bpolymorph/, (e) => e.subschools.has("polymorph")],
  [/\b(fire|cold|acid|electricity|sonic)\b/, (e, m) => e.descriptors.has(m[1])],
];
// Words for the form of an effect rather than its kind
const FORMS = [
  [/\bspell[- ]like/, (e) => e.isSLA],
  [/\bspells?\b(?![- ]like)/, (e) => e.isSpell],
  [/\beffects?\b/, () => true],
];

// A line with these isn't a plain bonus; a part of "vs A, B" with these is dropped (the rest still counts)
const SKIP_LINE = /\bonce per\b|\bexisting\b|\bimmun|\breroll|\broll twice\b|\bnew save\b/i;
const SKIP_PART = /\bcreatures?\b|\bwhen\b|\bwhile\b|\bif\b|\bunless\b/i;
const TYPE_WORDS = {
  racial: "racial", trait: "trait", morale: "morale", resistance: "resist", luck: "luck", sacred: "sacred", profane: "profane",
  competence: "competence", insight: "insight", circumstance: "circumstance", enhancement: "enh", dodge: "dodge", alchemical: "alchemical",
};

/** What the save is against, from the chat card it was rolled from. */
function effectOf(card) {
  const item = card?.itemSource;
  if (!item) return null;
  const sys = item.system;
  return {
    name: item.name,
    text: `${item.name} ${(sys.descriptors?.names ?? []).join(" ")}`,
    school: sys.school ?? null,
    subschools: new Set(sys.subschool?.base ?? []),
    descriptors: new Set(sys.descriptors?.base ?? []),
    isSpell: item.type === "spell" && sys.spellbook !== "spelllike",
    isSLA: (item.type === "spell" && sys.spellbook === "spelllike") || sys.abilityType === "sp",
    isPoison: item.type === "consumable" && sys.subType === "poison",
  };
}

/** One line of a note, "+[[2]] Racial vs Poisons, Spells and Spell-likes" → { formula, type, parts } or null. */
export function parseNote(line) {
  const m = line.match(/([+-])?\s*\[\[\s*(.+?)\s*\]\]\s*([A-Za-z]+)?[^.\n]*?\b(?:vs\.?|against)\s+([^.\n]+)/i);
  if (!m || SKIP_LINE.test(line)) return null;
  const formula = `${m[1] === "-" ? "-" : ""}(${m[2]})`;
  const type = TYPE_WORDS[(m[3] ?? "").toLowerCase()] ?? "untyped";
  // Split "A, B and C" keeping each part's joiner: in "charm spells and spell-like abilities" the
  // second part only names a form, so it inherits "charm" from the part before; a comma list
  // ("poison, spells, and spell-like abilities") names separate things.
  const pieces = m[4].toLowerCase().split(/(\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+)/);
  const parts = [];
  let previous = null;
  for (let i = 0; i < pieces.length; i += 2) {
    const text = pieces[i].trim();
    const joiner = (pieces[i - 1] ?? "").trim();
    if (!text || SKIP_PART.test(text)) { previous = null; continue; }
    const kinds = KEYWORDS.map(([re, test]) => [text.match(re), test]).filter(([mm]) => mm);
    const forms = FORMS.map(([re, test]) => [text.match(re), test]).filter(([mm]) => mm);
    const inherit = !kinds.length && forms.length && /^(and|or)$/.test(joiner) && previous?.kinds.length && previous.forms.length;
    const part = { kinds: inherit ? previous.kinds : kinds, forms };
    if (part.kinds.length || part.forms.length) parts.push(part);
    previous = part;
  }
  return parts.length ? { formula, type, parts } : null;
}

/** A note's text as separate lines (notes often hold several, e.g. "+2 vs enchantment\nImmune to magic sleep"). */
const noteLines = (text) => text.split(/\n|<br\s*\/?>|<\/p>/i).map((l) => l.replace(/<[^>]+>/g, " ").trim()).filter(Boolean);

/** Does any part of "vs A, B and C" describe this effect? (A bare "effects" never matches alone.) */
function matches(parts, effect) {
  return parts.some(({ kinds, forms }) => {
    if (!kinds.length && forms.every(([m]) => /effect/.test(m[0]))) return false;
    return [...kinds, ...forms].every(([m, test]) => test(effect, m));
  });
}

/** Bonuses this actor gets on this save against this effect, after stacking. */
export function saveBonuses(actor, saveId, effect) {
  const candidates = [];
  // The race item and its racial trait items often state the same bonus in different words
  // (halfling "+2 vs fear" on the race and on Fearless): count it once.
  const racialSeen = new Set();
  for (const item of actor.items) {
    if (item.isActive === false || !item.system.contextNotes?.length) continue;
    const racialSource = item.type === "race" || item.system.subType === "racial";
    for (const note of item.system.contextNotes) {
      if (note.target !== "allSavingThrows" && note.target !== saveId) continue;
      for (const line of noteLines(note.text ?? "")) {
        const parsed = parseNote(line);
        if (!parsed || !matches(parsed.parts, effect)) continue;
        const value = evaluate(parsed.formula, item);
        if (!value) continue;
        const key = `${value}|${parsed.type}`;
        if (racialSource && racialSeen.has(key)) continue;
        if (racialSource) racialSeen.add(key);
        candidates.push({ value, type: parsed.type, label: item.name });
      }
    }
  }
  const stacking = new Set(pf1.config.stackingBonusTypes ?? ["untyped", "dodge", "racial", "circumstance"]);
  const out = candidates.filter((c) => stacking.has(c.type) || c.value < 0);
  const byType = new Map();
  for (const c of candidates) if (!stacking.has(c.type) && c.value > 0 && (!byType.has(c.type) || c.value > byType.get(c.type).value)) byType.set(c.type, c);
  for (const c of byType.values()) {
    const existing = Math.max(0, ...(actor.changes ?? []).filter((ch) => ch.type === c.type && (ch.target === "allSavingThrows" || ch.target === saveId)).map((ch) => ch.value ?? 0));
    if (c.value > existing) out.push({ ...c, value: c.value - existing });
  }
  return out;
}

Hooks.on("pf1PreActorRollSave", (actor, rollOptions, saveId) => {
  const card = rollOptions.reference ? fromUuidSync(rollOptions.reference) : null;
  const effect = effectOf(card);
  if (!effect) return;
  for (const b of saveBonuses(actor, saveId, effect)) {
    rollOptions.parts ??= [];
    rollOptions.parts.push(`${b.value}[${b.label}]`);
  }
});
