// Weapon qualities (on-hit riders, phase 4a): what the magic weapon special abilities do to an attack:
// damage, critical range and alignment. Which qualities a weapon has comes from magic-arms.mjs (chosen in
// the Magic Qualities panel on the weapon's Details tab, or read from its name). Rulings: DECISIONS.md,
// "Weapon qualities".
//
// Rules (Core Rulebook and Ultimate Equipment, verbatim where quoted):
//   - Flaming, frost, shock, corrosive: "an extra 1d6 points of fire [cold, electricity, acid] damage on a
//     successful hit"; on and off "upon command" (a row in the roll window). Extra dice are never
//     multiplied on a critical hit; energy resistance applies to each energy type on its own.
//   - Flaming burst, icy burst, shocking burst, corrosive burst: function as the base quality, and "an
//     extra 1d10 points of fire damage on a successful critical hit. If the weapon's critical multiplier
//     is 3, add an extra 2d10 ... if the multiplier is 4, add an extra 3d10". "Even if the flaming ability
//     is not active, the weapon still deals its extra fire damage on a successful critical hit."
//   - Thundering: "an extra 1d8 points of sonic damage on a successful critical hit" (2d8 at ×3, 3d8 at
//     ×4). Its "DC 14 Fortitude save or be deafened permanently" comes with the hit effects (phase 4b).
//   - Holy, unholy, axiomatic, anarchic: the weapon is good [evil, lawful, chaotic] "and thus bypasses the
//     corresponding damage reduction"; "an extra 2d6 points of damage against all creatures of evil [good,
//     chaotic, lawful] alignment". Untyped: energy resistance doesn't reduce it. The negative level on a
//     wielder of the opposed alignment is left as a note.
//   - Bane: "Against a designated foe, the weapon's enhancement bonus is +2 better than its actual bonus.
//     It also deals an extra 2d6 points of damage against such foes." Humanoid and outsider foes name one
//     subtype.
//   - Keen: "doubles the threat range of a weapon. Only piercing or slashing melee weapons can be keen ...
//     doesn't stack with any other effects that expand the threat range" (an expansion already on the roll,
//     from Roll Bonuses' Improved Critical or keen edge, is left as it is).
//   - Vicious: "an extra 2d6 points of damage to the opponent and 1d6 points of damage to the wielder"
//     whenever it strikes; the wielder's 1d6 is applied once the module can tell the attack hit, else by a
//     button on the card, as for natural-attack riders.
//   - Merciful: "an extra 1d6 points of damage, but all damage it deals is nonlethal damage"; suppressed on
//     command (lethal damage, no extra die): unticking its row.
//   - Brilliant energy: "Armor and shield bonuses to AC (including any enhancement bonuses to that armor) do
//     not count against it because the weapon passes through armor. (Dexterity, deflection, dodge, natural
//     armor, and other such bonuses still apply.) A brilliant energy weapon cannot harm undead, constructs,
//     or objects." The target's armor and shield bonuses (its AC less its touch AC and natural armor) are
//     added to the attack roll against a single target; damage applied to undead and constructs is 0.
//   - Seeking (miss-chance.mjs), and wounding, disruption, thundering's deafness and vorpal
//     (natural-riders.mjs) act on the hit.
// The extra dice apply to each arrow of Manyshot (they aren't precision damage). When the action already
// has the die typed in (PF1's suggested setup), the module doesn't add its own. A player using an
// unidentified weapon sees its rows as "Unidentified quality".

import { MODULE_ID, ATTACK_ACTIONS } from "./const.mjs";
import { esc, dealDamage, restoreDamage, rollTotal, isActiveGM, wrapMethod } from "./util.mjs";
import { registerRollEffect, rollPlan } from "./roll-effects.mjs";
import { registerFootnote } from "./footnote.mjs";
import { matchesCreatures, creatureTypes } from "./creature-types.mjs";
import { hitOf } from "./natural-riders.mjs";
import { QUALITIES, qualitiesOf, foeText, keenWorks, fits, limitText } from "./magic-arms.mjs";

