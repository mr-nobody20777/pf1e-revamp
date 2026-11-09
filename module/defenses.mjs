// Damage reduction, energy resistance and immunities granted by features. PF1 keeps these on the actor
// (traits.dr, traits.eres, traits.di, traits.ci) and its Apply Damage dialog uses them, but almost no
// class feature or template fills them in: Barbarian Damage Reduction, Diamond Body, Divine Health, the
// bloodline resistances and the templates' DR and resistances are text only.
//
// Grants come from two places, applied while the actor is prepared (nothing is written to the actor, so
// removing the feature removes the trait):
//   - flags["pf1e-revamp"].grants on the module's own items, racial traits and aura buffs (formulas on
//     the class level, with min/max levels);
//   - DEFENSES below: PF1's own features and templates, by compendium source or exact name, each checked
//     against its text. Some depend on a choice ("your energy type"), on raging, or on wearing armor.
//
// DR follows the rules rather than PF1's dialog: "If a creature has damage reduction from more than one
// source, the two forms of damage reduction do not stack. Instead, the creature gets the benefit of the
// best damage reduction in a given situation." PF1 subtracts every DR that applies; here only the one
// that stops the most damage counts. DR that applies only to some damage (Death's Gift: "DR 5/— against
// nonlethal damage") is kept apart from PF1's entries and reduces only that damage.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { evaluate, classLevel, esc, titleFor, wrapMethod } from "./util.mjs";

const PF1 = "Compendium.pf1.class-abilities.Item.";
const TPL = "Compendium.pf1.monster-templates.Item.";
const ENERGIES = { acid: "acid", cold: "cold", electric: "electricity", fire: "fire", sonic: "sonic" };
const OURS = Symbol("pf1eRevampGrant"); // marks entries this module added to a prepared actor
const CHOICE = "energyType"; // actor flag { draconic, elemental } or item flag (rage power): an energy id

/* -------------------------------------------- */
/*  Grants                                      */
/* -------------------------------------------- */

// Grant helpers: { trait: "dr" | "eres" | "di" | "ci" | "immune", ... }
const dr = (amount, a = "", b = "", { and = false, against = null } = {}) => ({ trait: "dr", amount, types: [a, b], operator: !and, against });
const resist = (amount, ...types) => types.map((type) => ({ trait: "eres", type, amount }));
const di = (...types) => types.map((type) => ({ trait: "di", type }));
const ci = (...types) => types.map((type) => ({ trait: "ci", type }));
// Immunities PF1 has no option for (charm, compulsion), honored by the spell rows (spells.mjs)
const immune = (...types) => types.map((type) => ({ trait: "immune", type }));
const byHD = (hd, low, mid, high) => (hd >= 11 ? high : hd >= 5 ? mid : low);
// Celestial, fiendish, entropic, resolute and shadow creature templates: "Hit Dice | Resist | DR" tables
const planarTemplate = (energies, drType) => (actor) => {
  const hd = actor.system.attributes?.hd?.total ?? 0;
  return [...resist(byHD(hd, 5, 10, 15), ...energies), ...(hd >= 5 ? [dr(hd >= 11 ? 10 : 5, drType)] : [])];
};
// Half-celestial and half-fiend: "DR 5/magic (if HD 11 or less) or 10/magic (if HD 12 or more)"
const halfDR = (actor) => dr((actor.system.attributes?.hd?.total ?? 0) >= 12 ? 10 : 5, "magic");

/**
 * PF1 features and templates: grants(level, actor, item) → grants. `level` is the class level (classTags,
 * the item's own class first) or, for templates, unused (they read Hit Dice). `choice`: the grant needs an
 * energy type ("draconic"/"elemental" per bloodline on the actor, "item" per copy of the item).
 * `when`: "rage" (an active rage buff) or "armor" (armor worn or a shield used).
 */
