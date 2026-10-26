// Bleed with an amount (Bleeding Attack and similar): PF1's Bleed condition has no amount and does
// nothing on its own. The amount is kept in a flag; the bleeding creature takes it at the start of
// each of its turns (no damage reduction applies), until any healing, a DC 15 Heal check, or the
// condition is removed.
//
// Rules: "Bleeding creatures take that amount of damage every round at the start of each of their
// turns. The bleeding can be stopped by a DC 15 Heal check or the application of any effect that heals
// hit point damage. Bleeding damage from this ability does not stack with itself. Bleeding damage
// bypasses any damage reduction the creature might possess." A higher bleed replaces a lower one.

import { MODULE_ID } from "./const.mjs";
import { esc, isActiveGM, onGmRequest, requestedByOwner } from "./util.mjs";

const FLAG = "bleed";
const HEALED = `${MODULE_ID}BleedHealed`;

/** Start (or raise) a creature's bleed. Returns a short description of what happened. */
export async function setBleed(actor, amount, source) {
  const current = actor.getFlag(MODULE_ID, FLAG);
  if (current && actor.statuses.has("bleed") && current.amount >= amount) return `already bleeding ${current.amount} (bleed doesn't stack)`;
  await actor.setFlag(MODULE_ID, FLAG, { amount, source });
  if (!actor.statuses.has("bleed")) await actor.setCondition("bleed", true);
  return `bleeds ${amount} at the start of each of its turns`;
}

export async function stopBleed(actor) {
  if (actor.getFlag(MODULE_ID, FLAG)) await actor.unsetFlag(MODULE_ID, FLAG);
  if (actor.statuses.has("bleed")) await actor.setCondition("bleed", false);
}

export const bleedOf = (actor) => (actor?.statuses.has("bleed") ? (actor.getFlag(MODULE_ID, FLAG) ?? null) : null);

// Start of the bleeding creature's turn
Hooks.on("updateCombat", async (combat, changes, options) => {
  if (!isActiveGM() || !("turn" in changes || "round" in changes) || options.direction === -1) return;
  const actor = combat.combatant?.actor;
  const bleed = bleedOf(actor);
  if (!bleed) return;
  // Once a round: stepping the tracker back and forward again doesn't bleed it twice
  const tick = `${combat.id}.${combat.round}`;
  if (bleed.tick === tick) return;
  await actor.setFlag(MODULE_ID, FLAG, { ...bleed, tick });
  await actor.applyDamage(bleed.amount, { forceDialog: false });
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id),
    content: `<p><strong>${esc(actor.name)}</strong> takes ${bleed.amount} bleed damage${bleed.source ? ` (${esc(bleed.source)})` : ""}. Any healing or a DC 15 Heal check stops it.</p>
      <button type="button" data-action="${MODULE_ID}-stop-bleed">Heal check succeeded: stop the bleeding</button>`,
    flags: { [MODULE_ID]: { bleedTurn: { actor: actor.uuid } } },
  });
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "bleedTurn");
  const button = html.querySelector(`[data-action="${MODULE_ID}-stop-bleed"]`);
  if (!data || !button) return;
  const actor = fromUuidSync(data.actor);
  if (!bleedOf(actor)) return button.remove();
  button.addEventListener("click", async () => {
    if (actor.isOwner) await stopBleed(actor);
    else await ChatMessage.implementation.create({ whisper: game.users.filter((u) => u.isGM).map((u) => u.id), content: `<p>Stop ${esc(actor.name)}'s bleeding (Heal check)…</p>`, flags: { [MODULE_ID]: { stopBleed: data.actor } } });
    button.remove();
  });
});

onGmRequest("stopBleed", async (message, uuid) => {
  const actor = fromUuidSync(uuid);
  if (requestedByOwner(message, actor)) await stopBleed(actor);
  await message.delete();
});

// Any healing stops it
Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (!bleedOf(actor)) return;
  // PF1 keeps hit points as an offset from the maximum; older data and macros set the value
  const hp = actor.system.attributes.hp ?? {};
  const offset = foundry.utils.getProperty(changes, "system.attributes.hp.offset");
  const value = foundry.utils.getProperty(changes, "system.attributes.hp.value");
  if ((offset != null && offset > (hp.offset ?? 0)) || (value != null && value > (hp.value ?? 0))) options[HEALED] = true;
});
Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (options[HEALED] && game.user.id === userId) stopBleed(actor);
});

// The condition removed by hand: forget the amount too
Hooks.on("deleteActiveEffect", (effect, options, userId) => {
  const actor = effect.parent;
  if (game.user.id === userId && effect.statuses?.has("bleed") && actor instanceof Actor && actor.getFlag(MODULE_ID, FLAG)) actor.unsetFlag(MODULE_ID, FLAG);
});

export const _test = { FLAG };
