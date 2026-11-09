// A creature's type and subtypes, as the rules effects in this module read them (spells that affect
// only humanoids, channel energy against undead, precision immunity, and later conditional bonuses).
//
// PF1 merges the creature types of every active item (race, class, feat, buff, equipment) into the
// actor's traits, so a template that changes the type only adds to it: a half-fiend goblin comes out as
// both humanoid and outsider. Here a template's type replaces the race's, as its text says:
//   - Type changes: "The creature's type changes to undead. It retains any subtype except for alignment
//     subtypes and subtypes that indicate kind." Each template's change is in template-types-data.mjs.
//   - Augmented subtype (Bestiary): "A creature receives this subtype when something (usually a
//     template) changes its original type... The augmented subtype is always paired with the creature's
//     original type." The creature counts only as its new type; the original type is returned as
//     `original` for effects that name it (DECISIONS.md, Creatures).
//   - "Subtypes that indicate kind" are read as species subtypes (giant, goblinoid, human...), dropped;
//     trait and origin subtypes are kept. An interpretation, so the template's footnote names what was
//     dropped, and a subtype added to the template item's own Creature Subtypes is always kept.
//   - Two templates that change the type: the module asks which one sets it (a window that must be
//     answered) and stores the answer on the actor; until then the creature's type is unknown.
// Nothing is written to the creature's items: the type is worked out when it's read.
//
// Monsters with racial Hit Dice and no race (PF1's bestiary: a Human Skeleton has "Undead" class
// levels) have their type only in that class's name, which PF1 doesn't read, so it's taken from there.
//
// Types and subtypes are compared as keys: lower case, without spaces, hyphens or underscores
// ("magicalbeast", "deepone"), so PF1's keys and free-text subtypes on race items ("Dark folk") match.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { esc, stillExists, titleFor } from "./util.mjs";
import { TEMPLATE_TYPES } from "./template-types-data.mjs";

const FLAG = "typeTemplate"; // actor flag: id of the template that sets the type when two change it
const ALIGNMENT = new Set(["chaotic", "evil", "good", "lawful"]);
// Subtypes kept by templates that drop "subtypes that indicate kind": traits and origins, not species
const NOT_KIND = new Set(["air", "aquatic", "augmented", "cold", "earth", "elemental", "extraplanar", "fire", "incorporeal", "mythic", "native", "shapechanger", "swarm", "troop", "water"]);
// Misspellings in PF1's race data (Kobold and Lizardfolk: "Reptillian")
const ALIASES = { reptillian: "reptilian" };

/** A type or subtype as a comparable key. */
export function typeKey(value) {
  const key = String(value).toLowerCase().replace(/[\s_-]+/g, "");
  return ALIASES[key] ?? key;
}

const isTemplate = (item) => item?.type === "feat" && item.system?.subType === "template";
const templateRule = (item) => (isTemplate(item) ? TEMPLATE_TYPES[item.name.toLowerCase()] ?? null : null);
const keysOf = (item, field) => {
  const value = item.system?.[field];
  return [...new Set([...(Array.isArray(value?.base) ? value.base : []), ...(value?.total ?? [])].map(typeKey))];
};

/** The type a template gives a creature whose types before it are `types`, or null if it doesn't change it. */
function newTypes(item, types) {
  const own = keysOf(item, "creatureTypes"); // set on the template item, by PF1 or the GM
  if (own.length) return own;
  const rule = templateRule(item);
  if (!rule?.type || (rule.if && !rule.if.some((t) => types.has(typeKey(t))))) return null;
  return [typeKey(rule.type)];
}

/** The type and subtypes from everything but templates: race, other items, or racial Hit Dice. */
function baseTypes(actor) {
  const types = new Set();
  const subtypes = new Set();
  for (const item of actor.items) {
    if (isTemplate(item) || item.isActive === false) continue;
    for (const key of keysOf(item, "creatureTypes")) types.add(key);
    for (const key of keysOf(item, "creatureSubtypes")) subtypes.add(key);
  }
  if (!types.size) {
    for (const cls of actor.itemTypes?.class ?? []) {
      if (cls.system.subType !== "racial") continue;
      const key = Object.entries(pf1.config.creatureTypes ?? {}).find(([, v]) => labelOf(v).toLowerCase() === cls.name.toLowerCase())?.[0];
      if (key) types.add(typeKey(key));
    }
  }
  return { types, subtypes };
}

const labelOf = (v) => game.i18n.localize(String(v?.label ?? v));

/** Active templates that change the creature's type. */
function typeChangers(actor, types = baseTypes(actor).types) {
  return actor.itemTypes.feat.filter((item) => isTemplate(item) && item.isActive !== false && newTypes(item, types));
}

