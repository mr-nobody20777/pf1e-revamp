// Magic arms and armor: a "Magic & Materials" panel in the Details tab of weapons, armor and shields,
// modelled on PF2e's runes panel. It lists the item's special abilities (qualities), checks them against
// the rules, works out the price, names the item, and applies what its special material changes.
// Rulings: DECISIONS.md, "Weapon qualities" and "Magic arms and materials". Rules map: magic-arms area.
//
// Rules (Core Rulebook, Ultimate Equipment; verbatim where quoted):
//   - "A single weapon cannot have a modified bonus (enhancement bonus plus special ability bonus
//     equivalents, including those from character abilities and spells) higher than +10. A weapon with a
//     special ability must also have at least a +1 enhancement bonus. Weapons cannot possess the same
//     special ability more than once." Armor and shields: the same.
//   - Price by bonus: bonus² × 2,000 gp for weapons (for 50 pieces of ammunition), bonus² × 1,000 gp for
//     armor and shields, plus flat-priced abilities ("+3,750 gp"). Masterwork: +300 gp (weapon), +150 gp
//     (armor, shield). "All magic weapons are also masterwork weapons."
//   - Special materials (PF1's material list holds their numbers): price by item type, per pound, or a
//     multiplier. Cold iron: "Weapons x2 normal. Add magic enhancement +2,000 gp ... applied the first
//     time the item is enhanced". Adamantine and mithral are "always of masterwork quality; the masterwork
//     cost is included". Darkwood: "+10 gp per pound to the price of a masterwork version". Dragonhide:
//     "costs twice as much as masterwork armor of the same type".
//   - Hardness and hit points: the material's hardness; "weapons and armor normally made of steel that are
//     made of adamantine have one-third more hit points than normal" (hit points scale with the material's
//     hit points per inch against the usual material's). "Each +1 of a magic weapon's enhancement bonus
//     adds +2 to its hardness and +10 to its hit points" (PF1 adds that part). Alchemical silver is a
//     coating: a silvered weapon keeps its metal's hardness and hit points (ruling 2026-11-16).
//   - Mithral armor: "one category lighter than normal for purposes of movement and other limitations ...
//     This decrease does not apply to proficiency"; "Spell failure chances ... decreased by 10%, maximum
//     Dexterity bonuses are increased by 2, and armor check penalties are decreased by 3 (to a minimum of
//     0)." Half weight. PF1's list stores mithral's armor check change as +3 where every other material
//     stores a reduction as negative; the text says decreased, so every value is read as a reduction.
//   - Darkwood: "The armor check penalty of a darkwood shield is lessened by 2", half weight.
//   - Adamantine armor: "damage reduction of 1/— if it's light armor, 2/— if it's medium armor, and 3/—
//     if it's heavy armor" (granted through defenses.mjs).
//   - Alchemical silver: "a silvered slashing or piercing weapon ... –1 penalty on the damage roll (with a
//     minimum of 1 point of damage)".
//   - Amulet of mighty fists: "an enhancement bonus of +1 to +5 on attack and damage rolls with unarmed attacks
//     and natural weapons ... can grant melee weapon special abilities, so long as they can be applied to
//     unarmed attacks ... cannot have a modified bonus (enhancement bonus plus special ability bonus
//     equivalents) higher than +5 ... does not need to have a +1 enhancement bonus to grant a melee weapon
//     special ability." FAQ: +3 bypasses cold iron and silver DR, +4 adamantine (not hardness), +5 alignment;
//     price 4,000 gp × bonus²; speed doesn't give one extra attack per natural weapon. PF1 gives its bonus to
//     natural weapons only: unarmed strikes get it here. Unarmed strikes deal bludgeoning damage, so abilities
//     limited to piercing, slashing or ranged weapons can't go on it (ruling 2026-11-16).
//   - Armor abilities applied while worn: shadow and slick ("+5 competence bonus on Stealth" / "Escape Artist";
//     improved +10, greater +15), energy resistance ("absorbs the first 10 points of energy damage per attack";
//     improved 20, greater 30; one chosen energy), spell resistance (13, 15, 17, 19), invulnerability ("damage
//     reduction 5/magic"). Resistances, SR and DR don't stack with others of their kind: the best applies.
// Unidentified items show nothing of this to players (ruling 2026-11-16).

import { MODULE_ID, MELEE_ATTACKS } from "./const.mjs";
import { esc, addSearch, openLink, titleFor, wrapMethod } from "./util.mjs";
import { registerRollEffect } from "./roll-effects.mjs";
import { parseCreatures, typeKey } from "./creature-types.mjs";

export const FLAG = "magicArms"; // item flag: { qualities?: [names], bane?: { types, subtypes }, energy?, specific?, basePrice? }
const PACK = "pf-content.pf-special-qualities";
const WEAPONS = new Set(["weapon", "attack"]);

/* -------------------------------------------- */
/*  Qualities the module knows by name          */
/* -------------------------------------------- */

// Keyed by id; `name` is the quality's name in Pathfinder 1e Content. `later` ones are recorded but not
// automated yet. A burst functions as its base quality, so the base is added with it.
export const QUALITIES = {
  flaming: { name: "Flaming", re: /\bflaming\b/i, energy: "fire" },
  frost: { name: "Frost", re: /\bfrost\b/i, energy: "cold" },
  shock: { name: "Shock", re: /\bshock\b/i, energy: "electric" },
  corrosive: { name: "Corrosive", re: /\bcorrosive\b/i, energy: "acid" },
  flamingBurst: { name: "Flaming Burst", re: /\bflaming burst\b/i, base: "flaming", crit: "1d10", energy: "fire" },
  icyBurst: { name: "Icy Burst", re: /\bicy burst\b/i, base: "frost", crit: "1d10", energy: "cold" },
  shockingBurst: { name: "Shocking Burst", re: /\bshocking burst\b/i, base: "shock", crit: "1d10", energy: "electric" },
  corrosiveBurst: { name: "Corrosive Burst", re: /\bcorrosive burst\b/i, base: "corrosive", crit: "1d10", energy: "acid" },
  thundering: { name: "Thundering", re: /\bthundering\b/i, crit: "1d8", energy: "sonic" },
  holy: { name: "Holy", re: /\bholy\b/i, against: "evil", aligned: "good" },
  unholy: { name: "Unholy", re: /\bunholy\b/i, against: "good", aligned: "evil" },
  axiomatic: { name: "Axiomatic", re: /\baxiomatic\b/i, against: "chaotic", aligned: "lawful" },
  anarchic: { name: "Anarchic", re: /\banarchic\b/i, against: "lawful", aligned: "chaotic" },
  bane: { name: "Bane", re: /\bbane\b/i },
  keen: { name: "Keen", re: /\bkeen\b/i, limit: "keen" },
  vicious: { name: "Vicious", re: /\bvicious\b/i, limit: "melee" },
  merciful: { name: "Merciful", re: /\bmerciful\b/i },
  wounding: { name: "Wounding", re: /\bwounding\b/i, limit: "melee" },
  disruption: { name: "Disruption", re: /\bdisruption\b/i, limit: "bludgeoning" },
  vorpal: { name: "Vorpal", re: /\bvorpal\b/i, limit: "slashing" },
  brilliantEnergy: { name: "Brilliant Energy", re: /\bbrilliant energy\b/i },
  ghostTouch: { name: "Ghost Touch", re: /\bghost[\s-]touch\b/i, limit: "melee" }, // "melee weapons and ammunition"
  seeking: { name: "Seeking", re: /\bseeking\b/i, limit: "ranged" },
  speed: { name: "Speed", re: /\bspeed\b/i },
  furious: { name: "Furious", re: /\bfurious\b/i, limit: "melee" },
  defending: { name: "Defending", re: /\bdefending\b/i, limit: "melee" },
};
const BY_NAME = new Map(Object.entries(QUALITIES).map(([id, q]) => [q.name.toLowerCase(), id]));