const FLAG = "weaponQualities"; // card flag: { vicious }
const ENERGY_NAME = { fire: "fire", cold: "cold", electric: "electricity", acid: "acid", sonic: "sonic" };

const typesOf = (part) => [...(part?.types ?? [])];
/** Is this die already typed into the action (PF1's suggested setup for a flaming weapon)? */
const typedIn = (action, prop, formula, type) => (action?.damage?.[prop] ?? []).some((p) => String(p.formula ?? "").replace(/\s+/g, "") === formula && typesOf(p).includes(type));

/* -------------------------------------------- */
/*  The roll window                             */
/* -------------------------------------------- */

/** Applies when every target is of the kind: { applies, reason }. */
function against(spec, what) {
  const targets = [...game.user.targets].map((t) => t.actor).filter(Boolean);
  if (!targets.length) return { applies: false, reason: "no target selected" };
  const results = targets.map((a) => matchesCreatures(a, spec));
  if (results.every((r) => r === true)) return { applies: true };
  if (results.includes(null)) return { applies: false, reason: `a target's ${spec.alignments.length ? "alignment" : "creature type"} isn't known` };
  return { applies: false, reason: targets.length > 1 && results.some(Boolean) ? `only some targets are ${what}` : `the target isn't ${what}` };
}

registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "attack") return [];
    const { action } = roll;
    const q = qualitiesOf(action.item);
    if (!q?.ids.size || !action.damage?.parts?.length) return [];
    const hidden = !!action.item.showUnidentifiedData;
    const out = [];
    const entry = (id, fields) => {
      if (fits(id, action) === false) return; // "Only piercing or slashing melee weapons can be keen"
      const e = { id: `wq-${id}`, label: QUALITIES[id].name, type: "untyped", showIn: ["dmg"], applies: true, perArrow: true, ...fields };
      if (hidden) Object.assign(e, { label: "Unidentified quality", partLabel: e.partLabel ? { atk: "Unidentified quality", dmg: "Unidentified quality" } : undefined, tooltip: "A quality of this unidentified weapon" });
      out.push(e);
    };
    for (const id of ["flaming", "frost", "shock", "corrosive"]) {
      const type = QUALITIES[id].energy;
      if (q.ids.has(id) && !typedIn(action, "nonCritParts", "1d6", type)) entry(id, { dice: { dmg: "1d6" }, damageTypes: [type], tooltip: `+1d6 ${ENERGY_NAME[type]} on a hit. It works on command: untick it while it's off.` });
    }
    for (const id of ["flamingBurst", "icyBurst", "shockingBurst", "corrosiveBurst", "thundering"]) {
      const { crit, energy, name } = QUALITIES[id];
      if (!q.ids.has(id) || typedIn(action, "critParts", crit, energy)) continue;
      const die = crit.slice(1);
      entry(id, { critDamage: [{ formula: crit, types: [energy], label: hidden ? "Unidentified quality" : name }], valueText: `+${crit} ${ENERGY_NAME[energy]} on a critical hit`, tooltip: `On a critical hit: ${crit} ${ENERGY_NAME[energy]} at ×2, 2${die} at ×3, 3${die} at ×4.` });
    }
    for (const id of ["holy", "unholy", "axiomatic", "anarchic"]) {
      if (!q.ids.has(id)) continue;
      const foe = QUALITIES[id].against;
      entry(id, { dice: { dmg: "2d6" }, tooltip: `+2d6 against ${foe} creatures`, ...against({ types: [], subtypes: [], alignments: [foe] }, foe) });
    }
    if (q.ids.has("bane")) {
      const label = q.bane ? `Bane (${foeText(q.bane)})` : "Bane";
      const applies = q.bane ? against({ ...q.bane, alignments: [] }, foeText(q.bane)) : { applies: false, reason: "choose the designated foe in the weapon's Magic Qualities" };
      entry("bane", { label, type: "enh", atk: 2, dmg: 2, dice: { dmg: "2d6" }, showIn: ["atk", "dmg"], partLabel: { atk: label, dmg: label }, valueText: "+2, +2d6 damage", tooltip: "Against the designated foe: the enhancement bonus is +2 better, and +2d6 damage", ...applies });
    }
    if (q.ids.has("vicious")) entry("vicious", { dice: { dmg: "2d6" }, tooltip: "+2d6 to the opponent, and 1d6 to the wielder on each hit" });
    if (q.ids.has("brilliantEnergy")) {
      const targets = [...game.user.targets].map((t) => t.actor).filter(Boolean);
      const through = targets.length === 1 ? armorAndShield(targets[0]) : 0;
      const label = hidden ? "Unidentified quality" : "Brilliant energy";
      const why = targets.length !== 1 ? (targets.length ? "more than one target: each target's armor differs" : "no target selected") : "the target has no armor or shield bonus";
      entry("brilliantEnergy", { atk: through, dice: undefined, perArrow: false, showIn: ["atk"], partLabel: { atk: label }, applies: through > 0, reason: why, tooltip: `Passes through armor: the target's armor and shield bonuses (+${through}) don't count against it` });
    }
    if (q.ids.has("merciful")) entry("merciful", { dice: { dmg: "1d6" }, valueText: "+1d6, nonlethal", tooltip: "+1d6, and all the weapon's damage is nonlethal. Untick it to suppress it (lethal damage, no extra die)." });
    return out;
  },
});

