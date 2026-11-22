// Polymorph: casting a polymorph spell (or using Wild Shape) opens PF1 Mighty Morphin's form picker for the creature,
// at the spell's level and caster level, when that module is active. Mighty Morphin applies the form (size, ability
// scores, natural armor, attacks, speeds, senses) and reverts it; this file starts it and ends it with the spell.
// Monstrous Physique and Undead Anatomy, which Mighty Morphin doesn't have, are applied here from their size tables.
//
// Rules (Core Rulebook, Magic, Polymorph; the spells' text):
//   - "You can only be affected by one polymorph spell at a time. If a new polymorph spell is cast on you (or you
//     activate a polymorph effect, such as wild shape), you can decide whether or not to allow it to affect you,
//     taking the place of the old spell." A picker for a creature already transformed asks first.
//   - "other spells that change your size have no effect on you while you are under the effects of a polymorph
//     spell" (spells.mjs asks sizeBlocked()).
//   - Polymorph: "transforms a willing creature into an animal, humanoid or elemental of your choosing ... animal or
//     magical beast, the spell functions as Beast Shape II ... elemental, Elemental Body I ... humanoid, Alter
//     Self." Greater polymorph: Beast Shape IV, Elemental Body III, Alter Self, Plant Shape II, Form of the Dragon
//     I. Shapechange: Alter Self, Beast Shape IV, Elemental Body IV, Form of the Dragon III, Giant Form II, Plant
//     Shape III.
//   - Baleful polymorph: "As beast shape III, except that you change the subject into a Small or smaller animal of
//     no more than 1 HD ... Any polymorph effects on the target are automatically dispelled" (spells.mjs, on a
//     failed Fortitude save: the GM picks the animal).
//   - Wild shape (druid): beast shape I at 4th level, II and elemental body I at 6th, III, elemental body II and
//     plant shape I at 8th, elemental body III and plant shape II at 10th, beast shape IV, elemental body IV and
//     plant shape III at 12th.
//   - Monstrous physique I-IV, undead anatomy I-IV: the size tables below (size bonuses to ability scores, natural
//     armor); the abilities the spell level allows are listed on the buff, the form's own attacks are added by hand.

import { MODULE_ID } from "./const.mjs";
import { esc, gmWhisper, onGmRequest } from "./util.mjs";
import { baseSpellName, metamagicOf, extendFactor } from "./metamagic.mjs";

const MM = "pf1-mighty-morphin";
export const morphinActive = () => !!game.modules.get(MM)?.active && !!game.mightyMorphin;
const FLAG = "polymorph"; // our own buffs' flag (Monstrous Physique, Undead Anatomy)

// Spells Mighty Morphin applies: its function and the spell level it plays (several: the caster picks the family)
const SHAPES = {
  "alter self": [["alterSelf", 1]],
  ...Object.fromEntries(["i", "ii", "iii", "iv"].map((n, i) => [`beast shape ${n}`, [["beastShape", i + 1]]])),
  ...Object.fromEntries(["i", "ii", "iii", "iv"].map((n, i) => [`elemental body ${n}`, [["elementalBody", i + 1]]])),
  ...Object.fromEntries(["i", "ii", "iii"].map((n, i) => [`plant shape ${n}`, [["plantShape", i + 1]]])),
  ...Object.fromEntries(["i", "ii"].map((n, i) => [`vermin shape ${n}`, [["verminShape", i + 1]]])),
  ...Object.fromEntries(["i", "ii"].map((n, i) => [`giant form ${n}`, [["giantForm", i + 1]]])),
  ...Object.fromEntries(["i", "ii", "iii"].map((n, i) => [`form of the dragon ${n}`, [["formOfTheDragon", i + 1]]])),
  "magical beast shape": [["magicalBeastShape", 1]],
  polymorph: [["beastShape", 2], ["elementalBody", 1], ["alterSelf", 1]],
  "polymorph, greater": [["beastShape", 4], ["elementalBody", 3], ["alterSelf", 1], ["plantShape", 2], ["formOfTheDragon", 1]],
  shapechange: [["alterSelf", 1], ["beastShape", 4], ["elementalBody", 4], ["formOfTheDragon", 3], ["giantForm", 2], ["plantShape", 3]],
};
const FAMILY = { alterSelf: "a humanoid (Alter Self)", beastShape: "an animal or magical beast (Beast Shape)", elementalBody: "an elemental (Elemental Body)", plantShape: "a plant (Plant Shape)", verminShape: "a vermin (Vermin Shape)", giantForm: "a giant (Giant Form)", formOfTheDragon: "a dragon (Form of the Dragon)", magicalBeastShape: "a magical beast" };
const ROMAN = ["", "I", "II", "III", "IV"];