/**
 * A creature's types and subtypes as keys, after its templates. Also returns `original` (the types a
 * template replaced, when it gives the augmented subtype), `dropped` (subtypes a template removed),
 * `typeFrom` (the template that set the type) and `unresolved` (two templates change the type and none
 * has been chosen: the type is unknown, so `types` is empty).
 */
export function creatureTypes(actor) {
  const empty = { types: new Set(), subtypes: new Set(), original: new Set(), dropped: new Set(), typeFrom: null, unresolved: false };
  if (!actor?.items) return empty;
  const base = baseTypes(actor);
  let types = new Set(base.types);
  const subtypes = new Set(base.subtypes);
  const original = new Set();
  const dropped = new Set();
  const templates = actor.itemTypes.feat.filter((item) => isTemplate(item) && item.isActive !== false);

  const changers = templates.filter((item) => newTypes(item, base.types));
  const typeFrom = changers.length === 1 ? changers[0] : changers.find((item) => item.id === actor.getFlag(MODULE_ID, FLAG)) ?? null;
  if (changers.length > 1 && !typeFrom) return { ...empty, subtypes, unresolved: true };

  if (typeFrom) {
    const rule = templateRule(typeFrom);
    if (rule?.augmented) {
      for (const t of base.types) original.add(t);
      subtypes.add("augmented");
    }
    types = new Set(newTypes(typeFrom, base.types));
    for (const s of [...subtypes]) {
      const lose = rule?.drop === "all" || (rule?.drop === "alignment" && ALIGNMENT.has(s)) || (rule?.drop === "alignmentKind" && !NOT_KIND.has(s));
      if (lose && s !== "augmented") {
        subtypes.delete(s);
        dropped.add(s);
      }
    }
  }
  for (const item of templates) {
    const rule = templateRule(item);
    if (rule?.add && (!rule.ifAdd || rule.ifAdd.some((t) => types.has(typeKey(t))))) for (const s of rule.add) subtypes.add(typeKey(s));
    for (const s of keysOf(item, "creatureSubtypes")) {
      subtypes.add(s); // the GM's choice on the template item always counts
      dropped.delete(s);
    }
  }
  return { types, subtypes, original, dropped, typeFrom, unresolved: false };
}

/**
 * Healed by negative energy and harmed by positive energy: undead, and living creatures with negative
 * energy affinity ("The creature is alive but reacts to positive and negative energy as if it were
 * undead—positive energy harms it, negative energy heals it", dhampirs and others). Channel energy and
 * cure and inflict spells use this; effects that name undead as a type (Disrupt Undead) use the type.
 */
export function energyAsUndead(actor) {
  if (!actor) return false;
  if (creatureTypes(actor).types.has("undead")) return true;
  return actor.items.some((i) => i.type === "feat" && i.isActive !== false && /^negative energy affinity\b/i.test(i.name));
}

/* -------------------------------------------- */
/*  Creatures named in rules text               */
/* -------------------------------------------- */

// "vs Humanoids (Orc, Goblinoid)", "against monsters of the giant subtype", "vs evil creatures",
// "outsiders with the evil subtype", "humanoids with dwarf or elf subtype": the creatures a bonus is
// against. Types and subtypes listed together must both hold (a humanoid AND orc or goblinoid);
// several of one kind are alternatives. "Evil" is an alignment unless it's named as a subtype.

const ALIGNMENT_AXES = { lawful: [0, "l"], chaotic: [0, "c"], good: [1, "g"], evil: [1, "e"] };
/** Is the creature of this alignment (PF1's two-letter code: lg, cn, tn...)? Null when unknown. */
export function hasAlignment(actor, word) {
  const code = actor?.system?.details?.alignment;
  const axis = ALIGNMENT_AXES[word];
  if (!axis) return false;
  if (!code) return null;
  return code[axis[0]] === axis[1];
}

let vocabulary = null;
function words() {
  if (vocabulary) return vocabulary;
  const types = new Map();
  const subtypes = new Map();
  const add = (map, label, key) => {
    const l = label.toLowerCase();
    map.set(l, key);
    if (l.endsWith("f")) map.set(`${l.slice(0, -1)}ves`, key); // dwarf → dwarves, elf → elves
    if (!/(s|y)$/.test(l)) map.set(`${l}s`, key);
    if (l.endsWith("y")) map.set(`${l.slice(0, -1)}ies`, key);
  };
  for (const [k, v] of Object.entries(pf1.config.creatureTypes ?? {})) add(types, labelOf(v), typeKey(k));
  for (const [k, v] of Object.entries(pf1.config.creatureSubtypes ?? {})) add(subtypes, labelOf(v), typeKey(k));
  for (const w of ["gnoll", "strix", "tengu", "nagaji", "dhampir"]) add(subtypes, w, w); // subtypes PF1's list lacks
  add(subtypes, "reptillian", "reptilian");
  vocabulary = { types, subtypes };
  return vocabulary;
}

