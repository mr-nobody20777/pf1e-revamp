// Call Lightning and Call Lightning Storm: the spell's card gets a "Call a bolt" button for the rest of the spell.
//
// Call lightning (Core Rulebook): "Immediately upon completion of the spell, and once per round thereafter, you may
// call down a 5-foot-wide, 30-foot-long, vertical bolt of lightning that deals 3d6 points of electricity damage
// ... Any creature in the target square or in the path of the bolt is affected [Reflex half] ... You may call a
// total number of bolts equal to your caster level (maximum 10 bolts). If you are outdoors and in a stormy area
// ... each bolt deals 3d10 points of electricity damage instead of 3d6." Call lightning storm: "each bolt deals
// 5d6 points of electricity damage (or 5d10 if created outdoors in a stormy area), and you may call a maximum of
// 15 bolts."
//
// The caster (or the GM) targets the creatures in the bolt's square and clicks the button; the active GM rolls
// one damage roll for the bolt, each creature's Reflex save (half), and posts a card with an Undo. The count of
// bolts called is kept on the spell's card. Once a round and the standard action are left to the table.

import { MODULE_ID } from "./const.mjs";
import { dealDamage, restoreDamage, esc, gmWhisper, onGmRequest, requestedByOwner, saveResult, rollTotal } from "./util.mjs";
import { baseSpellName, metamagicOf, metamagicFormula, metamagicTypes } from "./metamagic.mjs";

const BOLTS = { "call lightning": { dice: 3, max: 10 }, "call lightning storm": { dice: 5, max: 15 } };
const CALLED = "boltsCalled"; // spell card flag: the number of bolts called
const CARD = "boltCard"; // bolt card flag: { undo: [{ actor, lost }] }

/** The bolt spell of an action card, or null. */
function boltSpell(message) {
  if (message.type !== "action") return null;
  const item = message.itemSource;
  const name = (item?.type === "spell" ? baseSpellName(item) : item?.system?.spellName ?? item?.name ?? "").toLowerCase().replace(/^(scroll|wand) of /, "");
  return BOLTS[name] ?? null;
}
const boltsAllowed = (message, spell) => Math.min(spell.max, message.system.config?.cl ?? 1);

const calling = new Set(); // cards with a bolt being called (a second click waits its turn: dropped, not double-counted)

/** One bolt on these tokens (the active GM's game). */
export async function callBolt(message, tokenUuids, stormy) {
  const spell = boltSpell(message);
  if (!spell || calling.has(message.id)) return null;
  calling.add(message.id);
  try {
    return await boltOn(message, spell, tokenUuids, stormy);
  } finally {
    calling.delete(message.id);
  }
}

async function boltOn(message, spell, tokenUuids, stormy) {
  const called = message.getFlag(MODULE_ID, CALLED) ?? 0;
  if (called >= boltsAllowed(message, spell)) return null;
  const dc = message.system.save?.dc ?? 10;
  const formula = `${spell.dice}d${stormy ? 10 : 6}`;
  // Empower and Maximize: each bolt's damage
  const total = await rollTotal(metamagicFormula(formula, metamagicOf(message)));
  const lines = [];
  const undo = [];
  for (const uuid of tokenUuids) {
    const token = fromUuidSync(uuid);
    const actor = token?.actor;
    if (!actor) continue;
    const r = saveResult(await actor.rollSavingThrow("ref", { skipDialog: true, dc, reference: message.uuid }), dc);
    const amount = r.passed ? Math.floor(total / 2) : total;
    const lost = await dealDamage(actor, amount, metamagicTypes(["electric"], metamagicOf(message))); // PF1's id for electricity
    undo.push({ actor: actor.uuid, lost });
    const taken = lost.hp + lost.temp;
    lines.push(`${token.name}: Reflex ${r.total ?? "?"} vs DC ${dc}, ${r.passed ? "half" : "failed"}: ${amount} electricity${taken < amount ? ` (${taken} after resistance)` : ""}`);
  }
  await message.setFlag(MODULE_ID, CALLED, called + 1);
  const left = boltsAllowed(message, spell) - called - 1;
  return ChatMessage.implementation.create({
    speaker: message.speaker,
    content: `<p><strong>${esc(message.itemSource?.name ?? "Call Lightning")}</strong>: bolt ${called + 1} (${formula}${stormy ? ", stormy" : ""}: ${total}); ${left} left.</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${undo.length ? `<button type="button" data-action="${MODULE_ID}-bolt-undo">Undo</button>` : ""}`,
    flags: { [MODULE_ID]: { [CARD]: { undo } } },
  });
}

onGmRequest("callBolt", async (request, { message, tokens, stormy }) => {
  const card = fromUuidSync(message);
  const caster = card ? ChatMessage.implementation.getSpeakerActor(card.speaker) : null;
  if (card && requestedByOwner(request, caster)) await callBolt(card, tokens, stormy);
  await request.delete();
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  // The bolt card's Undo (the GM)
  const data = message.getFlag(MODULE_ID, CARD);
  const undo = data && html.querySelector(`[data-action="${MODULE_ID}-bolt-undo"]`);
  if (undo) {
    if (!game.user.isGM || message.getFlag(MODULE_ID, "undone")) undo.remove();
    else
      undo.addEventListener("click", async () => {
        undo.remove();
        for (const u of data.undo) {
          const actor = fromUuidSync(u.actor);
          if (actor) await restoreDamage(actor, u.lost);
        }
        await message.setFlag(MODULE_ID, "undone", true);
      });
  }
  // The spell's card: the button for the caster's owner and the GM
  const spell = boltSpell(message);
  if (!spell) return;
  const caster = ChatMessage.implementation.getSpeakerActor(message.speaker);
  if (!game.user.isGM && !caster?.isOwner) return;
  const left = boltsAllowed(message, spell) - (message.getFlag(MODULE_ID, CALLED) ?? 0);
  const box = document.createElement("div");
  box.className = `${MODULE_ID}-bolts`;
  box.innerHTML = left > 0
    ? `<p>${left} bolt${left === 1 ? "" : "s"} left. Target the creatures in the bolt's square, then call it.</p><label><input type="checkbox" name="stormy"> Outdoors in a storm (d10s)</label><button type="button" data-action="${MODULE_ID}-bolt">Call a bolt</button>`
    : "<p>No bolts left.</p>";
  (html.querySelector(".card-content") ?? html.querySelector(".message-content") ?? html).append(box);
  box.querySelector("button")?.addEventListener("click", async () => {
    const tokens = [...game.user.targets].map((t) => t.document.uuid);
    if (!tokens.length) return ui.notifications.warn("Target the creatures in the bolt's square first.");
    const stormy = box.querySelector("input[name=stormy]").checked;
    if (game.user.isGM) return callBolt(message, tokens, stormy);
    return ChatMessage.implementation.create({ whisper: gmWhisper(), content: "<p>A bolt of lightning</p>", flags: { [MODULE_ID]: { callBolt: { message: message.uuid, tokens, stormy } } } });
  });
});

export const _test = { callBolt, CALLED };
