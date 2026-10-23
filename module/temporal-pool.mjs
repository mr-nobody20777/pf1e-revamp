// Chronomancer's Temporal Pool (the pool itself, ½ level + Int, is set up by archetype-rules.mjs).
//   Forewarned: "expend 1 point from his temporal pool when he rolls initiative to allow himself or an
//     ally within 30 feet to roll 1d4 and add it to that character's initiative result."
//   Rewind: "As an immediate action after losing a spell due to a failed concentration check or after
//     casting a spell that had no effect ..., expend a number of points from his temporal pool equal to
//     half the spell's level (minimum 1) to immediately prepare the spell again, as if it had not been cast."
//
// Forewarned: when the chronomancer's initiative is rolled, their owners get a card with a button for
// themselves and each ally within 30 ft. Rewind: the chronomancer's prepared-spell cards get a Rewind
// button (whether the spell "had no effect" is the player's call). Changing another combatant's
// initiative needs the GM, so the button's request goes through a chat message the active GM applies.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton } from "./footnote.mjs";
import { esc, isActiveGM, onGmRequest, ownerWhisper } from "./util.mjs";

const RANGE = 30;
export const findPool = (actor) => actor?.itemTypes?.feat.find((f) => /^Temporal Pool\b/.test(f.name) && f.system.uses?.maxFormula) ?? null;
const points = (pool) => pool.system.uses?.value ?? 0;

async function spend(pool, cost) {
  if (points(pool) < cost) {
    ui.notifications.warn(`Temporal pool: ${cost} point(s) needed, ${points(pool)} left.`);
    return false;
  }
  await pool.update({ "system.uses.value": points(pool) - cost });
  return true;
}

/* -------------------------------------------- */
/*  Forewarned                                  */
/* -------------------------------------------- */

// The chronomancer's initiative is rolled: offer Forewarned to their owners
Hooks.on("updateCombatant", async (combatant, changes) => {
  if (!isActiveGM() || !("initiative" in changes) || changes.initiative == null) return;
  const actor = combatant.actor;
  const pool = findPool(actor);
  if (!pool || points(pool) < 1) return;
  const combat = combatant.combat;
  if (combat.getFlag(MODULE_ID, `forewarnedOffered.${combatant.id}`)) return; // once per combat
  await combat.setFlag(MODULE_ID, `forewarnedOffered.${combatant.id}`, true);

  const own = combatant.token?.object;
  const allies = combat.combatants.filter((c) => {
    if (c === combatant || !c.token?.object || !own) return false;
    if (c.token.disposition !== combatant.token.disposition) return false;
    return canvas.grid.measurePath([own.center, c.token.object.center]).distance <= RANGE;
  });
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: ownerWhisper(actor),
    content: `<p><strong>Forewarned</strong> (temporal pool: ${points(pool)}): spend 1 point to add 1d4 to the initiative of yourself or an ally within ${RANGE} ft.</p>`,
    flags: { [MODULE_ID]: { forewarnedOffer: { pool: pool.uuid, combat: combat.id, combatants: [combatant.id, ...allies.map((c) => c.id)] } } },
  });
});

/** Spend a point and roll +1d4 for that combatant's initiative (applied by the active GM). */
export async function forewarn(pool, combat, combatantId) {
  if (!(await spend(pool, 1))) return;
  const combatant = combat.combatants.get(combatantId);
  const roll = await new Roll("1d4").evaluate();
  return roll.toMessage({
    speaker: ChatMessage.implementation.getSpeaker({ actor: pool.actor }),
    flavor: `Forewarned: +${roll.total} initiative for ${esc(combatant?.name ?? "?")}`,
    flags: { [MODULE_ID]: { forewarned: { combat: combat.id, combatant: combatantId, bonus: roll.total } } },
  });
}

onGmRequest("forewarned", async (message, data) => {
  const combatant = game.combats.get(data.combat)?.combatants.get(data.combatant);
  if (combatant?.initiative != null) await combatant.update({ initiative: combatant.initiative + data.bonus });
});

/* -------------------------------------------- */
/*  Rewind                                      */
/* -------------------------------------------- */

const rewindCost = (spell) => Math.max(1, Math.floor((spell.system.level ?? 0) / 2));

function canRewind(spell) {
  // Cantrips are never used up, so there's nothing to rewind
  return spell?.type === "spell" && !!findPool(spell.actor) && spell.system.preparation?.max > 0 && spell.system.level >= 1;
}

/** Spend half the spell's level (min 1) to prepare it again. */
export async function rewind(spell) {
  const pool = findPool(spell.actor);
  const prep = spell.system.preparation;
  if (prep.value >= prep.max) return ui.notifications.info(`${spell.name} is still fully prepared.`);
  if (!(await spend(pool, rewindCost(spell)))) return;
  await spell.update({ "system.preparation.value": prep.value + 1 });
  return ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor: spell.actor }),
    content: `<p><strong>Rewind</strong>: ${esc(spell.name)} is prepared again (${rewindCost(spell)} temporal point${rewindCost(spell) > 1 ? "s" : ""}, ${points(pool)} left).</p>`,
  });
}

/* -------------------------------------------- */
/*  Buttons                                     */
/* -------------------------------------------- */

Hooks.on("renderChatMessagePF", (message, html) => {
  const content = html.querySelector(".message-content");
  const offer = message.getFlag(MODULE_ID, "forewarnedOffer");
  if (offer && content) {
    const pool = fromUuidSync(offer.pool);
    const combat = game.combats.get(offer.combat);
    if (pool?.isOwner && combat) {
      for (const id of offer.combatants) {
        const c = combat.combatants.get(id);
        if (c) content.append(footnoteButton(`+1d4: ${c.name}`, "Spend 1 temporal point", () => forewarn(pool, combat, id)));
      }
    }
  }
  // Rewind on the chronomancer's spell cards
  const spell = message.itemSource;
  if (canRewind(spell) && spell.isOwner && content && message.type === "action") {
    const cost = rewindCost(spell);
    content.append(footnoteButton(`Rewind (${cost} pt)`, "The spell was lost to concentration or had no effect: prepare it again", () => rewind(spell)));
  }
});

registerFootnote((item) => {
  if (item === findPool(item.actor)) {
    return ["Automated: Forewarned is offered when your initiative is rolled (+1d4 for you or an ally within 30 ft, 1 point). Rewind appears on your spell cards (half the spell's level in points, min 1)."];
  }
  return null;
});
