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
//   - Speed: "When making a full-attack action, the wielder of a speed weapon may make one extra attack with
//     it. The attack uses the wielder's full base attack bonus ... (This benefit is not cumulative with
//     similar effects, such as a haste spell.)" It ticks PF1's own Haste extra attack, so the two can't add up.
//   - Furious: "When the wielder is raging or under the effect of a rage spell, the weapon's enhancement bonus
//     is +2 better than normal. If the wielder has a rage power that gives a skill bonus while raging (such as
//     raging climber, raging leaper, or raging swimmer), the wielder gains an enhancement bonus to that skill
//     whenever the weapon is wielded or held in her hand, even when she is not raging. This bonus is equal to
//     the enhancement bonus of the weapon (and also includes the +2 if the wielder is raging)."
//   - Defending: "transfer some or all of the weapon's enhancement bonus to his AC as a bonus that stacks with
//     all others. As a free action, the wielder chooses how to allocate the weapon's enhancement bonus at the
//     start of his turn before using the weapon, and the bonus to AC lasts until his next turn." At the start
//     of the wielder's turn in combat, a whisper offers the choice; last turn's choice carries over, so
//     nothing needs clicking unless it changes (ruling 2026-11-16). The AC is a buff; the weapon's attack and
//     damage lose the same amount.
// The extra dice apply to each arrow of Manyshot (they aren't precision damage). When the action already
// has the die typed in (PF1's suggested setup), the module doesn't add its own. A player using an
// unidentified weapon sees its rows as "Unidentified quality".

import { MODULE_ID, ATTACK_ACTIONS } from "./const.mjs";
import { esc, dealDamage, restoreDamage, rollTotal, isActiveGM, wrapMethod, ownerWhisper } from "./util.mjs";
import { registerRollEffect, rollPlan } from "./roll-effects.mjs";
import { registerFootnote } from "./footnote.mjs";
import { matchesCreatures, creatureTypes } from "./creature-types.mjs";
import { hitOf } from "./natural-riders.mjs";
import { QUALITIES, qualitiesOf, foeText, keenWorks, fits, limitText } from "./magic-arms.mjs";
import { isRaging } from "./defenses.mjs";

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
    if (q.ids.has("furious")) {
      const raging = isRaging(actor);
      entry("furious", { type: "enh", atk: 2, dmg: 2, showIn: ["atk", "dmg"], dice: undefined, perArrow: false, valueText: "+2 enhancement", applies: raging, reason: "only while raging or under a rage spell", tooltip: "While raging or under a rage spell, the weapon's enhancement bonus is +2 better" });
    }
    if (q.ids.has("defending")) {
      const moved = defendingAC(actor, action.item);
      if (moved) entry("defending", { type: "untyped", atk: -moved, dmg: -moved, showIn: ["atk", "dmg"], dice: undefined, perArrow: false, label: hidden ? "Unidentified quality" : `Defending (+${moved} moved to AC)`, partLabel: { atk: "Defending", dmg: "Defending" }, imposed: true, tooltip: `This turn, +${moved} of the weapon's enhancement bonus is on the wielder's AC` });
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

// Furious: the rage powers' skill gets the weapon's enhancement bonus while it's wielded, raging or not
const RAGE_SKILLS = [
  { re: /^raging climber/i, skill: "clm" },
  { re: /^raging swimmer/i, skill: "swm" },
  { re: /^raging leaper/i, skill: "acr", jumpOnly: true },
];
registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "skill") return [];
    const power = RAGE_SKILLS.find((r) => r.skill === roll.skillId && (actor.itemTypes?.feat ?? []).some((f) => f.isActive !== false && r.re.test(f.name)));
    if (!power) return [];
    const weapons = (actor.itemTypes?.weapon ?? []).filter((w) => w.system.equipped && qualitiesOf(w)?.ids.has("furious"));
    if (!weapons.length) return [];
    const best = Math.max(...weapons.map((w) => w.system.enh || 0)) + (isRaging(actor) ? 2 : 0);
    if (best <= 0) return [];
    return [{ id: "wq-furious-skill", label: "Furious weapon", type: "enh", roll: best, applies: !power.jumpOnly, reason: "only on Acrobatics checks to jump (raging leaper)", tooltip: "A wielded furious weapon's enhancement bonus (+2 while raging) on the rage power's skill" }];
  },
});

/* -------------------------------------------- */
/*  Speed and defending                         */
/* -------------------------------------------- */