const typesOf = (part) => [...(part?.types ?? [])];
const isMelee = (action) => MELEE_ATTACKS.includes(action?.actionType);
const damageTypes = (action) => (action?.damage?.parts ?? []).flatMap(typesOf);
// Where an automated quality can be placed ("Only piercing or slashing melee weapons can be keen")
const LIMITS = {
  keen: { text: "piercing or slashing melee weapons", ok: (a) => isMelee(a) && damageTypes(a).some((t) => t === "piercing" || t === "slashing") },
  melee: { text: "melee weapons", ok: (a) => isMelee(a) },
  ranged: { text: "ranged weapons", ok: (a) => !!a && !isMelee(a) },
  bludgeoning: { text: "bludgeoning melee weapons", ok: (a) => isMelee(a) && damageTypes(a).includes("bludgeoning") },
  slashing: { text: "slashing melee weapons", ok: (a) => isMelee(a) && damageTypes(a).includes("slashing") },
};
/** Does an automated quality work on this action? Null when it has no limit. */
export const fits = (id, action) => (QUALITIES[id]?.limit ? LIMITS[QUALITIES[id].limit].ok(action) : null);
export const limitText = (id) => (QUALITIES[id]?.limit ? LIMITS[QUALITIES[id].limit].text : "");
export const keenWorks = (action) => LIMITS.keen.ok(action);

// An unarmed strike, for what an amulet of mighty fists can carry
const UNARMED_ACTION = { actionType: "mwak", damage: { parts: [{ types: ["bludgeoning"] }] } };
/** Can this ability go on an amulet of mighty fists ("so long as they can be applied to unarmed attacks")? */
const amuletFits = (name) => {
  const id = BY_NAME.get(name.toLowerCase());
  return !id || !QUALITIES[id].limit || LIMITS[QUALITIES[id].limit].ok(UNARMED_ACTION);
};

// Armor and shield abilities applied while the item is worn (by Pathfinder 1e Content's names)
const ARMOR_ABILITIES = {
  shadow: { skill: "ste", bonus: 5 },
  "shadow, improved": { skill: "ste", bonus: 10 },
  "shadow, greater": { skill: "ste", bonus: 15 },
  slick: { skill: "esc", bonus: 5 },
  "slick, improved": { skill: "esc", bonus: 10 },
  "slick, greater": { skill: "esc", bonus: 15 },
  "energy resistance": { resist: 10 },
  "energy resistance, improved": { resist: 20 },
  "energy resistance, greater": { resist: 30 },
  "spell resistance (13)": { sr: 13 },
  "spell resistance (15)": { sr: 15 },
  "spell resistance (17)": { sr: 17 },
  "spell resistance (19)": { sr: 19 },
  invulnerability: { dr: 5 },
};
const ENERGY_TYPES = { acid: "acid", cold: "cold", electric: "electricity", fire: "fire", sonic: "sonic" }; // PF1 id → word
const FORTIFICATION = /^fortification \((light|moderate|heavy)\)$/i;

/** Armor abilities in an armor's name ("+1 Greater Shadow Leather Armor", "Fire Resistance Chainmail"). */
function armorFromName(source) {
  const names = [];
  const grade = (g) => (g ? `, ${g.trim().toLowerCase().replace(/^./, (c) => c.toUpperCase())}` : "");
  const fort = source.match(/\b(light|moderate|heavy) fortification\b|\bfortification \((light|moderate|heavy)\)/i);
  if (fort) names.push(`Fortification (${(fort[1] ?? fort[2]).toLowerCase()})`);
  for (const [word, name] of [["shadow", "Shadow"], ["slick", "Slick"]]) {
    const m = source.match(new RegExp(`\\b(improved |greater )?${word}\\b(?! blending)`, "i"));
    if (m) names.push(`${name}${grade(m[1])}`);
  }
  const er = source.match(/\b(improved |greater )?(energy|acid|cold|electricity|fire|sonic) resistance\b/i);
  if (er) names.push(`Energy Resistance${grade(er[1])}`);
  const sr = source.match(/\bspell resistance \((13|15|17|19)\)|\bSR (13|15|17|19)\b/i);
  if (sr) names.push(`Spell Resistance (${sr[1] ?? sr[2]})`);
  if (/\binvulnerability\b/i.test(source)) names.push("Invulnerability");
  return names;
}
/** The energy type in an armor's name ("Fire Resistance"), as PF1's id. */
function energyFromName(source) {
  const word = source.match(/\b(acid|cold|electricity|fire|sonic) resistance\b/i)?.[1]?.toLowerCase();
  return word ? Object.keys(ENERGY_TYPES).find((k) => ENERGY_TYPES[k] === word) ?? null : null;
}

