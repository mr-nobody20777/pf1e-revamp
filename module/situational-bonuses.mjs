// Situational bonuses (conditional bonuses, phase 2A): a bonus that applies only in a situation ("+1 on attack
// rolls when flanking", "+2 to trip", "+N on attacks and damage when at negative hit points"). PF1 prints these
// notes as reminders; here the situations the module can check are checked, in the roll window. Rules map:
// fundamentals > conditional bonuses (engine 1 of the scan). Rulings: DECISIONS.md, "Situational bonuses".
//
// One library of situations (SITUATIONS): each recognizes its wording and checks the roll (attack window
// flags, the attacker's and targets' conditions and hit points, tokens around, the maneuver chosen). A note
// whose situation is recognized becomes a roll-window entry that applies when the situation holds; one with a
// situation the module can't check is listed Not Applied, to tick. Notes about creatures (creature-bonuses.mjs)
// and saves against kinds of effects (save-bonuses.mjs) stay with those readers; features the module already
// automates (util.handledFeature) are skipped, so nothing counts twice.

import { MODULE_ID, MELEE_ATTACKS } from "./const.mjs";
import { evaluate, handledFeature, tokenDistance, notesOf } from "./util.mjs";
import { registerRollEffect, highestOfType } from "./roll-effects.mjs";
import { TYPE_WORDS, noteLines } from "./save-bonuses.mjs";
import { mentionsCreatures } from "./creature-types.mjs";
import { specialMaterial } from "./magic-arms.mjs";
import { isRaging } from "./defenses.mjs";

const MANEUVERS = { grapple: /\bgrappl\w*/, trip: /\btrip(s|ping)?\b/, disarm: /\bdisarm\w*/, sunder: /\bsunder\w*/, bullRush: /\bbull rush\w*/, overrun: /\boverrun\w*/, reposition: /\breposition\w*/, drag: /\bdrag(s|ging)?\b/, dirtyTrick: /\bdirty tricks?\b/, steal: /\bsteal(s|ing)?\b/ };
// Armor that isn't metal (PF1's armor has no material field for its base): by name or base type; dragonhide
// and darkwood armor aren't metal either
const NONMETAL_ARMOR = /\b(leather|hide|padded|quilted|silken|rosewood|wooden|horn lamellar|stone lamellar|leather lamellar)\b/i;
export function wearsMetalArmor(actor) {
  return actor.itemTypes.equipment.some((e) => {
    if (!e.system.equipped || e.system.subType !== "armor") return false;
    if (["dragonhide", "darkwood"].includes(specialMaterial(e)?.id)) return false;
    return ![e.name, ...(e.system.baseTypes ?? [])].some((n) => NONMETAL_ARMOR.test(n));
  });
}
const TARGET_CONDITIONS = ["grappled", "prone", "helpless", "stunned", "blinded", "entangled", "dazzled", "shaken", "frightened", "sickened", "flat-footed", "bleeding"];
const STATUS = { blinded: "blind", "flat-footed": "flatFooted", bleeding: "bleed" };

/** The tokens of the roller and its targets, and the roll's window flags. */
function context(actor, roll) {
  const token = actor.getActiveTokens?.()[0] ?? null;
  const targets = Array.from(game.user.targets ?? []).filter((t) => t.actor);
  return { actor, roll, token, targets, flags: roll.flags ?? {} };
}
const hp = (actor) => actor.system.attributes?.hp ?? {};
const friendsNear = (ctx, feet, { conscious = true } = {}) => {
  if (!ctx.token) return null;
  return canvas.tokens.placeables.some((t) => t !== ctx.token && t.actor && t.document.disposition === ctx.token.document.disposition && (!conscious || !t.actor.statuses.has("unconscious")) && !t.actor.statuses.has("dead") && tokenDistance(ctx.token, t) <= feet);
};

