// Catching fire from a monster's burn (on-hit riders, phase 3). The burning creature takes the burn's
// damage as fire damage at the start of each of its turns for 1d4 rounds, and can try to put it out.
//
// Rules (universal monster rules, Burn): "Those affected by the burn ability must also succeed on a Reflex
// save or catch fire, taking the listed damage for an additional 1d4 rounds at the start of its turn (DC 10
// + 1/2 burning creature's racial HD + burning creature's Con modifier). A burning creature can attempt a
// new save as a full-round action. Dropping and rolling on the ground grants a +4 bonus on this save."
// Catching fire again while burning keeps the longer of the two durations. Dropping and rolling leaves the
// creature prone. The fire, the save and its DC are kept in a flag; PF1's Burning condition shows it.

import { MODULE_ID } from "./const.mjs";
import { dealDamage, esc, isActiveGM, oncePerRound, ownerWhisper, rollTotal, saveResult, steppedBack, rollSaveAgainst, turnActors } from "./util.mjs";

const FLAG = "burning";
const TICK = "burningTick";
const hasCondition = () => !!pf1.registry.conditions.get("burning");

export const burningOf = (actor) => actor?.getFlag(MODULE_ID, FLAG) ?? null;

/** Set the creature on fire: `formula` fire damage at the start of each of its turns for 1d4 rounds. Returns the rounds. */
export async function setBurning(actor, { formula, dc, source }) {
  const rounds = await rollTotal("1d4");
  const current = burningOf(actor);
  await actor.setFlag(MODULE_ID, FLAG, { formula, dc, source, rounds: Math.max(rounds, current?.rounds ?? 0) });
  if (hasCondition() && !actor.statuses.has("burning")) await actor.setCondition("burning", true);
  return rounds;
}

export async function extinguish(actor) {
  if (burningOf(actor)) await actor.unsetFlag(MODULE_ID, FLAG);
  if (actor.statuses.has("burning")) await actor.setCondition("burning", false);
}

/** The full-round save to put the fire out (+4 and prone when dropping and rolling). Returns true if it's out. */
export async function burningSave(actor, { dropAndRoll = false } = {}) {
  const fire = burningOf(actor);
  if (!fire) return true;
  if (dropAndRoll && !actor.statuses.has("prone")) await actor.setCondition("prone", true);
  // Against fire: save bonuses against fire count (there's no card to say so)
  const save = await rollSaveAgainst(actor, "ref", ["fire"], { dc: fire.dc, ...(dropAndRoll ? { bonus: "4[Drop and roll]" } : {}) });
  const passed = saveResult(save, fire.dc).passed;
  if (passed) await extinguish(actor);
  return passed;
}

/** The start of the burning creature's turn: its fire damage, one round fewer, and the card to put it out. */
export async function burnTurn(actor) {
  const fire = burningOf(actor);
  if (!fire) return null;
  const total = await rollTotal(fire.formula);
  await dealDamage(actor, total, ["fire"]);
  const rounds = fire.rounds - 1;
  if (rounds > 0) await actor.setFlag(MODULE_ID, FLAG, { ...fire, rounds });
  else await extinguish(actor);
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: [...new Set([...ownerWhisper(actor), ...game.users.filter((u) => u.isGM).map((u) => u.id)])],
    content: `<p><strong>${esc(actor.name)}</strong> is on fire${fire.source ? ` (${esc(fire.source)})` : ""}: ${total} fire damage. ${
      rounds > 0
        ? `It burns for ${rounds} more round${rounds === 1 ? "" : "s"}. A full-round action and a Reflex save (DC ${fire.dc}) put it out.</p>
      <button type="button" data-action="${MODULE_ID}-burn-save">Reflex save (full-round action)</button>
      <button type="button" data-action="${MODULE_ID}-burn-roll">Drop and roll (+4, falls prone)</button>`
        : "The fire goes out.</p>"
    }`,
    flags: { [MODULE_ID]: { burningTurn: { actor: actor.uuid } } },
  });
  return total;
}

Hooks.on("combatTurnChange", async (combat, prior, current) => {
  if (!isActiveGM() || steppedBack(prior, current)) return;
  for (const actor of turnActors(combat, combat.combatants.get(current?.combatantId))) {
    if (!burningOf(actor) || !(await oncePerRound(actor, TICK, combat))) continue;
    await burnTurn(actor);
  }
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "burningTurn");
  if (!data) return;
  const actor = fromUuidSync(data.actor);
  const buttons = html.querySelectorAll(`[data-action="${MODULE_ID}-burn-save"], [data-action="${MODULE_ID}-burn-roll"]`);
  if (!burningOf(actor) || !actor?.isOwner) return buttons.forEach((b) => b.remove());
  for (const button of buttons) {
    button.addEventListener("click", async () => {
      buttons.forEach((b) => (b.disabled = true));
      const dropAndRoll = button.dataset.action.endsWith("roll");
      await burningSave(actor, { dropAndRoll });
    });
  }
});

// The condition removed by hand: the fire is out
Hooks.on("deleteActiveEffect", (effect, options, userId) => {
  const actor = effect.parent;
  if (game.user.id === userId && effect.statuses?.has("burning") && actor instanceof Actor && burningOf(actor)) actor.unsetFlag(MODULE_ID, FLAG);
});

export const _test = { FLAG, burnTurn };