/** A creature's armor and shield bonuses to AC (with their enhancement): AC less touch AC and natural armor. */
export function armorAndShield(actor) {
  const ac = actor?.system?.attributes?.ac;
  if (!ac) return 0;
  return Math.max(0, (ac.normal?.total ?? 0) - (ac.touch?.total ?? 0) - (actor.system.attributes.naturalAC || 0));
}

// Brilliant energy "cannot harm undead, constructs, or objects": no damage when applied to them
Hooks.on("pf1ApplyDamage", (actor, options) => {
  if (!(options.value > 0) || !qualitiesOf(options.action?.item)?.ids.has("brilliantEnergy")) return;
  const { types } = creatureTypes(actor);
  if (!types.has("undead") && !types.has("construct")) return;
  options.value = 0;
  ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id),
    content: `<p><strong>${esc(actor.name)}</strong> takes no damage: a brilliant energy weapon can't harm undead or constructs.</p>`,
  });
});

/* -------------------------------------------- */
/*  Keen, merciful, vicious                     */
/* -------------------------------------------- */

const planned = (rollData, id) => !!rollPlan(rollData)?.provided?.some((p) => p.id === `wq-${id}`);

// Keen: the threat range doubles (19–20 → 17–20, 18–20 → 15–20), unless something already expanded it
Hooks.on("pf1PreAttackRoll", (action, config, rollData, rollOptions) => {
  if (!ATTACK_ACTIONS.includes(action.actionType) || action.item?.isBroken || !qualitiesOf(action.item)?.ids.has("keen") || !keenWorks(action)) return;
  const base = action.ability?.critRange || 20;
  if (!rollOptions.critical || rollOptions.critical < base) return;
  rollOptions.critical = 21 - 2 * (21 - rollOptions.critical);
});

Hooks.on("pf1PreDisplayActionUse", (use) => {
  const rollData = use.shared?.rollData;
  if (!rollData || !use.shared.chatAttacks?.length) return;
  // Merciful: all its damage is nonlethal (the card's apply buttons read this)
  if (planned(rollData, "merciful")) foundry.utils.setProperty(use.shared.chatData, "system.config.nonlethal", true);
  if (planned(rollData, "vicious")) {
    use.shared.chatData[`flags.${MODULE_ID}.${FLAG}`] = {
      vicious: { attacker: use.actor.uuid, target: use.shared.targets?.length === 1 ? use.shared.targets[0].document.uuid : null, applied: {} },
    };
  }
});