// Subtypes that are also words for energy or terrain ("fire effects", "cold weather"): they name creatures
// only next to a word like "creatures" or "subtype"
const ELEMENT_WORDS = new Set(["air", "earth", "fire", "water", "cold"]);
const CREATURE_NOUN = /\b(creatures?|subtypes?|monsters?|beings?|elementals?|outsiders?)\b/;

// Words that only frame the description; anything else (a size, a condition, "non-grachukk") makes it
// something this parser can't judge, and the caller treats the bonus as conditional.
const FILLER = /^(and|or|all|any|the|a|an|of|with|by|attacks|creatures?|monsters?|members|foes|enemies|opponents|subtypes?|types?|races?|such|made|cast|created|from)$/;

/**
 * The creatures a rules phrase names, or null if it names none or adds a condition this can't check.
 * @returns {{ types: string[], subtypes: string[], alignments: string[], text: string } | null}
 */
export function parseCreatures(phrase) {
  const { types, subtypes } = words();
  const text = phrase.toLowerCase().replace(/\[\[|\]\]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim().replace(/[.;:]+$/, "");
  const spec = { types: [], subtypes: [], alignments: [], text: phrase.trim().replace(/[.;:]+$/, "") };
  // "(orc, goblinoid)" and "with the evil subtype" name subtypes, even words that are also alignments
  const subtypeClauses = [...text.matchAll(/\(([^)]*)\)|\bwith (?:the )?([a-z ,-]+?) subtypes?\b|\bof the ([a-z ,-]+?) subtypes?\b/g)].map((m) => m[1] ?? m[2] ?? m[3]);
  let rest = text.replace(/\([^)]*\)|\bwith (?:the )?[a-z ,-]+? subtypes?\b|\bof the [a-z ,-]+? subtypes?\b/g, " ");
  for (const clause of subtypeClauses) {
    for (const w of clause.split(/\s*(?:,|\bor\b|\band\b)\s*/).map((s) => s.trim()).filter(Boolean)) {
      const key = subtypes.get(w) ?? subtypes.get(w.replace(/s$/, ""));
      if (!key) return null;
      spec.subtypes.push(key);
    }
  }
  const tokens = rest.split(/[\s,]+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const two = `${tokens[i]} ${tokens[i + 1] ?? ""}`;
    if (types.has(two)) { spec.types.push(types.get(two)); i++; continue; } // "magical beast", "monstrous humanoid"
    const w = tokens[i];
    if (ALIGNMENT_AXES[w]) spec.alignments.push(w);
    else if (types.has(w)) spec.types.push(types.get(w));
    else if (subtypes.has(w)) spec.subtypes.push(subtypes.get(w));
    else if (!FILLER.test(w)) return null;
  }
  if (!spec.types.length && !spec.alignments.length && spec.subtypes.every((t) => ELEMENT_WORDS.has(t)) && !CREATURE_NOUN.test(text)) return null; // "vs fire effects"
  return spec.types.length || spec.subtypes.length || spec.alignments.length ? spec : null;
}