const DEFENSES = {
  // Classes
  barbarianDR: {
    sources: [`${PF1}RENIeTVjWB7Mq6Mw`], names: ["damage reduction"], classTags: ["barbarian", "bloodrager"],
    // "At 7th level ... Subtract 1 ... At 10th level, and every three class levels thereafter (13th, 16th, and 19th level), this damage reduction rises by 1 point."
    grants: (level) => (level >= 7 ? [dr(1 + Math.floor((level - 7) / 3))] : []),
  },
  rageEnergyResistance: {
    sources: [`${PF1}4SnRYolTwZqq5Nbw`], classTags: ["barbarian", "skald"], choice: "item", when: "rage",
    // "While raging ... resistance to one energy type ... equal to 1/2 her barbarian level (minimum 1)"
    grants: (level, actor, item, energy) => resist(Math.max(1, Math.floor(level / 2)), energy),
  },
  armorMastery: { sources: [`${PF1}NwTe1Q2utlsmOAqK`], names: ["armor mastery"], when: "armor", grants: () => [dr(5)] },
  diamondBody: { sources: [`${PF1}nRffrQSKTqjeBAO5`], names: ["diamond body"], grants: () => ci("poison") },
  purityOfBody: { sources: [`${PF1}82G7gl4C1AvtSHI4`], names: ["purity of body"], grants: () => ci("disease") },
  perfectSelf: { sources: [`${PF1}NNEU7hzPSu2LTyZv`], names: ["perfect self"], grants: () => [dr(10, "chaotic")] },
  divineHealth: { sources: [`${PF1}C5tWPm12qyz5ND9u`], names: ["divine health"], grants: () => ci("disease") },
  auraOfCourage: { sources: [`${PF1}RNIkkvqaq2iVrahs`], grants: () => ci("fear") },
  auraOfResolve: { sources: [`${PF1}jiBCmy0kP1Uwaz0D`], grants: () => immune("charm") },
  auraOfRighteousness: { sources: [`${PF1}iFq0EX4yovswIox9`], grants: () => [dr(5, "evil"), ...immune("compulsion")] },
  holyChampion: { sources: [`${PF1}BPRtCoYTMDwsITXJ`], names: ["holy champion"], grants: () => [dr(10, "evil")] },
  auraOfDepravity: { sources: [`${PF1}LkbGAZaa2KDrnS89`], grants: () => [dr(5, "good")] },
  unholyChampion: { sources: [`${PF1}aqB7IymBc8kzJbzQ`], names: ["unholy champion"], grants: () => [dr(10, "good")] },
  venomImmunity: { sources: [`${PF1}yzmKDxR63yS5fqlc`], names: ["venom immunity"], grants: () => ci("poison") },
  poisonImmunity: { sources: [`${PF1}tflIOhX6ukxtwXLx`], names: ["poison immunity"], grants: () => ci("poison") },

  // Sorcerer bloodlines (3rd and 9th level)
  celestialResistances: { sources: [`${PF1}DuEqvGxKmWHYxQYf`], names: ["celestial resistances"], classTags: ["sorcerer"], grants: (l) => resist(l >= 9 ? 10 : 5, "acid", "cold") },
  infernalResistances: { sources: [`${PF1}duTYxfPMR1dCmpd8`], names: ["infernal resistances"], classTags: ["sorcerer"], grants: (l) => resist(l >= 9 ? 10 : 5, "fire") },
  demonResistances: { sources: [`${PF1}Q0rRzB0zUWSPM3JC`], names: ["demon resistances"], classTags: ["sorcerer"], grants: (l) => resist(l >= 9 ? 10 : 5, "electric") },
  dragonResistances: { sources: [`${PF1}zRjCUXkADqaG0hXj`], names: ["dragon resistances"], classTags: ["sorcerer"], choice: "draconic", grants: (l, a, i, e) => resist(l >= 9 ? 10 : 5, e) },
  elementalResistance: { sources: [`${PF1}g9SoLRJqSd2uvkG3`], names: ["elemental resistance"], classTags: ["sorcerer"], choice: "elemental", grants: (l, a, i, e) => resist(l >= 9 ? 20 : 10, e) },
  // "resist cold 5 and DR 5/— against nonlethal damage. At 9th level ... cold increases to 10 and your DR increases to 10/— against nonlethal damage"
  deathsGift: { sources: [`${PF1}2ESYqnwxo4KCJo9y`], names: ["death's gift"], classTags: ["sorcerer"], grants: (l) => [...resist(l >= 9 ? 10 : 5, "cold"), dr(l >= 9 ? 10 : 5, "", "", { against: "nonlethal" })] },

  // Sorcerer bloodlines (20th level)
  powerOfWyrms: { sources: [`${PF1}4OmrOhnYAx5N5eEf`], names: ["power of wyrms"], choice: "draconic", grants: (l, a, i, e) => [...ci("paralyze", "sleep"), ...di(e)] },
  elementalBody: { sources: [`${PF1}r1hLFYVGSEoSc50J`], names: ["elemental body"], choice: "elemental", grants: (l, a, i, e) => di(e) },
  demonicMight: { sources: [`${PF1}nRASOVnnyC6FJRMV`], names: ["demonic might"], grants: () => [...di("electric"), ...ci("poison"), ...resist(10, "acid", "cold", "fire")] },
  powerOfThePit: { sources: [`${PF1}wzNzs5M71JUjktPz`], names: ["power of the pit"], grants: () => [...di("fire"), ...ci("poison"), ...resist(10, "acid", "cold")] },
  ascension: { sources: [`${PF1}KR6Hhz4S7ZIegQCx`], names: ["ascension"], grants: () => [...di("acid", "cold"), ...ci("petrify"), ...resist(10, "electric", "fire")] },
  oneOfUs: { sources: [`${PF1}kmzlhIa95bmIPeqS`], names: ["one of us"], grants: () => [...di("cold", "nonlethal"), ...ci("paralyze", "sleep"), dr(5)] },
  ghoulishAspect: { sources: [`${PF1}slKmIjoW9lM4cElS`], names: ["ghoulish aspect"], grants: () => [...di("cold", "nonlethal"), ...ci("paralyze", "sleep"), dr(5)] },
  oneWithAbaddon: { sources: [`${PF1}SlM3VLHOaz2PEoWn`], names: ["one with abaddon"], grants: () => [...di("acid"), ...ci("deathEffects", "poison"), dr(5, "good", "silver"), ...resist(10, "cold", "electric", "fire")] },
  ahrimansFavor: { sources: [`${PF1}vHCBG0nYJgLZNTZn`], names: ["ahriman's favor"], grants: () => [...di("fire"), ...ci("poison"), ...resist(10, "acid", "electric")] },
  soulOfTheFey: { sources: [`${PF1}NI7RFZwJVmjvRwDF`], names: ["soul of the fey"], grants: () => [...ci("poison"), dr(10, "coldIron")] },
  kinToTheOldTales: { sources: [`${PF1}RbFjBdAdmMH1L6Qw`], names: ["kin to the old tales"], grants: () => [dr(10, "coldIron"), ...ci("curse", "paralyze", "sleep")] },
  aberrantForm: { sources: [`${PF1}F3X4VAPZQdCLlmAi`], names: ["aberrant form"], grants: () => [dr(5)] },
  amorphousAnatomy: { sources: [`${PF1}NbOLd4FQjf14RlYN`], names: ["amorphous anatomy"], grants: () => [dr(5)] },
  warlordReborn: { sources: [`${PF1}X1x6gUALY07XDXH8`], names: ["warlord reborn"], grants: () => [...di("fire"), dr(5)] },
  reforgedFlesh: { sources: [`${PF1}kgZzH6DtC5ZJQWJg`], names: ["reforged flesh"], grants: () => [...di("fire"), dr(10, "adamantine", "magic", { and: true })] },
  strengthOfStone: { sources: [`${PF1}YHhf6okxoTLjXnzx`], names: ["strength of stone"], grants: () => [dr(10, "adamantine"), ...ci("petrify")] },
  deepOne: { sources: [`${PF1}LVtu2aNKQYf0JSLX`], names: ["deep one"], grants: () => [dr(10, "piercing"), ...resist(20, "cold")] },
  ectoplasmicBody: { sources: [`${PF1}kvYaYS0QR7EqtWfy`], names: ["ectoplasmic body"], grants: () => [dr(5, "slashing")] },
  livingSwarm: { sources: [`${PF1}5sQAL158axJfpCyA`], names: ["living swarm"], grants: () => [...ci("bleed", "disease", "poison"), dr(5)] },
  avatarOfChaos: { sources: [`${PF1}8j7ZHXPxAnimTyeN`], names: ["avatar of chaos"], grants: () => [...di("acid"), ...ci("petrify", "polymorph")] },
  eternalMartyr: { sources: [`${PF1}DK1SZXArTQplPxq5`], names: ["eternal martyr"], grants: () => ci("deathEffects") },
  immortalLegend: { sources: [`${PF1}QkgfCYsBbVxiFNe6`], names: ["immortal legend"], grants: () => ci("deathEffects", "energyDrain") },
  livingParadox: { sources: [`${PF1}LA1jZxo4pXpxa2Yi`], names: ["living paradox"], grants: () => ci("disease", "poison") },
  starborn: { sources: [`${PF1}LZQlH31QpfQQPNFB`], names: ["starborn"], grants: () => [...di("cold"), ...ci("blind")] },
  stormLord: { sources: [`${PF1}RlPdvYW5xFgPfGbL`], names: ["storm lord"], grants: () => ci("deaf", "stun") },
  grandMaestro: { sources: [`${PF1}HSa7LF5k1v4QwYt2`], names: ["grand maestro"], grants: () => di("sonic") },
  shepherdOfTheTrees: { sources: [`${PF1}gMquslK2uPQHrLoC`], names: ["shepherd of the trees"], grants: () => ci("paralyze", "poison", "polymorph", "sleep", "stun") },
  childOfAncientWinters: { sources: [`${PF1}aTjaaocVc3aYsJPg`], names: ["child of ancient winters"], grants: () => ci("fatigue", "exhausted") },
  dualSpirit: { sources: [`${PF1}qJ7ubLyKJCalOBKQ`], names: ["dual spirit"], grants: () => ci("mindAffecting") },
  blessing: { sources: [`${PF1}oQgLbgApcLbll9Cy`], grants: () => [...ci("poison"), ...immune("charm")] },

  // Templates
  celestial: { sources: [`${TPL}8kHcvgFNoGObDhQ8`], template: true, grants: (l, actor) => planarTemplate(["acid", "cold", "electric"], "evil")(actor) },
  fiendish: { sources: [`${TPL}kDaBd3zlTauG2f9n`], template: true, grants: (l, actor) => planarTemplate(["cold", "fire"], "good")(actor) },
  entropic: { sources: [`${TPL}pF1B9lqYMsFF7mie`], template: true, grants: (l, actor) => planarTemplate(["acid", "fire"], "lawful")(actor) },
  resolute: { sources: [`${TPL}cNJjgY50ypSjk2zk`], template: true, grants: (l, actor) => planarTemplate(["acid", "cold", "fire"], "chaotic")(actor) },
  shadowCreature: { sources: [`${TPL}yvYkW2QIxFIvStcu`], template: true, grants: (l, actor) => planarTemplate(["cold", "electric"], "magic")(actor) },
  halfCelestial: { names: ["half-celestial"], template: true, grants: (l, actor) => [...ci("disease"), ...resist(10, "acid", "cold", "electric"), halfDR(actor)] },
  halfFiend: { names: ["half-fiend"], template: true, grants: (l, actor) => [...ci("poison"), ...resist(10, "acid", "cold", "electric", "fire"), halfDR(actor)] },
  vampire: { names: ["vampire"], template: true, grants: () => [dr(10, "magic", "silver", { and: true }), ...resist(10, "cold", "electric")] },
  lich: { names: ["lich"], template: true, grants: () => [dr(15, "bludgeoning", "magic", { and: true }), ...di("cold", "electric")] },
  skeleton: { names: ["skeleton"], template: true, grants: () => [dr(5, "bludgeoning"), ...di("cold")] },
  zombie: { names: ["zombie"], template: true, grants: () => [dr(5, "slashing")] },
};

