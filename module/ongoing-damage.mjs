// Damage that continues on later rounds (Acid Arrow, Corrosive Consumption, Caustic Eruption, Heat Metal, Chill
// Metal). The spell rows start it (spells.mjs, effect.ongoing); a buff named after the spell on the creature
// keeps the schedule: one damage formula per round, dealt at the start of the caster's turn in combat (the rows
// of the spell's own text: "dealing another 2d4 points of damage in each round", "On your turn in each of the next
// 2 rounds", the heat metal table by round). Each tick posts a card with the damage, typed so damage reduction
// and resistances apply, and an Undo for the GM. Outside combat nothing ticks.
//
//   - Acid Arrow: "For every three caster levels you possess, the acid ... lasts for another round (to a maximum of
//     6 additional rounds at 18th level), dealing another 2d4 points of damage in each round."
//   - Corrosive Consumption: 1 per caster level, then 1d4 per level, then 1d6 per level (max 15); "The target can
//     spend a full-round action to scrape off the acid ... to halve the damage for that round and negate the
//     remaining rounds" (a button on the card).
//   - Caustic Eruption: those that failed their saves take 1d6 per two caster levels (max 10d6) on the caster's
//     next 2 turns.
//   - Heat Metal / Chill Metal: round 2 1d4, rounds 3-5 2d4, round 6 1d4 (rounds 1 and 7 none); "full damage if
//     its armor, shield, or weapon is affected ... minimum damage (1 point or 2 points) if it's not wearing or
//     wielding such an item": full when it wears metal armor or wields a metal weapon or shield.

import { MODULE_ID } from "./const.mjs";
import { dealDamage, restoreDamage, esc, isActiveGM, oncePerRound, steppedBack, ownerWhisper, gmWhisper } from "./util.mjs";
import { extendFactor, metamagicFormula } from "./metamagic.mjs";
import { wearsMetalArmor } from "./situational-bonuses.mjs";

export const FLAG = "ongoing"; // buff flag: { caster, schedule: [formula], next, type, cl, minimum, metal, scraped }
const CARD = "ongoingTick"; // card flag: { actor, lost, amount }
const TICK = "ongoingTick"; // actor flag: once per round

// Weapons and shields that aren't metal (Heat Metal: "metal equipment")
// (word endings too: longbow, shortbow, greatclub, quarterstaff)
const NONMETAL = /(?:club|staff|bow|sling|blowgun)\b|\b(?:whip|net|bola|wooden|darkwood|unarmed)\b/i;
const metalItem = (i) => ![i.name, ...(i.system.baseTypes ?? [])].some((n) => NONMETAL.test(n));
/** Does the creature wear metal armor or wield a metal weapon or shield? */
export function hasMetal(actor) {
  if (wearsMetalArmor(actor)) return true;
  if (actor.itemTypes.equipment.some((e) => e.system.equipped && e.system.subType === "shield" && metalItem(e))) return true;
  return actor.itemTypes.weapon.some((w) => w.system.equipped && metalItem(w));
}

/** Start the schedule on the creature (the spell's buff carries it). */
export async function startOngoing(actor, ongoing, data, caster, rollData, img) {
  const mm = data.metamagic ?? null;
  // Extend Spell doubles a duration in rounds (Acid Arrow's extra rounds); a fixed table (Heat Metal) keeps its rounds
  const schedule = (ongoing.schedule
    ? [...ongoing.schedule]
    : Array(Math.max(0, (await new Roll(String(ongoing.rounds), rollData).evaluate()).total) * extendFactor(mm)).fill(ongoing.formula)).map((f) => metamagicFormula(f, mm, rollData));
  if (!schedule.length) return null;
  const flag = { caster: caster?.uuid ?? null, schedule: schedule.map((f) => String(f).replace(/@cl\b/g, String(data.cl ?? 1))), next: 0, type: ongoing.type ?? null, minimum: ongoing.minimum ?? null, scrape: !!ongoing.scrape };
  // No duration of its own: the last round deletes it (an expiring duration could beat the last tick)
  // The spell's own buff when it has one; another casting already running keeps its schedule (each arrow deals its own)
  const existing = actor.itemTypes.buff.find((b) => b.name === data.name && !b.flags?.[MODULE_ID]?.[FLAG]);
  const rounds = schedule.length;
  if (existing) await existing.update({ "system.active": true, [`flags.${MODULE_ID}.${FLAG}`]: flag });
  else await actor.createEmbeddedDocuments("Item", [{ name: data.name, type: "buff", img: img ?? "icons/svg/acid.svg", system: { subType: "spell", active: true, level: data.cl }, flags: { [MODULE_ID]: { [FLAG]: flag } } }]);
  return `${rounds} more round${rounds === 1 ? "" : "s"} of damage on your turn`;
}

