// Poisoned weapons (afflictions, phase 2). Rules (Core Rulebook, Poisons; verbatim):
//   "One dose of poison smeared on a weapon or some other object affects just a single target. A poisoned
//   weapon or object retains its poison until the weapon scores a hit ... Applying poison to a weapon or single
//   piece of ammunition is a standard action. Whenever you apply or ready a poison for use, there is a 5%
//   chance that you expose yourself to the poison and must save against the poison as normal. This does not
//   consume the dose of poison. Whenever you attack with a poisoned weapon, if the attack roll results in a
//   natural 1, you expose yourself to the poison. This poison is consumed when the weapon strikes a creature or
//   is touched by the wielder. If you have the poison use class feature ..., you do not risk accidentally
//   poisoning yourself when applying poison."
// Rulings (2026-11-17): Poison Use spares only the 5% when applying, not the natural 1 (as written). Only
// injury and contact poisons go on a weapon. The dose is the one the poison item's use spent.

import { MODULE_ID } from "./const.mjs";
import { esc, isActiveGM } from "./util.mjs";
import { afflictionOfItem, exposeAndReport } from "./afflictions.mjs";
import { hitOf } from "./natural-riders.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";

export const FLAG = "poisoned"; // weapon or ammunition flag: { spec }
const ARMS = new Set(["weapon", "attack"]);
const isAmmo = (item) => item?.type === "loot" && item.system?.subType === "ammo";
/** Poison Use (alchemist, assassin and others): no risk when applying. */
const hasPoisonUse = (actor) => actor?.items.some((i) => i.type === "feat" && /^poison use\b/i.test(i.name));
export const poisonOn = (item) => item?.flags?.[MODULE_ID]?.[FLAG]?.spec ?? null;

/** Smear the poison on one of the actor's weapons or ammunition: the 5% self-exposure, then the flag. */
export async function applyPoison(actor, spec, weapon, { reference = null } = {}) {
  if (spec.delivery && !["injury", "contact"].includes(spec.delivery)) return `${spec.name} is ${spec.delivery}: only injury and contact poisons go on a weapon`;
  const lines = [];
  if (!hasPoisonUse(actor)) {
    const roll = await new Roll("1d100").evaluate();
    if (roll.total <= 5) {
      lines.push(`rolled ${roll.total} on the 5% chance: exposed while applying it`);
      await exposeAndReport(actor, spec, reference ? fromUuidSync(reference) : null);
    } else lines.push(`no slip (${roll.total} on d100)`);
  } else lines.push("Poison Use: no risk");
  await weapon.setFlag(MODULE_ID, FLAG, { spec });
  refreshFootnotes(weapon);
  return `${weapon.name} is poisoned with ${spec.name} (${lines.join("; ")})`;
}

async function chooseWeapon(actor) {
  const arms = actor.items.filter((i) => (ARMS.has(i.type) && i.system.subType !== "natural") || isAmmo(i));
  if (!arms.length) return ui.notifications.warn(`${actor.name} has no weapon or ammunition to poison.`), null;
  if (arms.length === 1) return arms[0];
  const id = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Apply poison" },
    content: `<div class="form-group"><label>Weapon or ammunition</label><div class="form-fields"><select name="weapon">${arms.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join("")}</select></div></div><p class="hint">A standard action; one dose affects a single target.</p>`,
    ok: { label: "Apply", callback: (event, button) => button.form.elements.weapon.value },
    rejectClose: false,
  });
  return id ? actor.items.get(id) : null;
}

// "Apply to a weapon" on a poison's card
Hooks.on("renderChatMessageHTML", (message, html) => {
  const item = message.itemSource;
  const spec = item?.type === "consumable" ? afflictionOfItem(item) : null;
  const actor = item?.actor;
  if (!spec || spec.kind !== "poison" || !actor?.isOwner || html.querySelector(`.${MODULE_ID}-apply-poison`)) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = `${MODULE_ID}-apply-poison`;
  b.textContent = "Apply to a weapon…";
  b.addEventListener("click", async () => {
    const weapon = await chooseWeapon(actor);
    if (!weapon) return;
    const text = await applyPoison(actor, spec, weapon, { reference: message.uuid });
    await ChatMessage.implementation.create({ speaker: ChatMessage.implementation.getSpeaker({ actor }), content: `<p>${esc(text)}.</p>` });
  });
  (html.querySelector(".card-content, .message-content") ?? html).append(b);
});

// On the weapon: which poison, and wiping it off
registerFootnote((item) => {
  const spec = poisonOn(item);
  if (!spec) return null;
  const parts = [`Poisoned: ${spec.name} (${spec.save === "fort" ? "Fortitude" : spec.save} DC ${spec.dc}); the next hit delivers it, and a natural 1 exposes the wielder.`];
  if (item.isOwner) parts.push(footnoteButton("Wipe off", "Remove the poison", async () => { await item.unsetFlag(MODULE_ID, FLAG); refreshFootnotes(item); }));
  return parts;
});

// The attack: a natural 1 exposes the attacker; the first hit delivers the dose to the creature hit
Hooks.on("createChatMessage", async (message) => {
  if (!isActiveGM()) return;
  const attacks = message.systemRolls?.attacks ?? [];
  const item = message.itemSource;
  if (!attacks.length || !item) return;
  const attacker = item.actor;
  const sourceFor = (attack) => {
    const ammo = attack?.ammo?.id ? attacker?.items.get(attack.ammo.id) : null;
    return poisonOn(ammo) ? ammo : poisonOn(item) ? item : null;
  };
  if (!attacks.some((a) => sourceFor(a))) return;
  const targets = message.system?.targets ?? [];
  for (let i = 0; i < attacks.length; i++) {
    const source = sourceFor(attacks[i]);
    const spec = poisonOn(source);
    if (!spec) continue;
    if (attacks[i]?.attack?.dice?.[0]?.total === 1) {
      await source.unsetFlag(MODULE_ID, FLAG);
      await exposeAndReport(attacker, spec, message);
      continue;
    }
    const struck = targets.find((t) => hitOf(message, i, t).hit);
    if (!struck) continue;
    await source.unsetFlag(MODULE_ID, FLAG); // "consumed when the weapon strikes a creature"
    const target = fromUuidSync(struck);
    await exposeAndReport(target?.actor ?? target, spec, message);
  }
});

export const _test = { FLAG, applyPoison };