const BY_SOURCE = new Map();
const BY_NAME = new Map();
for (const [key, def] of Object.entries(DEFENSES)) {
  for (const s of def.sources ?? []) BY_SOURCE.set(s, key);
  for (const n of def.names ?? []) BY_NAME.set(n, key);
}

/** The DEFENSES entry for a PF1 item, or null. Templates must be template feats. */
export function defenseKey(item) {
  if (item?.type !== "feat") return null;
  const key = BY_SOURCE.get(item._stats?.compendiumSource) ?? BY_NAME.get(item.name.toLowerCase()) ?? null;
  if (!key) return null;
  return !!DEFENSES[key].template === (item.system.subType === "template") ? key : null;
}

function levelOf(item, def) {
  for (const tag of [item.system.class, ...(def.classTags ?? [])].filter(Boolean)) {
    const level = classLevel(item, tag);
    if (level) return level;
  }
  return 0;
}

const RAGE = /^(rage|bloodrage|inspired rage|rage \(|raging song: inspired rage)/i;
function conditionMet(actor, when) {
  if (when === "rage") return actor.itemTypes.buff.some((b) => b.isActive && RAGE.test(b.name));
  if (when === "armor") return actor.itemTypes.equipment.some((e) => e.system.equipped && ["armor", "shield"].includes(e.system.subType));
  return true;
}

/** The energy type an item's grant uses, or null if not chosen yet. */
export function energyOf(item, def = DEFENSES[defenseKey(item)]) {
  if (!def?.choice) return null;
  if (def.choice === "item") return item.flags[MODULE_ID]?.[CHOICE] ?? null;
  return item.actor?.flags[MODULE_ID]?.[CHOICE]?.[def.choice] ?? null;
}

// Flag grants' amounts depend only on formula and class level; a handful of entries at most.
const amountCache = new Map();

/** Grants from the module's own flag (formulas on the class level). */
function flagGrants(item) {
  const flags = item.flags[MODULE_ID];
  const grants = flags?.grants;
  if (!grants?.length) return [];
  const fallbackTag = (flags.levelFormula ?? "").match(/@classes\.(\w+)\.level/)?.[1] ?? "sorcerer";
  const level = classLevel(item, fallbackTag);
  const amount = (formula) => {
    const key = `${formula}|${level}`;
    if (!amountCache.has(key)) amountCache.set(key, evaluate(formula, item, { class: { level }, classes: { [fallbackTag]: { level } } }));
    return amountCache.get(key);
  };
  return grants
    .filter((g) => level >= (g.minLevel ?? 0) && level <= (g.maxLevel ?? Infinity))
    .map((g) => ({ ...g, amount: g.amount ? amount(g.amount) : null }));
}

/** Everything an item grants right now: [] when inactive, its condition unmet or its choice not made. */
export function activeGrants(item) {
  if (!item.isActive) return [];
  const out = flagGrants(item);
  const key = defenseKey(item);
  if (key) {
    const def = DEFENSES[key];
    const energy = energyOf(item, def);
    if ((!def.choice || energy) && conditionMet(item.actor, def.when)) out.push(...def.grants(levelOf(item, def), item.actor, item, energy));
  }
  return out;
}

/* -------------------------------------------- */
/*  Applying them while the actor is prepared   */
/* -------------------------------------------- */

const extraImmunities = new WeakMap(); // actor → Set("charm", "compulsion")
/** Immunities PF1 has no option for (charm, compulsion spells and spell-like abilities). */
export const immunitiesOf = (actor) => extraImmunities.get(actor) ?? new Set();
const conditionalDR = new WeakMap(); // actor → [{ amount, types, operator, against }]
export const hasConditionalDR = (actor) => !!conditionalDR.get(actor)?.length;

const drKey = (e) => `${[...(e.types ?? [])].filter(Boolean).sort().join("+")}|${e.operator ? "or" : "and"}`;

// Runs on every actor preparation: one pass over feats and buffs, reading flags directly (getFlag
// validates its scope on every call) and the DEFENSES maps.
Hooks.on("pf1PrepareDerivedActorData", (actor) => {
  const traits = actor.system.traits;
  if (!traits) return;
  const grants = [];
  for (const item of [...(actor.itemTypes?.feat ?? []), ...(actor.itemTypes?.buff ?? [])]) {
    if (!item.flags[MODULE_ID]?.grants && !(item.type === "feat" && defenseKey(item))) continue;
    for (const g of activeGrants(item)) grants.push({ ...g, source: item.name });
  }
  // A bare prepareData() keeps the arrays from last time: drop what this module added then
  traits.eres ??= { value: [], custom: "" };
  traits.dr ??= { value: [], custom: "" };
  traits.eres.value = (traits.eres.value ?? []).filter((e) => !e[OURS]);
  traits.dr.value = (traits.dr.value ?? []).filter((e) => !e[OURS]);
  const extra = new Set();
  const conditional = [];
  for (const g of grants) {
    if (g.trait === "eres") traits.eres.value.push({ amount: g.amount, operator: true, types: [g.type, ""], [OURS]: true });
    else if (g.trait === "dr" && g.against) conditional.push(g);
    else if (g.trait === "dr") traits.dr.value.push({ amount: g.amount, operator: g.operator, types: [...g.types], [OURS]: true });
    else if (g.trait === "immune") extra.add(g.type);
    else if (traits[g.trait]) {
      const trait = traits[g.trait];
      for (const set of [trait.standard, trait.total]) if (set instanceof Set) set.add(g.type);
      if (Array.isArray(trait.value) && !trait.value.includes(g.type)) trait.value.push(g.type);
    }
  }
  extraImmunities.set(actor, extra);
  conditionalDR.set(actor, conditional);
  // Resistances against the same single energy type, and DR against the same thing, don't stack: keep the
  // highest (a granted one and one typed in by hand, or two features), so PF1 can't apply both.
  traits.eres.value = bestOf(traits.eres.value, (e) => {
    const types = (e.types ?? []).filter(Boolean);
    return types.length === 1 ? types[0] : null;
  });
  traits.dr.value = bestOf(traits.dr.value, drKey);
});

/** Keep the highest entry per key (entries without a key are all kept), in their original order. */
function bestOf(entries, keyOf) {
  if (entries.length < 2) return entries;
  const best = new Map();
  for (const e of entries) {
    const key = keyOf(e);
    if (key !== null && (!best.has(key) || (e.amount ?? 0) > (best.get(key).amount ?? 0))) best.set(key, e);
  }
  return entries.filter((e) => keyOf(e) === null || best.get(keyOf(e)) === e);
}

/* -------------------------------------------- */
/*  DR in PF1's damage math                     */
/* -------------------------------------------- */

Hooks.once("setup", () => {
  const AD = "pf1.applications.ApplyDamage.prototype";

  // Death's Gift's "DR … against nonlethal damage": listed with the creature's DR while the damage has
  // that type, and only reduces that damage.
  wrapMethod(`${AD}.getResistances`, function (wrapped, actor, type) {
    const extra = type === "dr" ? conditionalDR.get(actor) ?? [] : [];
    const list = actor.system.traits?.dr?.value;
    if (!extra.length || !Array.isArray(list)) return wrapped(actor, type);
    list.push(...extra.map((g) => ({ amount: g.amount, operator: g.operator, types: [...g.types] })));
    try {
      const out = wrapped(actor, type);
      out.slice(-extra.length).forEach((entry, i) => {
        const against = extra[i].against;
        entry.against = against;
        entry.label = `${entry.label} (${against} only)`;
        entry.active &&= this.instances.some((inst) => inst.typeIds?.has(against));
      });
      return out;
    } finally {
      list.splice(-extra.length);
    }
  });
  wrapMethod(`${AD}._isReducedBy`, function (wrapped, target, instance, entry, isDR) {
    if (entry.against && !instance.typeIds?.has(entry.against)) return false;
    return wrapped(target, instance, entry, isDR);
  });

  // Only the best DR counts: try each one that applies on its own and keep the one that stops the most.
  wrapMethod(`${AD}._processReductions`, function (wrapped, target, instances, list, isDR) {
    const active = isDR ? list.filter((e) => e.active && e.value > 0) : [];
    if (active.length < 2) return wrapped(target, instances, list, isDR);
    const states = list.map((e) => e.active);
    const only = (entry) => list.forEach((e) => (e.active = e === entry));
    let best = null;
    let most = -1;
    for (const entry of active) {
      only(entry);
      const trial = instances.map((i) => ({ ...i }));
      const amount = wrapped(target, trial, list, isDR);
      if (amount > most) [best, most] = [entry, amount];
    }
    only(best);
    try {
      return wrapped(target, instances, list, isDR);
    } finally {
      list.forEach((e, i) => (e.active = states[i]));
      for (const e of active) if (e !== best) e.available = e.value; // undo the trial: it stopped nothing
    }
  });

  // An alchemical silver weapon counts as silver for DR/silver (PF1 lists them as separate materials)
  wrapMethod(`${AD}._evaluateAttack`, function (wrapped, ...args) {
    const result = wrapped(...args);
    if (this.materials?.has("alchemicalSilver")) this.materials.add("silver");
    return result;
  });
});

/* -------------------------------------------- */
/*  Energy type choice                          */
/* -------------------------------------------- */

/** Ask which energy type the item's grant uses ("your energy type", a rage power's chosen energy). */
export async function promptEnergy(item) {
  const def = DEFENSES[defenseKey(item)];
  if (!def?.choice || !item.actor) return;
  const current = energyOf(item, def);
  const what = def.choice === "item" ? item.name : `your ${def.choice} bloodline`;
  const energy = await foundry.applications.api.DialogV2.wait({
    window: { title: titleFor(`${item.name}: energy type`, item.actor) },
    content: `<p>Which energy type for ${esc(what)}?</p><select name="energy">${Object.entries(ENERGIES)
      .map(([id, label]) => `<option value="${id}" ${id === current ? "selected" : ""}>${label}</option>`)
      .join("")}</select>`,
    buttons: [
      { action: "ok", label: "Choose", default: true, callback: (event, button) => button.form.elements.energy.value },
      { action: "cancel", label: "Later" },
    ],
    rejectClose: false,
  });
  if (!ENERGIES[energy]) return;
  if (def.choice === "item") await item.setFlag(MODULE_ID, CHOICE, energy);
  else await item.actor.setFlag(MODULE_ID, `${CHOICE}.${def.choice}`, energy);
  refreshFootnotes(item);
}

Hooks.on("createItem", (item, options, userId) => {
  if (userId !== game.user.id || !item.actor || options.pf1eRevampNoPrompt) return;
  const def = DEFENSES[defenseKey(item)];
  if (def?.choice && !energyOf(item, def)) promptEnergy(item);
});

/* -------------------------------------------- */
/*  Footnotes                                   */
/* -------------------------------------------- */

const LABELS = { eres: "resistance", di: "immunity", ci: "immunity", immune: "immunity" };
const typeLabel = (t) => ENERGIES[t] ?? pf1.registry.materials?.get(t)?.name?.toLowerCase() ?? pf1.config.damageResistances?.[t]?.toLowerCase() ?? pf1.config.conditionTypes?.[t]?.toLowerCase?.() ?? t;

/** "DR 5/evil", "fire resistance 10", "poison immunity" */
export function describeGrant(g) {
  if (g.trait === "dr") {
    const types = g.types.filter(Boolean).map(typeLabel);
    return `DR ${g.amount}/${types.length ? types.join(g.operator ? " or " : " and ") : "—"}${g.against ? ` against ${g.against} damage` : ""}`;
  }
  return `${typeLabel(g.type)} ${LABELS[g.trait]}${g.amount ? ` ${g.amount}` : ""}`;
}

registerFootnote((item) => {
  const key = defenseKey(item);
  if (!key && !item.flags?.[MODULE_ID]?.grants?.length) return null;
  const def = key && DEFENSES[key];
  if (!item.actor) return [def ? "Applied automatically to the character: its damage reduction, resistances and immunities." : "Grants are applied automatically as the character levels."];
  const content = [];
  const energy = def ? energyOf(item, def) : null;
  if (def?.choice && !energy) content.push("Choose the energy type to apply it.");
  else {
    const active = activeGrants(item);
    const when = def?.when === "rage" ? " while raging" : def?.when === "armor" ? " while wearing armor or using a shield" : "";
    content.push(active.length ? `Applied automatically: ${active.map(describeGrant).join(", ")}.` : `Applied automatically${when}: nothing right now.`);
    if (active.length && when) content.push(` (Only${when}.)`);
  }
  if (def?.choice && item.isOwner) content.push(" ", footnoteButton(energy ? `${ENERGIES[energy]}: change…` : "Choose energy…", "Choose the energy type", () => promptEnergy(item)));
  return content;
});

export const _test = { DEFENSES, conditionalDR };