// Each: test(text) → match or null; check(ctx, match) → true, false, or null (can't tell); label(match).
export const SITUATIONS = [
  { id: "flanking", test: (t) => t.match(/\bflank(ing|ed)?\b/), check: (c) => (c.roll.kind === "attack" ? !!c.flags.flanking : null), label: () => "when flanking" },
  { id: "charging", test: (t) => t.match(/\bcharg(e|es|ing)\b/), check: (c) => (c.roll.kind === "attack" ? !!c.flags.charge : null), label: () => "when charging" },
  { id: "raging", test: (t) => t.match(/\b(while |when )?(raging|in a rage)\b/), check: (c) => isRaging(c.actor), label: () => "while raging" },
  { id: "negativeHp", test: (t) => t.match(/\bat negative hit points|below 0 hit points\b/), check: (c) => (hp(c.actor).value ?? 0) < 0, label: () => "at negative hit points" },
  { id: "halfHp", test: (t) => t.match(/\b(at or )?below half (your |its |his |her )?(hit points|hp|maximum hit points)\b/), check: (c) => (hp(c.actor).value ?? 0) <= (hp(c.actor).max ?? 0) / 2, label: () => "at or below half hit points" },
  { id: "noAllyNear", test: (t) => t.match(/\bno (conscious )?all(y|ies) within (\d+) f(ee)?t/), check: (c, m) => { const near = friendsNear(c, Number(m[3]), { conscious: !!m[1] }); return near === null ? null : !near; }, label: (m) => `with no${m[1] ? " conscious" : ""} ally within ${m[3]} feet` },
  { id: "allyAdjacent", test: (t) => t.match(/\b(an )?adjacent all(y|ies)\b|\ball(y|ies) (is |are )?adjacent\b/), check: (c) => friendsNear(c, 5, { conscious: false }), label: () => "with an ally adjacent" },
  { id: "targetCondition", test: (t) => t.match(new RegExp(`\\b(against|vs\\.?) (an? )?(${TARGET_CONDITIONS.join("|")}) (foe|foes|opponent|opponents|creature|creatures|target|targets|enem(y|ies))\\b`)), check: (c, m) => (c.targets.length ? c.targets.every((t) => t.actor.statuses.has(STATUS[m[3]] ?? m[3])) : null), label: (m) => `against ${m[3]} foes` },
  // Shocking Grasp: "if the opponent is wearing metal armor" (a metal weapon or a creature made of metal: tick it)
  { id: "metalArmor", test: (t) => t.match(/\b(if|when|against) (the |an? )?(opponent|target|foe|creature) (is )?wearing metal armor\b/), check: (c) => (c.targets.length ? c.targets.every((t) => wearsMetalArmor(t.actor)) : null), label: () => "against a foe in metal armor" },
  { id: "maneuver", test: (t) => { const id = Object.keys(MANEUVERS).find((k) => MANEUVERS[k].test(t)); return id ? [t.match(MANEUVERS[id])[0], id] : null; }, check: (c, m) => (c.roll.maneuver ? c.roll.maneuver === m[1] : null), label: (m) => `to ${m[1].replace(/[A-Z]/g, (ch) => ` ${ch.toLowerCase()}`)}` },
];

/** The situations a note's wording names: [{ situation, match }], and whether anything else conditions it. */
export function situationsIn(text) {
  const t = text.toLowerCase();
  const found = [];
  for (const s of SITUATIONS) {
    const m = s.test(t);
    if (m) found.push({ situation: s, match: m });
  }
  return found;
}