// Speed: tick PF1's Haste extra attack (one extra attack at full BAB on a full attack, never two)
Hooks.on("pf1CreateActionUse", (use) => {
  if (qualitiesOf(use.item)?.ids.has("speed") && use.shared?.useOptions) use.shared.useOptions.haste ??= true;
});
// PF1 only adds the extra attack through its attack window; without the window (skipDialog), add it here,
// once, after the first attack, as PF1 does
Hooks.once("setup", () => {
  wrapMethod("pf1.actionUse.ActionUse.prototype.alterRollData", async function (wrapped, formData = {}, ...rest) {
    const result = await wrapped(formData, ...rest);
    const shared = this.shared;
    const attacks = shared?.attacks ?? [];
    if (shared?.fullAttack && formData["haste-attack"] && attacks.length && !attacks.some((a) => a.type === "haste-attack") && qualitiesOf(this.item)?.ids.has("speed")) {
      const first = attacks[0];
      const extra = new first.constructor(game.i18n.localize("PF1.Haste"), "", first.ammo ?? null, { abstract: true, type: "haste-attack" });
      extra.attackBonusTotal = 0;
      let place = 1;
      while (["manyshot", "rapid-shot"].includes(attacks[place]?.type)) place++;
      attacks.splice(place, 0, extra);
    }
    return result;
  });
});
Hooks.on("renderAttackDialog", (app, html) => {
  const item = app.action?.item ?? app.object?.item;
  if (!qualitiesOf(item)?.ids.has("speed") || item.showUnidentifiedData) return;
  const root = html[0] ?? html;
  const box = root.querySelector?.('input[name="haste-attack"]');
  const label = box?.closest("label") ?? box?.parentElement;
  if (label && !label.querySelector(`.${MODULE_ID}-speed`)) label.insertAdjacentHTML("beforeend", ` <span class="${MODULE_ID}-speed" data-tooltip="A speed weapon's extra attack (not on top of haste)">(Speed)</span>`);
});

const DEFENDING = "defendingAC"; // weapon flag: the last choice; buff flag: the weapon's id
const defendingWeapons = (actor) => (actor?.itemTypes?.weapon ?? []).filter((w) => w.system.equipped && (w.system.enh || 0) > 0 && qualitiesOf(w)?.ids.has("defending") && fits("defending", w.defaultAction) !== false);
const defendingBuff = (actor, weapon) => (actor?.itemTypes?.buff ?? []).find((b) => b.flags?.[MODULE_ID]?.[DEFENDING] === weapon.id);
/** How much of the weapon's enhancement bonus is on the wielder's AC right now. */
export function defendingAC(actor, weapon) {
  const buff = defendingBuff(actor, weapon);
  return buff?.isActive ? Number(buff.system.changes?.[0]?.formula) || 0 : 0;
}

/** Move `amount` of the weapon's enhancement bonus to the wielder's AC (0: none), and remember the choice. */
export async function setDefending(actor, weapon, amount) {
  amount = Math.max(0, Math.min(amount, weapon.system.enh || 0));
  if (weapon.getFlag(MODULE_ID, DEFENDING) !== amount) await weapon.setFlag(MODULE_ID, DEFENDING, amount);
  const buff = defendingBuff(actor, weapon);
  if (!amount) return buff ? buff.delete() : null;
  const data = { name: `Defending: +${amount} AC (${weapon.name})`, "system.active": true, "system.changes": [{ formula: String(amount), target: "ac", type: "untyped" }] };
  if (buff) return buff.update(data);
  return actor.createEmbeddedDocuments("Item", [{ name: data.name, type: "buff", img: weapon.img, system: { subType: "temp", active: true, changes: data["system.changes"] }, flags: { [MODULE_ID]: { [DEFENDING]: weapon.id } } }]);
}

// The start of the wielder's turn: last turn's choice carries over; a whisper offers to change it
Hooks.on("updateCombat", async (combat, changes, options) => {
  if (!isActiveGM() || !("turn" in changes || "round" in changes) || options.direction === -1) return;
  const actor = combat.combatant?.actor;
  for (const weapon of defendingWeapons(actor)) {
    if (weapon.system.identified === false) continue; // the owner doesn't know it's defending
    const enh = weapon.system.enh;
    const amount = Math.max(0, Math.min(weapon.getFlag(MODULE_ID, DEFENDING) ?? 0, enh));
    await setDefending(actor, weapon, amount);
    const buttons = Array.from({ length: enh + 1 }, (_, n) => `<button type="button" data-wq-defend="${n}" data-weapon="${weapon.uuid}" style="width:auto; padding:0 6px; ${n === amount ? "font-weight:bold; border-width:2px" : ""}">${n ? `+${n}` : "0"}</button>`).join("");
    await ChatMessage.implementation.create({
      speaker: ChatMessage.implementation.getSpeaker({ actor }),
      whisper: ownerWhisper(actor),
      content: `<div class="${MODULE_ID}-defending"><p><strong>Defending</strong> (${esc(weapon.name)}, +${enh}): ${amount ? `+${amount} on AC` : "nothing on AC"}${weapon.getFlag(MODULE_ID, DEFENDING) !== undefined ? ", as last turn" : ""}. The rest stays on the weapon until your next turn.</p><p>AC: ${buttons}</p></div>`,
    });
  }
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  html.querySelectorAll?.("[data-wq-defend]").forEach((b) =>
    b.addEventListener("click", async (event) => {
      event.preventDefault();
      const weapon = fromUuidSync(b.dataset.weapon);
      if (!weapon?.isOwner) return ui.notifications.warn("Only the wielder's owner can choose.");
      await setDefending(weapon.actor, weapon, Number(b.dataset.wqDefend));
      html.querySelectorAll("[data-wq-defend]").forEach((x) => (x.style.fontWeight = x === b ? "bold" : ""));
    })
  );
});

// The bonus lasts until the next turn: at the end of combat it goes
Hooks.on("deleteCombat", async (combat) => {
  if (!isActiveGM()) return;
  for (const c of combat.combatants) {
    const ids = (c.actor?.itemTypes?.buff ?? []).filter((b) => b.flags?.[MODULE_ID]?.[DEFENDING]).map((b) => b.id);
    if (ids.length) await c.actor.deleteEmbeddedDocuments("Item", ids);
  }
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

export const _test = { FLAG, DEFENDING };