/** The designated foe in a name ("+1 Undead Bane Longsword", "Orc-Bane Greataxe"), or null. */
export function baneFromName(name) {
  const before = name.toLowerCase().match(/([a-z' -]+?)[\s-]+bane\b/)?.[1];
  if (!before) return null;
  const words = before.split(/[\s-]+/).filter(Boolean);
  for (const n of [2, 1]) {
    if (words.length < n) continue;
    const spec = parseCreatures(words.slice(-n).join(" "));
    if (spec && !spec.alignments.length) return { types: spec.types, subtypes: spec.subtypes };
  }
  return null;
}

const AMULET = /^amulet of mighty fists\b/i;
/** An amulet of mighty fists (by its name or the compendium item it came from). */
export const isAmulet = (item) => item?.type === "equipment" && (AMULET.test(item._source?.name ?? item.name ?? "") || (item.system?.slot === "neck" && AMULET.test(sourceName(item) ?? "")));
const isArmor = (item) => item?.type === "equipment" && ["armor", "shield"].includes(item.system?.subType);
const isArms = (item) => !!item && (WEAPONS.has(item.type) || isArmor(item) || isAmulet(item));
const stored = (item) => item?.flags?.[MODULE_ID]?.[FLAG] ?? null;
/** An unarmed strike (not a natural weapon): an attack or weapon named so. */
export const isUnarmed = (item) => WEAPONS.has(item?.type) && item.system?.subType !== "natural" && /\bunarmed\b/i.test(`${item._source?.name ?? item.name ?? ""} ${(item.system?.baseTypes ?? []).join(" ")}`);
/** Unarmed strikes and natural weapons: what an amulet of mighty fists enhances. */
export const isBodily = (item) => WEAPONS.has(item?.type) && (item.system?.subType === "natural" || isUnarmed(item));
/** The amulet of mighty fists the creature wears, or null. */
export const wornAmulet = (actor) => actor?.itemTypes?.equipment?.find((i) => i.isActive && isAmulet(i)) ?? null;
/** An amulet's enhancement bonus: its PF1 change on natural attacks, or the "+N" in its name. */
function amuletEnh(item) {
  const change = (item.system.changes ?? []).find((c) => c.target === "nattack" && c.type === "enh");
  const n = Number(change?.formula);
  if (Number.isFinite(n) && n > 0) return n;
  return Number((item._source?.name ?? item.name ?? "").match(/\+(\d)\b/)?.[1]) || 0;
}

// Temporary qualities and effects: what spells and class features put on a weapon for a time
// (weapon-spells.mjs). They count for the automation and the +10 limit, never for the item's own list,
// its name or its price.
const temporary = [];
/** fn(item) → [{ source, qualities: [names], magic, align: [alignments], bless }] for the effects on it now. */
export function registerTemporary(fn) {
  temporary.push(fn);
}
/** The effects on the weapon for a time. */
export const temporaryOf = (item) => (item?.actor ? temporary.flatMap((fn) => fn(item) ?? []) : []);

/**
 * The item's qualities: { names: [its own, as chosen], ids: Set of known ids (with temporary ones), temporary:
 * [names added for a time], bane, fromName, specific }. Chosen on the panel, or read from the item's name when
 * nothing is chosen (existing and imported items). `own` leaves the temporary ones out.
 */
export function qualitiesOf(item, { own = false } = {}) {
  if (!isArms(item)) return null;
  const flag = stored(item);
  const fromName = !Array.isArray(flag?.qualities);
  const source = item._source?.name ?? item.name ?? "";
  let names;
  if (!fromName) names = [...flag.qualities];
  else if (WEAPONS.has(item.type) || isAmulet(item)) names = Object.values(QUALITIES).filter((q) => q.re.test(source)).map((q) => q.name);
  else names = armorFromName(source);
  const temps = own ? [] : temporaryOf(item);
  const extra = [...new Set(temps.flatMap((t) => t.qualities ?? []))].filter((n) => !names.some((x) => x.toLowerCase() === n.toLowerCase()));
  const ids = new Set([...names, ...extra].map((n) => BY_NAME.get(n.toLowerCase())).filter(Boolean));
  for (const id of [...ids]) if (QUALITIES[id].base) ids.add(QUALITIES[id].base);
  const bane = ids.has("bane") ? flag?.bane ?? (fromName ? baneFromName(source) : null) ?? temps.find((t) => t.bane)?.bane ?? null : null;
  const energy = isArmor(item) ? flag?.energy ?? (fromName ? energyFromName(source) : null) : null;
  return { names, ids, temporary: extra, bane, energy, fromName, specific: !!flag?.specific };
}

/* -------------------------------------------- */
/*  The catalog (Pathfinder 1e Content)         */
/* -------------------------------------------- */

let catalog = null; // Promise<Map(lowercase name → entry)>
const FOLDERS = { weapon: ["Weapons"], melee: ["Melee Weapons"], ranged: ["Ranged Weapons"], armor: ["Armor & Shields", "Armor"], shield: ["Armor & Shields", "Shields"] };

/** A quality's price from its "Price" line: { bonus } or { gp }, picking a variant's own line. */
export function parsePrice(name, line) {
  const one = (s) => {
    const b = s.match(/\+(\d+) bonus/);
    if (b) return { bonus: Number(b[1]) };
    const g = s.match(/\+([\d,]+) gp/);
    return g ? { gp: Number(g[1].replace(/,/g, "")) } : null;
  };
  const parts = line.split(/,\s*(?![\d]{3})/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return one(line);
  // "light (+1 bonus), moderate (+3 bonus), heavy (+5 bonus)": the part naming this item's level
  const n = name.toLowerCase();
  const qualifier = n.match(/\(([^)]+)\)/)?.[1] ?? n.match(/^(improved|greater)\b/)?.[1] ?? null;
  const part = (qualifier && parts.find((p) => p.toLowerCase().startsWith(qualifier))) ?? parts.find((p) => p.startsWith("(")) ?? parts[0];
  return one(part);
}

let catalogReady = null; // the catalog once loaded, for sheet renders that don't wait
/** Every quality in Pathfinder 1e Content's special qualities pack, with its price and category. */
export function loadCatalog() {
  return (catalog ??= (async () => {
    const pack = game.packs.get(PACK);
    const map = new Map();
    if (!pack) return map;
    const index = await pack.getIndex({ fields: ["folder", "system.description.value"] });
    const folders = new Map(pack.folders.map((f) => [f.id, f.name]));
    for (const e of index) {
      const folder = folders.get(e.folder) ?? null;
      if (!folder) continue;
      const text = String(e.system?.description?.value ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
      const price = parsePrice(e.name, text.match(/Price\s*([^;]*);/)?.[1] ?? "");
      map.set(e.name.toLowerCase(), { name: e.name, uuid: e.uuid ?? `Compendium.${PACK}.Item.${e._id}`, folder, price });
    }
    catalogReady = map;
    return map;
  })());
}

/** The catalog folders that apply to this item. */
function foldersFor(item) {
  if (isAmulet(item)) return [...FOLDERS.weapon, ...FOLDERS.melee];
  if (item.type === "equipment") return FOLDERS[item.system.subType] ?? [];
  const ranged = item.system.weaponSubtype === "ranged" || (item.type === "attack" && !isMelee(item.defaultAction));
  return [...FOLDERS.weapon, ...(ranged ? FOLDERS.ranged : FOLDERS.melee)];
}

/* -------------------------------------------- */
/*  Materials                                   */
/* -------------------------------------------- */

const materialPath = (item) => (item.type === "equipment" ? item.system.armor?.material : item.system.material);
/** The item's special material (PF1's "Material" choice), not its base material. */
export function specialMaterial(item) {
  const id = materialPath(item)?.normal?.value;
  return id ? pf1.registry.materials.get(id) ?? null : null;
}
const addons = (item) => (materialPath(item)?.addon ?? []).map((id) => pf1.registry.materials.get(id)).filter(Boolean);
const baseMaterial = (item) => pf1.registry.materials.get(materialPath(item)?.base?.value ?? item.baseMaterial ?? "") ?? null;
/** Do the material's rules include the masterwork quality? */
const materialMasterwork = (item) => !!specialMaterial(item)?.masterwork || addons(item).some((m) => m.masterwork);

const armorTypeKey = (item) => item.system.equipmentSubtype; // lightArmor, mediumArmor, heavyArmor, lightShield...
const LIGHTER = { heavyArmor: "mediumArmor", mediumArmor: "lightArmor" };
// Materials that make armor one category lighter for movement and limitations (not proficiency)
const LIGHTER_MATERIALS = new Set(["mithral", "noqual"]);

/** Armor statistics after the material: { acp, dex, asf } changes (acp ≤ 0, asf ≤ 0 except noqual). */
function armorChanges(item) {
  const m = specialMaterial(item);
  if (!m) return null;
  const stats = item.system.subType === "shield" ? m.shield : m.armor;
  if (!stats) return null;
  return { acp: -Math.abs(stats.acp || 0), dex: stats.maxDex || 0, asf: stats.asf || 0 };
}

/* -------------------------------------------- */
/*  Price                                       */
/* -------------------------------------------- */

const gp = (n) => `${Math.round(n * 100) / 100} gp`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const enhOf = (item) => (isAmulet(item) ? amuletEnh(item) : item.type === "equipment" ? item.system.armor?.enh : item.system.enh) || 0;

/** The material's price category for this item (PF1's material price fields). */
function priceCategory(item) {
  if (item.type === "equipment") return item.system.subType === "shield" ? "shield" : armorTypeKey(item);
  const sub = item.system.weaponSubtype;
  if (sub === "light") return "lightWeapon";
  if (sub === "1h") return "oneHandWeapon";
  if (sub === "2h") return "twoHandWeapon";
  return (item.system.held ?? "2h") === "1h" ? "rangedOneHandWeapon" : "rangedTwoHandWeapon";
}

/**
 * The item's price from its parts: [{ label, gp }] and the total. `base` is the plain item's price.
 * Qualities without a known price are listed and left out.
 */
export async function priceOf(item, base) {
  return priceFrom(item, base, await loadCatalog());
}
function priceFrom(item, base, cat) {
  const q = qualitiesOf(item, { own: true });
  if (isAmulet(item)) return amuletPrice(item, q, cat);
  const armorLike = item.type === "equipment";
  const lines = [{ label: "Base item", gp: base }];
  const mat = specialMaterial(item);
  const weight = item._source?.system?.weight?.value ?? 0;
  // A price for the item's type, else per pound of the plain item (mithral: armor by type, other items by weight)
  const matPrice = (m) => {
    let p = m.price?.[priceCategory(item)] || (m.price?.perPound || 0) * weight;
    if ((m.price?.multiplier ?? 1) !== 1) p += base * (m.price.multiplier - 1);
    return p;
  };
  const enh = enhOf(item);
  let bonus = enh;
  let flat = 0;
  const unknown = [];
  for (const name of q.names) {
    const p = cat.get(name.toLowerCase())?.price;
    if (p?.bonus) bonus += p.bonus;
    else if (p?.gp) flat += p.gp;
    else unknown.push(name);
  }
  const magic = bonus > 0 || flat > 0;
  // Masterwork: magic items are masterwork; adamantine and mithral include its cost; darkwood and
  // dragonhide are priced from the masterwork version (dragonhide twice it)
  const mw = item.system.masterwork || magic || materialMasterwork(item);
  const mwCost = armorLike ? 150 : 300;
  const included = mat?.masterwork && !["darkwood", "dragonhide"].includes(mat.id);
  if (mw && !included) lines.push({ label: "Masterwork", gp: mwCost });
  if (mat) {
    const extra = mat.id === "dragonhide" ? base + mwCost : matPrice(mat);
    const how = (mat.price?.multiplier ?? 1) !== 1 ? ` (×${mat.price.multiplier} the item's price)` : mat.id === "dragonhide" ? " (twice masterwork armor)" : "";
    if (extra) lines.push({ label: `${mat.name}${how}`, gp: extra });
  }
  for (const m of addons(item)) {
    const extra = matPrice(m);
    if (extra) lines.push({ label: m.name, gp: extra });
  }
  if (bonus > 0) lines.push({ label: `Bonus +${bonus}${bonus !== enh ? ` (+${enh} enhancement, +${bonus - enh} abilities)` : ""}`, gp: bonus * bonus * (armorLike ? 1000 : 2000) });
  if (flat) lines.push({ label: "Abilities priced in gp", gp: flat });
  // Cold iron: "+2,000 gp ... the first time the item is enhanced"
  const enhFee = mat?.price?.enhancement?.weapon || 0;
  if (enhFee && magic && !armorLike) lines.push({ label: `${mat.name}: enchanting`, gp: enhFee });
  return { lines, total: lines.reduce((t, l) => t + l.gp, 0), unknown };
}

/** An amulet of mighty fists: 4,000 gp × (enhancement plus ability bonuses)², plus abilities priced in gp (FAQ). */
function amuletPrice(item, q, cat) {
  const enh = amuletEnh(item);
  let bonus = enh;
  let flat = 0;
  const unknown = [];
  for (const name of q.names) {
    const p = cat.get(name.toLowerCase())?.price;
    if (p?.bonus) bonus += p.bonus;
    else if (p?.gp) flat += p.gp;
    else unknown.push(name);
  }
  const lines = [];
  if (bonus > 0) lines.push({ label: `Bonus +${bonus}${bonus !== enh ? ` (+${enh} enhancement, +${bonus - enh} abilities)` : ""}`, gp: bonus * bonus * 4000 });
  if (flat) lines.push({ label: "Abilities priced in gp", gp: flat });
  return { lines, total: lines.reduce((t, l) => t + l.gp, 0), unknown };
}

/** The plain item's price: recorded on the panel, or the compendium item it came from. */
const sourcePrices = new Map(); // compendium uuid → its price (loading the document on every sheet render was slow)
/** The plain item's price if it's known without waiting: a number, null (none), or undefined (not looked up yet). */
function basePriceNow(item) {
  if (isAmulet(item)) return 0; // priced from its bonus alone
  const recorded = stored(item)?.basePrice;
  if (Number.isFinite(recorded)) return recorded;
  const uuid = item._stats?.compendiumSource;
  return uuid ? sourcePrices.get(uuid) : null;
}
async function basePriceOf(item) {
  if (isAmulet(item)) return 0;
  const recorded = stored(item)?.basePrice;
  if (Number.isFinite(recorded)) return recorded;
  const uuid = item._stats?.compendiumSource;
  if (!uuid) return null;
  if (!sourcePrices.has(uuid)) {
    const source = await fromUuid(uuid).catch(() => null);
    sourcePrices.set(uuid, Number.isFinite(source?.system?.price) ? source.system.price : null);
  }
  return sourcePrices.get(uuid);
}

/* -------------------------------------------- */
/*  Checks against the rules                    */
/* -------------------------------------------- */

/** Problems with the item's qualities, as sentences. */
export async function problemsOf(item) {
  return problemsFrom(item, await loadCatalog());
}
function problemsFrom(item, cat) {
  const q = qualitiesOf(item);
  if (!q?.names.length || q.specific) return [];
  const out = [];
  const enh = enhOf(item);
  if (isAmulet(item)) {
    const total = enh + q.names.reduce((t, n) => t + (cat.get(n.toLowerCase())?.price?.bonus ?? 0), 0);
    if (total > 5) out.push(`The total bonus is +${total}: an amulet of mighty fists allows no more than +5 (enhancement plus abilities).`);
    for (const n of q.names) if (!amuletFits(n)) out.push(`${n} can't be applied to unarmed attacks.`);
    if (q.ids.has("bane") && !q.bane) out.push("Bane: choose the designated foe.");
    return out;
  }
  if (enh < 1) out.push("A special ability needs at least a +1 enhancement bonus.");
  const bonus = enh + [...q.names, ...q.temporary].reduce((t, n) => t + (cat.get(n.toLowerCase())?.price?.bonus ?? 0), 0);
  if (bonus > 10) out.push(`The total bonus is +${bonus}: no more than +10 (enhancement plus abilities).`);
  if (WEAPONS.has(item.type)) {
    for (const id of q.ids) if (fits(id, item.defaultAction) === false) out.push(`${QUALITIES[id].name} works only on ${limitText(id)}.`);
    if (q.ids.has("bane") && !q.bane) out.push("Bane: choose the designated foe.");
  }
  if (q.names.some((n) => ARMOR_ABILITIES[n.toLowerCase()]?.resist) && !q.energy) out.push("Energy resistance: choose the energy type.");
  return out;
}

/* -------------------------------------------- */
/*  The generated name                          */
/* -------------------------------------------- */

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const labelOf = (v) => game.i18n.localize(typeof v === "string" ? v : v?.label ?? "");
const typeName = (key) => labelOf(Object.entries(pf1.config.creatureTypes ?? {}).find(([k]) => typeKey(k) === key)?.[1]) || key;
const subtypeName = (key) => labelOf(Object.entries(pf1.config.creatureSubtypes ?? {}).find(([k]) => typeKey(k) === key)?.[1]) || key;
/** "undead", "orc" (a humanoid or outsider foe is named by its subtype, as in "orc bane") */
export const foeText = (spec) => {
  if (!spec) return "";
  const subs = spec.subtypes.map(subtypeName).join(" or ");
  return (subs || spec.types.map(typeName).join(" or ")).toLowerCase();
};

/**
 * The name of the compendium item this one came from, if that compendium's index is loaded. Items are
 * prepared while the world loads, before the compendiums exist: then it's null.
 */
function sourceName(item) {
  const uuid = item._stats?.compendiumSource;
  if (!uuid || !game.packs?.size) return null;
  try {
    return fromUuidSync(uuid, { strict: false })?.name ?? null;
  } catch {
    return null;
  }
}

/** The name an item with its stock name gets: "+1 Flaming Cold Iron Longsword". Null to keep its name. */
export function generatedName(item) {
  const q = qualitiesOf(item, { own: true });
  if (!q || q.specific) return null;
  const stock = item._source?.name;
  if (isAmulet(item)) {
    // "+2 Flaming Amulet of Mighty Fists", once it has abilities chosen; a plain one keeps its name
    if (!stock || !/^amulet of mighty fists(?: \+\d)?$/i.test(stock) || q.fromName || !q.names.length) return null;
    const enh = amuletEnh(item);
    return [enh > 0 ? `+${enh}` : null, ...q.names.map((n) => (n.toLowerCase() === "bane" && q.bane ? `${titleCase(foeText(q.bane))} Bane` : n)), "Amulet of Mighty Fists"].filter(Boolean).join(" ");
  }
  if (!stock || (stock !== item.system.baseTypes?.[0] && stock !== sourceName(item))) return null;
  const enh = enhOf(item);
  const mat = specialMaterial(item);
  const words = [];
  if (enh > 0) words.push(`+${enh}`);
  else if (item.system.masterwork && !mat?.masterwork) words.push("Masterwork");
  for (const name of q.fromName ? [] : q.names) {
    const level = name.match(/^(.+) \((light|moderate|heavy)\)$/i);
    const grade = name.match(/^(.+), (lesser|improved|greater)$/i); // "Flamboyant, Greater"
    if (ARMOR_ABILITIES[name.toLowerCase()]?.resist && q.energy) words.push(`${grade ? `${titleCase(grade[2])} ` : ""}${titleCase(ENERGY_TYPES[q.energy] ?? q.energy)} Resistance`);
    else if (level) words.push(`${titleCase(level[2])} ${level[1]}`);
    else if (grade) words.push(`${titleCase(grade[2])} ${grade[1]}`);
    else if (name.toLowerCase() === "bane" && q.bane) words.push(`${titleCase(foeText(q.bane))} Bane`);
    else words.push(name);
  }
  if (mat) words.push(mat.name);
  for (const m of addons(item)) words.push(m.name);
  return words.length ? `${words.join(" ")} ${stock}` : null;
}

/* -------------------------------------------- */
/*  Preparing items: material, masterwork, name */
/* -------------------------------------------- */

// At init: the world's items are prepared before the setup hook
Hooks.once("init", () => {
  const I = "pf1.documents.item";
  // Hardness and hit points from the special material (PF1 then adds +2 / +10 per enhancement)
  wrapMethod(`${I}.ItemPhysicalPF.prototype.prepareDurability`, function (wrapped, ...args) {
    const result = wrapped(...args);
    if (!isArms(this)) return result;
    const mat = specialMaterial(this);
    const base = baseMaterial(this);
    if (!mat || mat.addon) return result;
    const enh = enhOf(this);
    const sys = this.system;
    sys.hardness.base = mat.hardness;
    sys.hardness.total = mat.hardness + pf1.config.itemEnhancementMods.hardness * enh;
    const ratio = mat.healthPerInch && base?.healthPerInch ? mat.healthPerInch / base.healthPerInch : 1;
    if (ratio !== 1) {
      const plain = sys.hp.max - pf1.config.itemEnhancementMods.hp * enh;
      sys.hp.max = Math.floor(plain * ratio) + pf1.config.itemEnhancementMods.hp * enh;
      sys.hp.value = Math.max(0, sys.hp.max + (sys.hp.offset || 0));
    }
    return result;
  });
  // Weight (mithral and darkwood: half)
  for (const cls of ["ItemWeaponPF", "ItemEquipmentPF"]) {
    wrapMethod(`${I}.${cls}.prototype.getWeightMultiplier`, function (wrapped, ...args) {
      const mult = wrapped(...args);
      const mat = isArms(this) ? specialMaterial(this) : null;
      return mat && !mat.addon ? mult * (mat.weight?.multiplier ?? 1) : mult;
    });
  }
  // Armor check penalty, maximum Dex and spell failure; materials that include masterwork
  wrapMethod(`${I}.ItemPhysicalPF.prototype.prepareBaseData`, function (wrapped, ...args) {
    const result = wrapped(...args);
    if (!isArms(this)) return result;
    if (materialMasterwork(this)) this.system.masterwork = true;
    const ch = this.type === "equipment" ? armorChanges(this) : null;
    if (ch && this.system.armor) {
      const a = this.system.armor;
      if (ch.acp) a.acp = Math.max(0, (a.acp || 0) + ch.acp);
      if (ch.dex && Number.isFinite(a.dex)) a.dex += ch.dex;
      if (ch.asf) this.system.spellFailure = Math.max(0, (this.system.spellFailure || 0) + ch.asf);
    }
    return result;
  });
  // Mithral armor: one category lighter for movement and limitations (the actor's armor type)
  wrapMethod(`${I}.ItemEquipmentPF.prototype.applyEquippedEffects`, function (wrapped, ...args) {
    const lighter = this.system.subType === "armor" && LIGHTER_MATERIALS.has(specialMaterial(this)?.id) ? LIGHTER[this.system.equipmentSubtype] : null;
    if (!lighter) return wrapped(...args);
    const original = this.system.equipmentSubtype;
    this.system.equipmentSubtype = lighter;
    try {
      return wrapped(...args);
    } finally {
      this.system.equipmentSubtype = original;
    }
  });
  // Amulet of mighty fists: PF1 puts its bonus on natural attacks only; unarmed strikes get it too
  wrapMethod(`${I}.ItemPF.prototype.getContextChanges`, function (wrapped, ...args) {
    const changes = wrapped(...args);
    if (!this.actor || !isUnarmed(this)) return changes;
    const stack = this.getContextStack(args[0] ?? ["attack"]);
    const want = new Set([stack.has("attack") && "nattack", stack.has("damage") && "ndamage"].filter(Boolean));
    if (!want.size) return changes;
    const extra = this.actor.changes.filter((c) => want.has(c.target) && isAmulet(c.parent) && !changes.includes(c));
    return extra.length ? [...changes, ...extra] : changes;
  });
  // Shadow and slick armor: their competence bonus as PF1 changes on the armor (counted while it's worn)
  wrapMethod(`${I}.ItemPF.prototype._prepareChanges`, function (wrapped, ...args) {
    const result = wrapped(...args);
    if (!isArmor(this) || !this.changes) return result;
    const q = qualitiesOf(this, { own: true });
    q?.names.forEach((n) => {
      const a = ARMOR_ABILITIES[n.toLowerCase()];
      if (!a?.skill) return;
      const _id = `revampArmorSkl${a.skill}`.slice(0, 16);
      this.changes.set(_id, new pf1.components.ItemChange({ _id, formula: String(a.bonus), target: `skill.${a.skill}`, type: "competence", operator: "add", priority: 0 }, { parent: this, strict: false }));
    });
    return result;
  });
  // The generated name, while the item keeps its stock name (identified data only)
  wrapMethod(`${I}.ItemPhysicalPF.prototype.prepareDerivedData`, function (wrapped, ...args) {
    const result = wrapped(...args);
    // Not while this user sees the item unidentified: PF1 has just put the unidentified name in place
    if (isArms(this) && !this.showUnidentifiedData) {
      const name = generatedName(this);
      if (name) this.name = name;
    }
    return result;
  });
});

// PF1's sheet shows the generated name in its name field and saves the whole form on any change: that
// isn't a rename, so the stored (stock) name stays and the name keeps following the item's parts
Hooks.on("preUpdateItem", (item, changes) => {
  if (!isArms(item)) return;
  const shown = generatedName(item);
  if (!shown) return;
  if (changes.name === shown) delete changes.name;
  if (foundry.utils.getProperty(changes, "system.unidentified.name") === shown) foundry.utils.setProperty(changes, "system.unidentified.name", item._source.system.unidentified?.name ?? "");
});
// The same for the Masterwork box, which shows a masterwork material (adamantine, mithral) as ticked
Hooks.on("preUpdateItem", (item, changes) => {
  if (!isArms(item) || foundry.utils.getProperty(changes, "system.masterwork") !== true || item._source.system.masterwork) return;
  // The material the item has after this update (a sheet save always sends it along)
  const path = item.type === "equipment" ? "system.armor.material.normal.value" : "system.material.normal.value";
  const id = foundry.utils.getProperty(changes, path) ?? foundry.utils.getProperty(item._source, path);
  if (id && pf1.registry.materials.get(id)?.masterwork) delete changes.system.masterwork;
});

/** Adamantine armor's DR (light 1/—, medium 2/—, heavy 3/—), for defenses.mjs. */
export function materialDR(actor) {
  const out = [];
  for (const item of actor?.itemTypes?.equipment ?? []) {
    if (!item.system.equipped || item.system.subType !== "armor" || specialMaterial(item)?.id !== "adamantine") continue;
    const amount = { lightArmor: 1, mediumArmor: 2, heavyArmor: 3 }[item.system.equipmentSubtype];
    if (amount) out.push({ trait: "dr", amount, types: ["", ""], operator: true, source: item.name });
  }
  return out;
}

/** Energy resistance, spell resistance and invulnerability from worn armor and shields, for defenses.mjs. */
export function armorGrants(actor) {
  const out = [];
  for (const item of actor?.itemTypes?.equipment ?? []) {
    if (!item.isActive || !isArmor(item)) continue;
    const q = qualitiesOf(item, { own: true });
    for (const n of q?.names ?? []) {
      const a = ARMOR_ABILITIES[n.toLowerCase()];
      if (a?.resist && q.energy) out.push({ trait: "eres", type: q.energy, amount: a.resist, source: item.name });
      if (a?.dr) out.push({ trait: "dr", amount: a.dr, types: ["magic", ""], operator: true, source: item.name });
      if (a?.sr) out.push({ trait: "sr", amount: a.sr, source: item.name });
    }
  }
  return out;
}

// The worn amulet of mighty fists on unarmed strikes and natural weapons: its abilities, and its enhancement
// bonus against DR (PF1 adds the bonus itself to natural attacks; unarmed strikes get it above)
registerTemporary((item) => {
  if (!isBodily(item)) return [];
  const amulet = wornAmulet(item.actor);
  if (!amulet) return [];
  const q = qualitiesOf(amulet, { own: true });
  const names = q.names.filter(amuletFits);
  const enh = amuletEnh(amulet);
  const parts = [enh > 0 ? `+${enh} enhancement` : null, ...names.map((n) => (n.toLowerCase() === "bane" && q.bane ? `Bane (${foeText(q.bane)})` : n))].filter(Boolean);
  return [{ source: amulet.name, worn: true, qualities: names, bane: q.bane, penetrates: enh, label: parts.join(", ") || null }];
});

/** Does something worn or cast on the weapon make it magic (an amulet's bonus, magic weapon)? */
export const strikesMagically = (item) => temporaryOf(item).some((t) => t.magic || t.penetrates > 0);

Hooks.once("setup", () => {
  // FAQ: the amulet's bonus bypasses DR as a weapon's would (+1 magic, +3 cold iron and silver, +4
  // adamantine, +5 alignment)
  wrapMethod("pf1.applications.ApplyDamage.prototype._evaluateAttack", function (wrapped, ...args) {
    const result = wrapped(...args);
    const n = Math.max(0, ...temporaryOf(this.options?.action?.item).map((t) => t.penetrates ?? 0));
    if (n > 0) {
      this.isMagic = true;
      for (let i = 0; i <= n; i++) for (const id of pf1.config.enhancementMaterialPenetration?.[i] ?? []) this.materials?.add(id);
    }
    return result;
  });
});

// Alchemical silver: −1 damage with a silvered slashing or piercing weapon (imposed: only the GM unticks it)
registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "attack") return [];
    const item = roll.action.item;
    if (!WEAPONS.has(item?.type) || !addons(item).some((m) => m.id === "alchemicalSilver")) return [];
    if (!damageTypes(roll.action).some((t) => t === "slashing" || t === "piercing")) return [];
    return [{ id: "mat-silver", label: "Alchemical silver", type: "untyped", dmg: -1, showIn: ["dmg"], applies: true, imposed: true, tooltip: "A silvered slashing or piercing weapon: −1 on damage rolls (minimum 1)" }];
  },
});