// Monstrous Physique and Undead Anatomy: by spell level, the sizes allowed and their changes ([target, formula, type])
const sizeBonus = (str, dex, nac, con = 0) => [str && ["str", str, str > 0 ? "size" : "untyped"], dex && ["dex", dex, dex > 0 ? "size" : "untyped"], con && ["con", con, "size"], ["nac", nac, "untyped"]].filter(Boolean);
const ONE = { sm: sizeBonus(0, 2, 1), med: sizeBonus(2, 0, 2) };
const TWO = { ...ONE, tiny: sizeBonus(-2, 4, 1), lg: sizeBonus(4, -2, 4) };
const THREE = { ...TWO, dim: sizeBonus(-4, 6, 1), huge: sizeBonus(6, -4, 6) };
const MP_ABILITIES = [
  "climb 30 feet, fly 30 feet (average), swim 30 feet, darkvision 60 feet, low-light vision, scent; aquatic: the aquatic and amphibious subtypes",
  "climb 60 feet, fly 60 feet (good), swim 60 feet, darkvision 60 feet, low-light vision, scent, freeze, grab, leap attack, mimicry, pounce, sound mimicry, speak with sharks, trip; undersized weapons",
  "burrow 30 feet, climb 90 feet, fly 90 feet (good), swim 90 feet, all-around vision, blindsense 30 feet, darkvision 60 feet, low-light vision, scent, blood frenzy, cold vigor, constrict, ferocity, freeze, grab, horrific appearance, jet, leap attack, mimicry, natural cunning, overwhelming, poison, pounce, rake, sound mimicry, speak with sharks, trample, trip, web; undersized weapons",
  "burrow 60 feet, climb 90 feet, fly 120 feet (good), swim 120 feet, blindsense 60 feet, darkvision 90 feet, low-light vision, scent, tremorsense 60 feet, blood frenzy, breath weapon, cold vigor, constrict, ferocity, freeze, grab, horrific appearance, jet, leap attack, mimicry, natural cunning, overwhelming, poison, pounce, rake, rend, roar, sound mimicry, speak with sharks, spikes, trample, trip, web; energy immunity or resistance: resistance 20; its vulnerabilities; poison immunity: +8 on saves against poison",
];
const UA_COMMON = "bite and two claws or slams (1d6 each, 1d4 if Small), darkvision 60 feet; treated as undead for channeled energy, cure and inflict spells";
const UA_ABILITIES = [
  `${UA_COMMON}; climb 30 feet, fly 30 feet (average), swim 30 feet, low-light vision, scent`,
  `${UA_COMMON}; climb 60 feet, fly 60 feet (good), swim 60 feet, low-light vision, blood drain, DR 5/bludgeoning, scent, freeze, grab, mimicry, pounce, shadowless, sound mimicry, trip; +4 on saves against mind-affecting effects, disease, poison, sleep and stunning; its vulnerabilities`,
  `${UA_COMMON}; burrow 30 feet, climb 90 feet, fly 90 feet (good), swim 90 feet, all-around vision, blindsense 30 feet, low-light vision, scent, constrict, disease, DR 5/-, fear aura, grab, jet, natural cunning, overwhelming, poison, pounce, rake, trample, trip, unnatural aura, web; energy immunity or resistance: resistance 20; +8 on saves against mind-affecting effects, disease, poison, sleep and stunning; its vulnerabilities`,
  `${UA_COMMON}; burrow 60 feet, climb 90 feet, fly 120 feet (good), swim 120 feet, blindsense 60 feet, darkvision 90 feet, lifesense 60 feet, low-light vision, scent, tremorsense 60 feet, breath weapon, constrict, DR 10/magic and silver, DR 15/bludgeoning and magic, fast healing 5, fiery death, fire aura, grab, incorporeal (the duration becomes rounds per level; bite and claws are incorporeal touch attacks), jet, poison, pounce, rake, rend, roar, spikes, trample, trip, web; energy immunity or resistance: resistance 30; +8 on saves against mind-affecting effects, disease, poison, sleep and stunning; its vulnerabilities`,
];
const SAVE_NOTE = [null, "+4 on saves against mind-affecting effects, disease, poison, sleep and stunning", "+8 on saves against mind-affecting effects, disease, poison, sleep and stunning", "+8 on saves against mind-affecting effects, disease, poison, sleep and stunning"];
const OWN = {
  ...Object.fromEntries(["i", "ii", "iii", "iv"].map((n, i) => [`monstrous physique ${n}`, { type: "monstrous humanoid", sizes: [ONE, TWO, THREE, THREE][i], abilities: MP_ABILITIES[i] }])),
  ...Object.fromEntries(["i", "ii", "iii", "iv"].map((n, i) => [`undead anatomy ${n}`, { type: "undead", sizes: [ONE, TWO, THREE, { ...THREE, tiny: sizeBonus(-2, 8, 3), lg: sizeBonus(6, -2, 6, 2) }][i], abilities: UA_ABILITIES[i], saves: SAVE_NOTE[i] }])),
};
const SIZE_ORDER = ["fine", "dim", "tiny", "sm", "med", "lg", "huge", "grg", "col"];
const SIZE_NAMES = { dim: "Diminutive", tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge" };

// Spells that change size (no effect while polymorphed) and Mighty Morphin's own size effects (not polymorphs)
const SIZE_SPELLS = new Set(["enlarge person", "enlarge person, mass", "reduce person", "reduce person, mass", "righteous might", "animal growth", "legendary proportions", "reduce animal", "frightful aspect"]);
const MM_SIZE_EFFECTS = new Set(["enlarge-person", "reduce-person", "legendary-proportions", "frightful-aspect", "animal-growth", "righteous-might", "mauler-battle-form", "shifter-aspect"]);
/** Mighty Morphin's polymorph entries on the creature: [key, { source, buffName }] (not its size effects or bookkeeping). */
const shapesOn = (actor) => Object.entries(actor?.flags?.[MM] ?? {}).filter(([key, v]) => v?.source && !MM_SIZE_EFFECTS.has(key));

/** Spells this file handles (their card has no rows): Mighty Morphin's while it's active, and our own. */
export function handlesSpell(name) {
  const n = String(name ?? "").toLowerCase();
  return n in OWN || (n in SHAPES && morphinActive());
}

/** Is the creature under a polymorph effect (Mighty Morphin's or ours)? */
export function polymorphOf(actor) {
  const own = actor?.itemTypes?.buff.find((b) => b.isActive && b.flags?.[MODULE_ID]?.[FLAG]);
  if (own) return own.name;
  const [, mm] = shapesOn(actor)[0] ?? [];
  return mm ? (mm.buffName ?? mm.source) : null;
}
/** A size-changing spell on a polymorphed creature has no effect: the reason, or null. */
export function sizeBlocked(spellName, actor) {
  if (!SIZE_SPELLS.has(String(spellName ?? "").toLowerCase())) return null;
  const form = polymorphOf(actor);
  return form ? `no effect: polymorphed (${form}); other size changes don't apply` : null;
}

/** End the creature's current polymorph (Mighty Morphin's revert, or our buff). */
async function endPolymorph(actor) {
  const own = actor.itemTypes.buff.filter((b) => b.flags?.[MODULE_ID]?.[FLAG]).map((b) => b.id);
  if (own.length) await actor.deleteEmbeddedDocuments("Item", own);
  if (morphinActive()) for (const [, v] of shapesOn(actor)) await game.mightyMorphin.revert({ actor, buff: v.source });
}
/** One polymorph at a time: ask before replacing the current one. False when the user keeps it. */
async function replaceCurrent(actor) {
  const form = polymorphOf(actor);
  if (!form) return true;
  const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Already transformed" }, content: `<p>${esc(actor.name)} is already under ${esc(form)}. Replace it with the new form?</p>` });
  if (ok) await endPolymorph(actor);
  return !!ok;
}

/**
 * Open Mighty Morphin's picker for this creature. Its commands act on the selected token, so the creature's token
 * is selected for the call and the previous selection restored.
 */
export async function openPicker(actor, fn, level, cl, { source = null, nameOverride = null, replace = true, end = false } = {}) {
  if (!morphinActive()) return false;
  const token = actor.getActiveTokens(false, false).find((t) => t.scene === canvas.scene);
  if (!token) {
    ui.notifications.warn(`${actor.name}: place the creature's token on this scene to choose its form.`);
    return false;
  }
  if (end) await endPolymorph(actor);
  else if (replace && !(await replaceCurrent(actor))) return false;
  const before = canvas.tokens.controlled.slice();
  token.control({ releaseOthers: true });
  // The command reads the selection synchronously, before its first await
  // The source stays Mighty Morphin's own (its revert knows those); another spell's name goes on the buff
  const opened = game.mightyMorphin[fn]({ level, durationLevel: cl, ...(source ? { source } : {}), ...(nameOverride ? { nameOverride } : {}) });
  token.release();
  for (const t of before) t.control({ releaseOthers: false });
  await opened;
  return true;
}

/** The caster picks the family when the spell allows several (Polymorph, Shapechange, Wild Shape). */
async function pickFamily(title, options) {
  if (options.length === 1) return options[0];
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title },
    content: `<p>Which kind of form?</p><select name="family">${options.map(([fn, level], i) => `<option value="${i}">${esc(FAMILY[fn])}${level > 1 || fn !== "alterSelf" ? ` (${ROMAN[level] ?? level})` : ""}</option>`).join("")}</select>`,
    buttons: [{ action: "ok", label: "Choose", default: true, callback: (event, button) => Number(button.form.elements.family.value) }],
    rejectClose: false,
  });
  return picked == null ? null : options[picked];
}