const NOTE = /([+-])?\s*\[\[\s*(.+?)\s*\]\]\s*([A-Za-z]+)?\s*(.*)$/;
// The plain wording of a bonus: anything else in a note is a condition
const FRAME = /^(bonus(es)?|penalty|penalties|on|to|all|the|your|any|a|an|melee|ranged|weapon|attack|attacks|rolls?|checks?|ac|armor|class|combat|maneuver|cmb|cmd|and|damage|made|make|perform|attempts?|skill|it|saves?|saving|throws?|n|when|while|whenever|if|against|vs|you|are|is|at|or|with|in|by|of|that|who|as|for|morale|competence|luck|insight|sacred|profane|dodge|circumstance|racial|trait|untyped)$/;
const parsed = new Map();
/** "+[[1]] on attack rolls when flanking." → { formula, type, part, rest, situations } or null (not situational). */
function parseLine(line) {
  if (parsed.has(line)) return parsed.get(line);
  let out = null;
  const m = line.match(NOTE);
  // Notes about creatures, and saves against kinds of effects, have their own readers
  if (m && !mentionsCreatures(m[4] ?? "")) {
    const typeWord = (m[3] ?? "").toLowerCase();
    // The words after the bonus, with the type word unless it's a bonus type ("+[[4]] to jump": "to" isn't one)
    const rest = `${TYPE_WORDS[typeWord] ? "" : `${m[3] ?? ""} `}${m[4] ?? ""}`.trim();
    const situations = situationsIn(rest);
    // Anything left once the recognized situations and a bonus's plain wording are taken out is a condition
    // the module can't check: then the note stays to tick, even when part of it is recognized
    let left = rest.toLowerCase();
    for (const { match } of situations) left = left.replace(match[0], " ");
    const unchecked = left.replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).some((w) => !FRAME.test(w));
    // Situational when anything is left beyond the plain wording of a bonus ("+[[2]] Competence on attack
    // rolls" isn't: PF1 already counts it)
    const conditional = situations.length || rest.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).some((w) => !FRAME.test(w));
    if (conditional) {
      out = {
        formula: `${m[1] === "-" ? "-" : ""}(${m[2]})`,
        type: TYPE_WORDS[typeWord] ?? "untyped",
        part: /\bdamage\b/i.test(rest) && !/\battack\b/i.test(rest) ? "dmg" : "atk",
        both: /\battack(s)?( rolls?)? and damage\b/i.test(rest),
        rest,
        situations,
        unchecked,
      };
    }
  }
  parsed.set(line, out);
  return out;
}

/** The note targets for a roll. */
function noteTargets(roll) {
  if (roll.kind === "attack") {
    const t = roll.action.actionType;
    if (["mcman", "rcman"].includes(t)) return ["cmb"];
    const out = ["attack"];
    if (MELEE_ATTACKS.includes(t)) out.push("melee", "meleeWeapon"); else out.push("ranged", "rangedWeapon");
    return out;
  }
  if (roll.kind === "skill") return ["skills", `skill.${roll.skillId.split(".")[0]}`, `skill.${roll.skillId}`];
  return [];
}

const provider = {
  collect(actor, roll) {
    const targets = noteTargets(roll);
    if (!targets.length) return [];
    const ctx = context(actor, roll);
    const out = [];
    for (const item of actor.items) {
      const notes = notesOf(item);
      if (item.isActive === false || !notes.length || handledFeature(item)) continue;
      for (const note of notes) {
        if (!targets.includes(note.target)) continue;
        // A note on a spell or other item about its own attack (Shocking Grasp): only when that item rolls
        if (note.self && roll.action?.item !== item) continue;
        for (const line of noteLines(note.text ?? "")) {
          const p = parseLine(line);
          if (!p) continue;
          const value = evaluate(p.formula, item);
          if (!value) continue;
          const parts = roll.kind === "attack" ? (p.both ? ["atk", "dmg"] : [p.part]) : ["roll"];
          const results = p.situations.map(({ situation, match }) => ({ label: situation.label(match), ok: situation.check(ctx, match) }));
          const known = p.situations.length && !p.unchecked && results.every((r) => r.ok !== null);
          const applies = known && results.every((r) => r.ok);
          const above = value > 0 ? value - highestOfType(actor, roll, p.type) : value;
          const entry = { id: `situational.${item.id}.${note.target}.${line.length}`, label: item.name, part: item.name, type: p.type, tooltip: line.replace(/\[\[|\]\]/g, "") };
          for (const part of parts) entry[part] = above > 0 || value < 0 ? (value < 0 ? value : above) : value;
          if (!p.situations.length || !known) out.push({ ...entry, applies: false, reason: `${p.rest.replace(/\[\[|\]\]/g, "").replace(/\.$/, "")}: tick it if that applies` });
          else if (!applies) out.push({ ...entry, applies: false, reason: `only ${results.filter((r) => !r.ok).map((r) => r.label).join(" and ")}` });
          else if (value > 0 && above <= 0) out.push({ ...entry, applies: false, reason: `a higher ${p.type} bonus already applies` });
          else out.push({ ...entry, applies: true });
        }
      }
    }
    return out;
  },
};
registerRollEffect(provider);

export const _test = { parseLine, situationsIn, SITUATIONS, collect: provider.collect };