/* -------------------------------------------- */
/*  The panel                                   */
/* -------------------------------------------- */

const OUTSIDER_OR_HUMANOID = new Set(["humanoid", "outsider"]);

/** Save the qualities (starting from what the name gave, the first time). */
async function saveQualities(item, update) {
  const q = qualitiesOf(item, { own: true });
  const current = { qualities: q.names, bane: q.bane ?? null, energy: q.energy ?? null, specific: q.specific, basePrice: stored(item)?.basePrice ?? null };
  await item.setFlag(MODULE_ID, FLAG, { ...current, ...update });
}

function priceText(p) {
  return p ? `${gp(p.total)}${p.unknown.length ? ` (without ${p.unknown.join(", ")})` : ""}` : "set the base price";
}

function panelHTML(item, cat, base) {
  const q = qualitiesOf(item);
  const folders = foldersFor(item);
  const editable = item.isOwner;
  const priceTag = (name) => {
    const p = cat.get(name.toLowerCase())?.price;
    return p?.bonus ? `+${p.bonus}` : p?.gp ? `+${gp(p.gp)}` : "";
  };
  const automated = (name) => {
    const id = BY_NAME.get(name.toLowerCase());
    if (id) return QUALITIES[id].later ? "recorded" : "automated";
    return ARMOR_ABILITIES[name.toLowerCase()] || FORTIFICATION.test(name) ? "automated" : null;
  };
  const chips = q.names.map((name, i) => {
    const entry = cat.get(name.toLowerCase());
    const auto = automated(name);
    const label = name.toLowerCase() === "bane" && q.bane ? `Bane (${foeText(q.bane)})` : name;
    return `<li style="display:flex; align-items:center; gap:0.4em">
      <span>${esc(label)}</span><span style="opacity:0.7">${esc(priceTag(name))}</span>
      ${auto === "automated" ? '<i class="fa-solid fa-gears" data-tooltip="Automated by PF1e Revamp"></i>' : auto === "recorded" ? '<i class="fa-regular fa-clock" data-tooltip="Not automated yet"></i>' : ""}
      ${entry ? openLink(entry.uuid) : ""}
      ${editable ? `<a data-wq-remove="${i}" data-tooltip="Remove" style="margin-left:auto"><i class="fa-solid fa-xmark"></i></a>` : ""}
    </li>`;
  }).join("");
  const options = folders.map((folder) => {
    const list = [...cat.values()].filter((e) => e.folder === folder && !q.names.some((n) => n.toLowerCase() === e.name.toLowerCase()) && (!isAmulet(item) || amuletFits(e.name))).sort((a, b) => a.name.localeCompare(b.name));
    return list.length ? `<optgroup label="${esc(folder)}">${list.map((e) => `<option value="${esc(e.name)}">${esc(e.name)}${e.price ? ` (${e.price.bonus ? `+${e.price.bonus}` : gp(e.price.gp)})` : ""}${automated(e.name) === "automated" ? " ⚙" : ""}</option>`).join("")}</optgroup>` : "";
  }).join("");
  const types = Object.keys(pf1.config.creatureTypes ?? {}).map((k) => [typeKey(k), typeName(typeKey(k))]).sort((a, b) => a[1].localeCompare(b[1]));
  const subtypes = Object.keys(pf1.config.creatureSubtypes ?? {}).map((k) => [typeKey(k), subtypeName(typeKey(k))]).sort((a, b) => a[1].localeCompare(b[1]));
  const bane = q.ids.has("bane") && (WEAPONS.has(item.type) || isAmulet(item))
    ? `<div class="form-group stacked"><label>Bane: designated foe</label><div class="form-fields" style="flex-wrap:wrap; gap:4px">
        <select data-wq-bane="type" ${editable ? "" : "disabled"}><option value="">Type…</option>${types.map(([k, l]) => `<option value="${k}" ${q.bane?.types?.[0] === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <select data-wq-bane="subtype" ${editable ? "" : "disabled"}><option value="">(no subtype)</option>${subtypes.map(([k, l]) => `<option value="${k}" ${q.bane?.subtypes?.[0] === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      </div><p class="hint">Humanoids and outsiders name one subtype.</p></div>`
    : "";
  const energy = q.names.some((n) => ARMOR_ABILITIES[n.toLowerCase()]?.resist)
    ? `<div class="form-group"><label>Energy resistance: energy</label><div class="form-fields"><select data-wq-energy ${editable ? "" : "disabled"}><option value="">Choose…</option>${Object.entries(ENERGY_TYPES).map(([k, l]) => `<option value="${k}" ${q.energy === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>`
    : "";
  const amuletHint = isAmulet(item) ? `<p class="hint">Its enhancement bonus (set in its Changes) and abilities apply to the wearer's unarmed strikes and natural weapons; abilities that need piercing, slashing or ranged weapons can't go on it, and no +1 is needed first.</p>` : "";
  const problems = problemsFrom(item, cat);
  const priced = item.type !== "attack" && !q.specific; // attacks (natural, misc) have no price
  const price = !priced || base === null || base === undefined ? null : priceFrom(item, base, cat);
  const cat2 = cat.size ? "" : `<p class="hint">Pathfinder 1e Content isn't active: qualities can only be read from the name.</p>`;
  return `
    <h3 class="form-header ${MODULE_ID}-magic-header">Magic Qualities (PF1e Revamp)</h3>
    <div class="${MODULE_ID}-magic">
      ${cat2}
      <p class="hint">${q.fromName ? (q.names.length ? "Read from the item's name. Changing them here replaces the name's." : "None. Add them here, or name them in the item's name.") : "Chosen here (the name isn't read)."}</p>
      <ul style="list-style:none; margin:0.25em 0; padding:0">${chips || '<li style="opacity:0.7">No special abilities.</li>'}</ul>
      ${(() => {
        const temps = temporaryOf(item).filter((t) => t.label);
        const worn = temps.filter((t) => t.worn);
        const timed = temps.filter((t) => !t.worn);
        return [
          worn.length ? `<p class="hint"><i class="fa-solid fa-gem"></i> From ${worn.map((t) => `the worn ${esc(t.source)}: ${esc(t.label)}`).join("; ")}</p>` : "",
          timed.length ? `<p class="hint"><i class="fa-regular fa-hourglass-half"></i> For a time: ${timed.map((t) => `${esc(t.label)} (${esc(t.source)})`).join("; ")}</p>` : "",
        ].join("");
      })()}
      ${editable && cat.size ? `<div class="form-group"><label>Add an ability</label><div class="form-fields"><select data-wq-add><option value="">Choose…</option>${options}</select><button type="button" data-wq-add-button style="flex:0 0 auto; width:auto">Add</button></div></div>` : ""}
      ${amuletHint}
      ${bane}
      ${energy}
      <div class="form-group"><label>Specific magic item</label><div class="form-fields"><input type="checkbox" data-wq-specific ${q.specific ? "checked" : ""} ${editable ? "" : "disabled"}></div>
        <p class="hint">A named item (Frost Brand, Holy Avenger): its abilities still work, but its name and price aren't worked out.</p></div>
      ${problems.map((p) => `<p class="notification warning" style="margin:0.25em 0">${esc(p)}</p>`).join("")}
      ${!priced ? "" : `<div class="form-group"><label>Price from parts</label><div class="form-fields"><span>${esc(priceText(price))}</span>${editable ? `<button type="button" data-wq-price style="flex:0 0 auto; width:auto">Update price…</button>` : ""}</div></div>`}
    </div>`;
}

/** Ask for the plain item's price, show the parts, and set the item's price. */
export async function updatePrice(item) {
  const guess = (await basePriceOf(item)) ?? item.system.price ?? 0;
  const render = async (base) => {
    const p = await priceOf(item, base);
    return `<table>${p.lines.map((l) => `<tr><td>${esc(l.label)}</td><td style="text-align:right">${gp(l.gp)}</td></tr>`).join("")}<tr><th>Total</th><th style="text-align:right">${gp(p.total)}</th></tr></table>${p.unknown.length ? `<p class="hint">No price known for ${esc(p.unknown.join(", "))}.</p>` : ""}`;
  };
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: titleFor(`${item.name}: price`, item.actor) },
    position: { width: 420 },
    content: `<div class="form-group"><label>Price of the plain item (gp)</label><div class="form-fields"><input type="number" name="base" min="0" step="any" value="${guess}"></div></div><div data-wq-lines>${await render(guess)}</div>`,
    render: (event, dialog) => {
      const input = dialog.element.querySelector("input[name=base]");
      input.addEventListener("input", async () => (dialog.element.querySelector("[data-wq-lines]").innerHTML = await render(Number(input.value) || 0)));
    },
    buttons: [
      { action: "apply", label: "Set the price", default: true, callback: (event, button) => Number(button.form.elements.base.value) || 0 },
      { action: "cancel", label: "Cancel" },
    ],
    rejectClose: false,
  });
  if (typeof result !== "number") return null;
  const p = await priceOf(item, result);
  await item.update({ "system.price": p.total, [`flags.${MODULE_ID}.${FLAG}.basePrice`]: result });
  return p.total;
}

// The catalog loads once, when the game is ready; a sheet opened before it's in is redrawn when it is.
// The section is built without waiting, so it appears with the rest of the sheet.
Hooks.once("ready", () => loadCatalog());
Hooks.on("renderItemSheetPF", (app, html) => {
  const item = app.item;
  if (!isArms(item)) return;
  if (!catalogReady && !item.showUnidentifiedData) return void loadCatalog().then(() => app.rendered && app.render());
  const root = html[0] ?? html;
  const tab = root.querySelector(".tab[data-tab=details]");
  if (!tab || tab.querySelector(`.${MODULE_ID}-magic`)) return;
  const section = document.createElement("div");
  if (item.showUnidentifiedData) section.innerHTML = `<h3 class="form-header ${MODULE_ID}-magic-header">Magic Qualities (PF1e Revamp)</h3><div class="${MODULE_ID}-magic"><p class="hint">Unidentified.</p></div>`;
  else {
    const cat = catalogReady;
    const base = basePriceNow(item);
    if (base === undefined) basePriceOf(item).then(() => app.rendered && app.render()); // first time: look it up, then redraw
    section.innerHTML = panelHTML(item, cat, base);
  }
  // After PF1's materials (Materials, Add-on, Alignment Traits), before the next section
  const headers = [...tab.querySelectorAll(".form-header")];
  const after = headers.findLast((h) => /alignment traits|add-on|materials/i.test(h.textContent));
  const next = after ? headers[headers.indexOf(after) + 1] : null;
  if (next) next.before(...section.children);
  else tab.append(...section.children);
  const panel = tab.querySelector(`.${MODULE_ID}-magic`);
  if (!panel || !item.isOwner || item.showUnidentifiedData) return;
  // PF1's sheet saves and redraws on any change in its form, which would wipe a choice before Add is
  // clicked: the section's own controls handle their events, and they stop here
  for (const type of ["change", "input"]) panel.addEventListener(type, (event) => event.stopPropagation());
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault(); // Enter in the search box would submit the sheet
  });
  const select = panel.querySelector("[data-wq-add]");
  if (select) {
    addSearch(select);
    // While searching, the matches show as a list to click; the best match is chosen (the name itself, then
    // the shortest name starting with the text: "flam" → Flaming, not Flamboyant, Greater)
    const search = select.previousElementSibling;
    search?.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      const shown = [...select.options].filter((o) => o.value && !o.hidden);
      select.size = q && shown.length > 1 ? Math.min(8, shown.length + select.querySelectorAll("optgroup").length) : 0;
      select.style.height = select.size > 1 ? "auto" : ""; // PF1's sheet fixes a dropdown's height
      if (!q) return;
      const named = (o) => o.value.toLowerCase();
      const best = shown.find((o) => named(o) === q) ?? shown.filter((o) => named(o).startsWith(q)).sort((a, b) => a.value.length - b.value.length)[0] ?? shown[0];
      if (best) select.value = best.value;
    });
    select.addEventListener("dblclick", () => panel.querySelector("[data-wq-add-button]")?.click());
  }
  panel.querySelector("[data-wq-add-button]")?.addEventListener("click", async () => {
    if (!select.value) return;
    const q = qualitiesOf(item);
    await saveQualities(item, { qualities: [...q.names, select.value] });
  });
  panel.querySelectorAll("[data-wq-remove]").forEach((a) =>
    a.addEventListener("click", async () => {
      const q = qualitiesOf(item);
      await saveQualities(item, { qualities: q.names.filter((_, i) => i !== Number(a.dataset.wqRemove)) });
    })
  );
  panel.querySelectorAll("[data-wq-bane]").forEach((s) => {
    addSearch(s);
    s.addEventListener("change", async () => {
      const type = panel.querySelector("[data-wq-bane=type]").value;
      const subtype = panel.querySelector("[data-wq-bane=subtype]").value;
      if (OUTSIDER_OR_HUMANOID.has(type) && !subtype && s.dataset.wqBane === "type") return ui.notifications.info("A humanoid or outsider bane names one subtype: choose it next.");
      await saveQualities(item, { bane: type || subtype ? { types: type ? [type] : [], subtypes: subtype ? [subtype] : [] } : null });
    });
  });
  panel.querySelector("[data-wq-energy]")?.addEventListener("change", (e) => saveQualities(item, { energy: e.target.value || null }));
  panel.querySelector("[data-wq-specific]")?.addEventListener("change", (e) => saveQualities(item, { specific: e.target.checked }));
  panel.querySelector("[data-wq-price]")?.addEventListener("click", () => updatePrice(item));
});

export const _test = { panelHTML, basePriceNow, qualitiesOf, baneFromName, parsePrice, priceOf, problemsOf, generatedName, materialDR, armorGrants, armorFromName, amuletFits, loadCatalog, saveQualities, FLAG };