/** Monstrous Physique, Undead Anatomy: pick the size; the buff carries its size bonuses and the abilities allowed. */
/** `minutes`: the buff's duration (the caster level, doubled by Extend Spell). */
export async function ownForm(actor, spellName, cl, { size = null, minutes = cl } = {}) {
  const spell = OWN[spellName.toLowerCase()];
  if (!spell) return null;
  const sizes = Object.keys(spell.sizes).sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  if (!size) {
    size = await foundry.applications.api.DialogV2.wait({
      window: { title: `${spellName}: the form's size` },
      content: `<p>The size of the ${esc(spell.type)} form:</p><select name="size">${sizes.map((s) => `<option value="${s}"${s === "med" ? " selected" : ""}>${SIZE_NAMES[s]}</option>`).join("")}</select>`,
      buttons: [{ action: "ok", label: "Transform", default: true, callback: (event, button) => button.form.elements.size.value }],
      rejectClose: false,
    });
    if (!size) return null;
    if (!(await replaceCurrent(actor))) return null;
  }
  const base = actor.system.traits?.size?.base ?? "med";
  const steps = SIZE_ORDER.indexOf(size) - SIZE_ORDER.indexOf(base);
  const changes = spell.sizes[size].map(([target, formula, type]) => ({ target, formula: String(formula), type }));
  if (steps) changes.push({ target: "size", formula: String(steps), type: "untyped" });
  const notes = [{ text: `${spellName} (${SIZE_NAMES[size]} ${spell.type}): if the form has them, ${spell.abilities}. The form's attacks are added by hand.`, target: "misc" }];
  if (spell.saves) notes.push({ text: `${spell.saves} (${spellName})`, target: "allSavingThrows" });
  const [buff] = await actor.createEmbeddedDocuments("Item", [{
    name: `${spellName} (${SIZE_NAMES[size]})`, type: "buff", img: "icons/svg/pawprint.svg",
    system: { subType: "spell", active: true, level: cl, duration: { value: String(minutes), units: "minute" }, changes, contextNotes: notes },
    flags: { [MODULE_ID]: { [FLAG]: { spell: spellName, size } } },
  }]);
  return buff;
}