/** Vicious's 1d6 to the wielder for attack `index` (or "undo"). Returns the line for the card. */
export async function viciousDamage(message, index, undo = false) {
  const data = message.getFlag(MODULE_ID, FLAG)?.vicious;
  const wielder = fromUuidSync(data?.attacker);
  if (!wielder) return null;
  const current = data.applied?.[index];
  let entry;
  if (undo) {
    if (!current || current.undone) return null;
    await restoreDamage(wielder, current.lost);
    entry = { ...current, undone: true };
  } else {
    if (current) return null;
    const total = await rollTotal("1d6");
    entry = { total, lost: await dealDamage(wielder, total, []) };
  }
  if (message.isOwner) await message.update({ [`flags.${MODULE_ID}.${FLAG}.vicious.applied.${index}`]: entry });
  return entry;
}

// The wielder's 1d6 on each hit the module can see (the active GM's client)
Hooks.on("createChatMessage", async (message) => {
  if (!isActiveGM()) return;
  const data = message.getFlag(MODULE_ID, FLAG)?.vicious;
  if (!data?.target) return;
  const attacks = message.systemRolls?.attacks ?? [];
  for (let i = 0; i < attacks.length; i++) {
    const hit = hitOf(message, i, data.target);
    if (hit.known && hit.hit) await viciousDamage(message, i);
  }
});

function cardButton(label, tooltip, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.dataset.tooltip = tooltip;
  b.style.cssText = "width: auto; line-height: 1.4; margin: 2px 0.25em; padding: 0 6px;";
  b.addEventListener("click", (event) => {
    event.preventDefault();
    b.disabled = true;
    onClick();
  });
  return b;
}

Hooks.on("renderChatMessagePF", (message, html) => {
  const data = message.getFlag(MODULE_ID, FLAG)?.vicious;
  if (!data) return;
  const wielder = fromUuidSync(data.attacker);
  const canAct = (game.user.isGM || !!wielder?.isOwner) && message.isOwner;
  (message.systemRolls?.attacks ?? []).forEach((attack, i) => {
    const el = html.querySelector(`.chat-attack[data-index="${i}"]`);
    if (!el || !attack?.attack) return;
    const done = data.applied?.[i];
    const div = document.createElement("div");
    div.className = `${MODULE_ID}-vicious`;
    div.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #a85;";
    div.innerHTML = `<strong>Vicious:</strong> ${done ? `${esc(wielder?.name ?? "the wielder")} took ${done.total}${done.undone ? " — undone" : ""}` : "1d6 to the wielder if it hits"}`;
    if (canAct && !done) div.append(cardButton("Apply", "The attack hit: 1d6 damage to the wielder", () => viciousDamage(message, i)));
    if (canAct && done && !done.undone) div.append(cardButton("Undo", "Give the wielder back the damage", () => viciousDamage(message, i, true)));
    const table = el.querySelector("table");
    table ? table.after(div) : el.append(div);
  });
});

// Holy, unholy, axiomatic and anarchic weapons count as that alignment against DR, in PF1's damage math
Hooks.once("setup", () => {
  wrapMethod("pf1.applications.ApplyDamage.prototype._evaluateAttack", function (wrapped, ...args) {
    const result = wrapped(...args);
    for (const id of qualitiesOf(this.options?.action?.item)?.ids ?? []) if (QUALITIES[id].aligned) this.materials?.add(QUALITIES[id].aligned);
    return result;
  });
});

// On the weapon's cards and sheet: which qualities it has (hidden while unidentified)
registerFootnote((item) => {
  const q = qualitiesOf(item);
  if (!q?.names.length || !["weapon", "attack"].includes(item.type) || item.showUnidentifiedData) return null;
  const names = q.names.map((n) => (n.toLowerCase() === "bane" && q.bane ? `Bane (${foeText(q.bane)})` : n));
  const notes = [];
  const later = [...q.ids].filter((id) => QUALITIES[id].later);
  if (later.length) notes.push(`${later.map((id) => QUALITIES[id].name).join(", ")}: not automated yet.`);
  for (const id of q.ids) if (fits(id, item.defaultAction) === false) notes.push(`${QUALITIES[id].name} works only on ${limitText(id)}.`);
  return [`Weapon qualities (${q.fromName ? "from the name" : "chosen on the Details tab"}): ${names.join(", ")}. Their damage is added in the roll window.${notes.length ? ` ${notes.join(" ")}` : ""}`];
});

export const _test = { FLAG };
