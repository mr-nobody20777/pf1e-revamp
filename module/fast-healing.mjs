// Fast healing and regeneration, applied at the start of the creature's turn in combat. PF1 keeps them
// as text on the sheet (traits.fastHealing, traits.regen) and applies neither.
//
// Rules (Bestiary, Universal Monster Rules):
//   - Fast healing: "The creature regains hit points swiftly, usually 1 or more per round, as given in
//     the creature's entry ... Fast healing continues to function (even at negative hit points) until a
//     creature dies, at which point the effects of fast healing end immediately."
//   - Regeneration: "heal damage to themselves at a fixed rate, as with fast healing, but they can't die
//     as long as their regeneration is still functioning ... Certain damage types, typically acid and
//     fire, cause a creature's regeneration to stop functioning on the round following the attack.
//     During this round, the creature does not heal any damage and can die normally."
//   - Healing hit point damage also heals as much nonlethal damage: PF1's dual-heal setting decides.
// Rulings (DECISIONS.md, Rolls and buffs): at the start of the creature's turn, in combat only, once a
// round; damage of a listed type applied through PF1 stops the next turn's regeneration; a dead creature
// doesn't heal; a short line is whispered to the GM and the owner.
//
// Sources, the highest of each counting: the sheet's fields ("5", "5 (acid, fire)"), items named for
// them ("Fast Healing 5", "Regeneration 10 (fire)", a racial Fast Healing trait), and the buffs of
// spells that give fast healing (Infernal Healing and Celestial Healing, lesser and greater).

import { MODULE_ID } from "./const.mjs";
import { esc, isActiveGM } from "./util.mjs";

const STOPPED = "regenStopped"; // actor flag: the damage types that stop its next regeneration
const TICK = "healedRound"; // actor flag: `${combat}.${round}` of the last healing, so it heals once a round
const SPELL_BUFFS = { "infernal healing": 1, "infernal healing, greater": 4, "celestial healing": 1, "celestial healing, greater": 4 };
const DAMAGE_WORDS = /\b(acid|fire|cold|electricity|sonic|force|negative|positive|good|evil|lawful|chaotic|silver|cold iron|adamantine|bludgeoning|piercing|slashing|holy|unholy)\b/gi;

const amountIn = (text) => Number(String(text ?? "").match(/(\d+)/)?.[1] ?? 0);
// As PF1's damage type ids ("electric"); alignments and materials aren't damage types in PF1, so they can't be detected
const typesIn = (text) => [...String(text ?? "").matchAll(DAMAGE_WORDS)].map((m) => m[1].toLowerCase().replace(/\s+/g, "").replace(/^electricity$/, "electric"));

/** The creature's fast healing ({ value, label }) and regeneration ({ value, types, label }), or null. */
export function healingOf(actor) {
  let fast = null;
  let regen = null;
  const better = (current, value) => value > 0 && (!current || value > current.value);
  const traits = actor?.system?.traits ?? {};
  if (better(fast, amountIn(traits.fastHealing))) fast = { value: amountIn(traits.fastHealing), label: "Fast healing" };
  if (better(regen, amountIn(traits.regen))) regen = { value: amountIn(traits.regen), types: typesIn(traits.regen), label: "Regeneration" };
  for (const item of actor?.items ?? []) {
    if (item.isActive === false || !["feat", "buff"].includes(item.type)) continue;
    const name = item.name.toLowerCase();
    if (/^fast healing\b/.test(name)) {
      const value = amountIn(item.name) || 1; // the racial trait: "regain 1 hit point each round"
      if (better(fast, value)) fast = { value, label: item.name };
    } else if (/^regeneration\b/.test(name)) {
      const value = amountIn(item.name);
      if (better(regen, value)) regen = { value, types: typesIn(item.name), label: item.name };
    } else if (item.type === "buff" && SPELL_BUFFS[name] && better(fast, SPELL_BUFFS[name])) {
      fast = { value: SPELL_BUFFS[name], label: item.name };
    }
  }
  return { fast, regen };
}

// Start of the creature's turn
Hooks.on("updateCombat", async (combat, changes, options) => {
  if (!isActiveGM() || !("turn" in changes || "round" in changes) || options.direction === -1) return;
  const actor = combat.combatant?.actor;
  if (!actor) return;
  const { fast, regen } = healingOf(actor);
  if (!fast && !regen) return;
  // Once a round: stepping the tracker back and forward again doesn't heal twice
  const tick = `${combat.id}.${combat.round}`;
  if (actor.getFlag(MODULE_ID, TICK) === tick) return;
  await actor.setFlag(MODULE_ID, TICK, tick);
  await healTurn(actor);
});

/** Heal the creature for its turn; returns the line posted, or null. */
export async function healTurn(actor) {
  const { fast, regen } = healingOf(actor);
  const stopped = actor.getFlag(MODULE_ID, STOPPED);
  if (stopped) await actor.unsetFlag(MODULE_ID, STOPPED);
  if (actor.statuses.has("dead")) return null;
  const regenWorks = !!regen && !stopped;
  const source = regenWorks && (!fast || regen.value >= fast.value) ? regen : fast;
  const hp = actor.system.attributes.hp;
  const hurt = hp.value < hp.max || (hp.nonlethal ?? 0) > 0;
  let text = null;
  if (source && hurt) {
    await actor.applyDamage(-source.value, { forceDialog: false });
    text = `${source === regen ? "regenerates" : "heals"} ${source.value} (${source.label})`;
  }
  if (regen && stopped) text = [text, `regeneration stopped this round by ${stopped.join(", ")}: it can die normally`].filter(Boolean).join("; ");
  else if (regenWorks && hp.value < 0) text = `${text ?? "regeneration"}; it can't die while its regeneration works`;
  if (!text) return null;
  const line = `<strong>${esc(actor.name)}</strong> ${esc(text)}.`;
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id),
    content: `<p>${line}</p>`,
  });
  return line;
}

// Damage of a type that stops regeneration (from PF1's damage instances)
Hooks.on("pf1ApplyDamage", (actor, options) => {
  if (!(options.value > 0) || !actor?.isOwner) return;
  const regen = healingOf(actor).regen;
  if (!regen?.types.length) return;
  const types = (options.instances ?? []).flatMap((i) => [...(i.types ?? [])]).map((t) => String(t).toLowerCase().replace(/[\s-]+/g, ""));
  const hit = regen.types.filter((t) => types.includes(t));
  if (hit.length) actor.setFlag(MODULE_ID, STOPPED, [...new Set([...(actor.getFlag(MODULE_ID, STOPPED) ?? []), ...hit])]);
});