const authorOwns = (message, actor) => !!actor && (game.user.isGM || actor.testUserPermission(game.user, "OWNER"));

// Casting: the caster's game opens the picker (the GM's when the caster can't change the target)
Hooks.on("createChatMessage", async (message, options, userId) => {
  if (userId !== game.user.id || message.type !== "action") return;
  const item = message.itemSource;
  if (!item) return;
  const caster = ChatMessage.implementation.getSpeakerActor(message.speaker);
  const cl = message.system.config?.cl ?? item.system?.cl ?? 1;
  // Extend Spell: the form lasts twice as long (Mighty Morphin counts its duration from this level)
  const span = cl * extendFactor(metamagicOf(message));
  const name = (item.type === "spell" ? baseSpellName(item) : item.system?.spellName ?? item.name ?? "").replace(/^(scroll|wand|potion) of /i, "");
  const key = name.toLowerCase();
  // Wild Shape (a druid's class ability and its archetype versions)
  if (item.type === "feat" && /^wild shape\b/i.test(item.name) && morphinActive() && caster) {
    const level = caster.classes?.druid?.level ?? caster.system.attributes?.hd?.total ?? 0;
    const families = [
      level >= 4 && ["beastShape", level >= 12 ? 4 : level >= 8 ? 3 : level >= 6 ? 2 : 1],
      level >= 6 && ["elementalBody", level >= 12 ? 4 : level >= 10 ? 3 : level >= 8 ? 2 : 1],
      level >= 8 && ["plantShape", level >= 12 ? 3 : level >= 10 ? 2 : 1],
    ].filter(Boolean);
    if (!families.length) return;
    const pick = await pickFamily("Wild Shape", families);
    if (pick) await openPicker(caster, pick[0], pick[1], level, { source: game.i18n.localize("MMMOD.WildShape") });
    return;
  }
  if (key in OWN && caster) return void (await ownForm(caster, name, cl, { minutes: span }));
  if (!(key in SHAPES) || !morphinActive()) return;
  // Polymorph and Greater Polymorph: the willing creature touched (the caster chooses the form)
  const targetUuid = message.system.targets?.[0];
  const target = (targetUuid ? fromUuidSync(targetUuid)?.actor : null) ?? caster;
  if (!target) return;
  const pick = await pickFamily(name, SHAPES[key]);
  if (!pick) return;
  const nameOverride = SHAPES[key].length > 1 ? name : null; // Polymorph's buff is named after it, not Beast Shape
  if (authorOwns(message, target)) return void (await openPicker(target, pick[0], pick[1], span, { nameOverride }));
  await ChatMessage.implementation.create({ whisper: gmWhisper(), content: `<p>${esc(name)}: choose ${esc(target.name)}'s form</p>`, flags: { [MODULE_ID]: { morphPicker: { actor: target.uuid, fn: pick[0], level: pick[1], cl: span, nameOverride } } } });
});
onGmRequest("morphPicker", async (request, { actor, fn, level, cl, nameOverride }) => {
  await request.delete();
  const a = fromUuidSync(actor);
  if (a) await openPicker(a, fn, level, cl, { nameOverride });
});