/** Deal the creature's next round of damage from this buff. */
async function tick(actor, buff) {
  const flag = foundry.utils.deepClone(buff.flags[MODULE_ID][FLAG]);
  const formula = flag.schedule[flag.next];
  if (formula == null) return buff.delete();
  let total = Math.max(0, (await new Roll(String(formula), {}).evaluate()).total);
  const notes = [];
  // Heat metal: the minimum without metal worn or wielded ("1 point or 2 points")
  if (flag.minimum && !hasMetal(actor)) {
    const min = flag.minimum[flag.next] ?? 0;
    if (min < total) notes.push("no metal worn or wielded: the minimum");
    total = Math.min(total, min);
  }
  if (flag.scraped) {
    total = Math.floor(total / 2);
    notes.push("scraped off: half, and it ends");
  }
  const lost = total > 0 ? await dealDamage(actor, total, flag.type ? [flag.type] : []) : null;
  flag.next += 1;
  const done = flag.scraped || flag.next >= flag.schedule.length;
  if (done) await buff.delete();
  else await buff.update({ [`flags.${MODULE_ID}.${FLAG}`]: flag });
  const left = flag.schedule.length - flag.next;
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: [...new Set([...ownerWhisper(actor), ...gmWhisper()])],
    content: `<p><strong>${esc(buff.name)}</strong>: ${esc(actor.name)} takes ${total}${flag.type ? ` ${esc(flag.type)}` : ""} damage${notes.length ? ` (${esc(notes.join("; "))})` : ""}. ${done ? "It ends." : `${left} more round${left === 1 ? "" : "s"}.`}</p>${!done && flag.scrape ? `<button type="button" data-action="${MODULE_ID}-ongoing-scrape">Scrape it off (full-round action)</button>` : ""}${lost ? `<button type="button" data-action="${MODULE_ID}-ongoing-undo">Undo</button>` : ""}`,
    flags: { [MODULE_ID]: { [CARD]: { actor: actor.uuid, buff: done ? null : buff.uuid, lost } } },
  });
  return total;
}

// At the start of the caster's turn: every creature with this caster's schedules takes its round
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  if (!isActiveGM() || steppedBack(prior, current)) return;
  const caster = combat.combatants.get(current?.combatantId)?.actor;
  if (!caster) return;
  const scene = combat.scene ?? canvas.scene;
  const actors = new Set([...(scene?.tokens ?? [])].map((t) => t.actor).filter(Boolean));
  const due = [...actors].flatMap((actor) => actor.itemTypes.buff.filter((b) => b.isActive && b.flags[MODULE_ID]?.[FLAG]?.caster === caster.uuid).map((buff) => [actor, buff]));
  // The once-a-round mark only when something is due (no update on every turn)
  if (!due.length || !(await oncePerRound(caster, TICK, combat))) return;
  for (const [actor, buff] of due) await tick(actor, buff);
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, CARD);
  if (!data) return;
  const actor = fromUuidSync(data.actor);
  const undo = html.querySelector(`[data-action="${MODULE_ID}-ongoing-undo"]`);
  if (undo) {
    if (!game.user.isGM || !data.lost) undo.remove();
    else
      undo.addEventListener("click", async () => {
        undo.disabled = true;
        await restoreDamage(actor, data.lost);
        await message.update({ [`flags.${MODULE_ID}.${CARD}.lost`]: null, content: message.content.replace(/<button[^>]*ongoing-undo[^>]*>Undo<\/button>/, "<em>(undone)</em>") });
      });
  }
  const scrape = html.querySelector(`[data-action="${MODULE_ID}-ongoing-scrape"]`);
  if (scrape) {
    const buff = data.buff ? fromUuidSync(data.buff) : null;
    if (!buff || !(actor?.isOwner || game.user.isGM)) scrape.remove();
    else
      scrape.addEventListener("click", async () => {
        scrape.disabled = true;
        await buff.update({ [`flags.${MODULE_ID}.${FLAG}.scraped`]: true });
      });
  }
});

export const _test = { FLAG, tick, hasMetal, startOngoing };