/** Does a rules phrase name any creature type, subtype or alignment at all? */
export function mentionsCreatures(phrase) {
  const { types, subtypes } = words();
  const tokens = phrase.toLowerCase().replace(/[’']/g, "'").split(/[^a-z'-]+/).filter(Boolean);
  const noun = CREATURE_NOUN.test(phrase.toLowerCase());
  return tokens.some((w, i) => ALIGNMENT_AXES[w] || types.has(w) || types.has(`${w} ${tokens[i + 1]}`) || (subtypes.has(w) && (noun || !ELEMENT_WORDS.has(subtypes.get(w)))));
}

/** Does the creature fit the description? Null when its type or alignment needed for it is unknown. */
export function matchesCreatures(actor, spec) {
  if (!actor || !spec) return null;
  const read = creatureTypes(actor);
  if ((spec.types.length || spec.subtypes.length) && (read.unresolved || !read.types.size)) return null;
  if (spec.types.length && !spec.types.some((t) => read.types.has(t))) return false;
  if (spec.subtypes.length && !spec.subtypes.some((t) => read.subtypes.has(t))) return false;
  if (spec.alignments.length) {
    const results = spec.alignments.map((a) => hasAlignment(actor, a));
    if (!results.some(Boolean)) return results.includes(null) ? null : false;
  }
  return true;
}

/* -------------------------------------------- */
/*  Two templates that change the type          */
/* -------------------------------------------- */

/** Ask which template sets the type, until answered (only when two or more change it and none is chosen). */
export async function askTypeTemplate(actor) {
  for (;;) {
    if (!stillExists(actor)) return;
    const changers = typeChangers(actor);
    if (changers.length < 2 || changers.some((item) => item.id === actor.getFlag(MODULE_ID, FLAG))) return;
    const chosen = await foundry.applications.api.DialogV2.wait({
      window: { title: titleFor("Which template sets the creature type?", actor) },
      modal: true,
      content: `<p>${changers.map((t) => `<strong>${esc(t.name)}</strong>`).join(" and ")} each change this creature's type, and a creature has only one type. Choose the template that sets it; the others still apply their other changes.</p>`,
      buttons: changers.map((item) => ({ action: item.id, label: item.name, callback: () => item.id })),
      rejectClose: false,
    });
    if (chosen && actor.items.has(chosen)) {
      await actor.setFlag(MODULE_ID, FLAG, chosen);
      for (const item of changers) refreshFootnotes(item);
      return;
    }
  }
}

/** Change which template sets the type (from the footnote). */
async function chooseTypeTemplate(actor) {
  await actor.unsetFlag(MODULE_ID, FLAG);
  return askTypeTemplate(actor);
}

// Adding a template, or turning one on, can make two templates change the type
Hooks.on("createItem", (item, options, userId) => {
  if (userId === game.user.id && item.actor && isTemplate(item) && !options.pf1eRevampNoPrompt) askTypeTemplate(item.actor);
});
Hooks.on("updateItem", (item, changes, options, userId) => {
  if (userId === game.user.id && item.actor && isTemplate(item) && !options.pf1eRevampNoPrompt && foundry.utils.hasProperty(changes, "system.disabled")) askTypeTemplate(item.actor);
});
// Removing the chosen template clears the choice
Hooks.on("deleteItem", (item, options, userId) => {
  if (userId === game.user.id && item.actor && item.actor.getFlag(MODULE_ID, FLAG) === item.id) item.actor.unsetFlag(MODULE_ID, FLAG);
});

/* -------------------------------------------- */
/*  Footnote                                    */
/* -------------------------------------------- */

const typeLabel = (key) => {
  const entry = Object.entries(pf1.config.creatureTypes ?? {}).find(([k]) => typeKey(k) === key);
  return entry ? labelOf(entry[1]).toLowerCase() : key;
};
const subtypeLabel = (key) => {
  const entry = Object.entries(pf1.config.creatureSubtypes ?? {}).find(([k]) => typeKey(k) === key);
  return entry ? labelOf(entry[1]).toLowerCase() : key;
};

registerFootnote((item) => {
  const actor = item.actor;
  if (!actor || !isTemplate(item) || item.isActive === false) return null;
  const rule = templateRule(item);
  const changes = !!newTypes(item, baseTypes(actor).types);
  if (!rule && !changes) return null;
  const read = creatureTypes(actor);
  const content = [];
  if (read.unresolved && changes) {
    content.push(`${typeChangers(actor).map((t) => t.name).join(" and ")} both change this creature's type, so its type is unknown until one is chosen.`);
    if (item.isOwner) content.push(footnoteButton("Choose…", "Choose the template that sets the creature type", () => askTypeTemplate(actor)));
    return content;
  }
  if (read.typeFrom === item) {
    const subs = [...read.subtypes].map(subtypeLabel);
    const was = read.original.size ? ` (augmented ${[...read.original].map(typeLabel).join(", ")})` : "";
    content.push(`Creature type: ${[...read.types].map(typeLabel).join(", ")}${subs.length ? ` (${subs.join(", ")})` : ""}${was}.`);
    if (read.dropped.size) {
      content.push(` Subtypes dropped by this template: ${[...read.dropped].map(subtypeLabel).join(", ")}. To keep one, add it to this template's Creature Subtypes (Details tab).`);
    }
    if (typeChangers(actor).length > 1 && item.isOwner) content.push(footnoteButton("Change…", "Choose another template to set the creature type", () => chooseTypeTemplate(actor)));
  } else if (changes) {
    content.push(`This template's type change doesn't apply: ${read.typeFrom?.name ?? "another template"} sets the creature type.`);
    if (item.isOwner) content.push(footnoteButton("Change…", "Choose another template to set the creature type", () => chooseTypeTemplate(actor)));
  } else if (rule?.add?.length) {
    content.push(`Adds the ${rule.add.map((s) => subtypeLabel(typeKey(s))).join(" and ")} subtype${rule.add.length > 1 ? "s" : ""}.`);
  }
  if (rule?.note) content.push(` ${rule.note}`);
  return content.length ? content : null;
});