// The spell ends (its buff turned off or deleted): Mighty Morphin reverts the form, unless its own setting already
// does that with a script call on the buff
const reverting = new Set(); // actor uuids: one revert at a time
async function buffEnded(item, userId) {
  if (userId !== game.user.id || item.type !== "buff" || !morphinActive() || game.settings.get(MM, "createScriptCall")) return;
  const actor = item.actor;
  // Its buff is "<name> (<form>)", the entry's buffName the part before the form
  const owns = ([, v]) => item.name === v.buffName || item.name.startsWith(`${v.buffName} (`);
  const entry = shapesOn(actor).find(owns);
  if (!entry || reverting.has(actor.uuid)) return;
  reverting.add(actor.uuid);
  try {
    // Mighty Morphin's own revert deletes its buff too: let it finish first
    await new Promise((r) => setTimeout(r, 250));
    if (shapesOn(actor).some(owns)) await game.mightyMorphin.revert({ actor, buff: entry[1].source });
  } finally {
    reverting.delete(actor.uuid);
  }
}
Hooks.on("updateItem", (item, changes, options, userId) => {
  if (changes.system?.active === false) buffEnded(item, userId);
});
Hooks.on("deleteItem", (item, options, userId) => buffEnded(item, userId));

export const _test = { SHAPES, OWN, FLAG, ownForm, polymorphOf, sizeBlocked, handlesSpell };
