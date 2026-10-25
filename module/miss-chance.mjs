// Miss chances: Blur, Displacement, Blink, Entropic Shield and Crystalline Dust (and the
// concealment that invisibility and blindness give) only print a reminder in PF1. Here the miss
// chance is rolled for every attack on the card, against each target, and the result is shown
// under the attack.
//
// Rules (CRB / APG text):
//   - Miss chances don't stack: only the highest one that applies is rolled.
//   - Blur 20% and Displacement 50%: negated by true seeing (not see invisibility); ignored by
//     attackers who can't see the subject (they face the 50% of an unseen opponent instead).
//   - Blink 50% against physical attacks; 20% if the attacker can see invisible creatures OR the
//     attack can strike ethereal creatures (ghost touch, force), none if both. Individually targeted
//     spells have a 50% chance to fail unless the caster can target invisible, ethereal creatures.
//     The blinker's own attacks have a 20% miss chance, and their spells a 20% chance to go off on
//     the Ethereal Plane. Blind-Fight doesn't help against blink.
//   - Entropic Shield 20% against ranged attacks that need an attack roll.
//   - Blind-Fight: in melee, a miss due to concealment is rerolled once.
//
// Nevela's Automation Suite rolls its own miss chance for its Concealed condition. When that's the
// best miss chance against a target we leave it to Nevela; when ours is higher, Nevela's roll is
// marked as superseded so only one counts.

import { MODULE_ID, MELEE_ATTACKS as MELEE, RANGED_ATTACKS as RANGED } from "./const.mjs";
import { registerFootnote } from "./footnote.mjs";
import { esc } from "./util.mjs";


// Defender buffs, by name. `concealment` = Blind-Fight can reroll it.
const BUFFS = {
  blur: { label: "Blur", chance: 20, concealment: true, sight: true },
  displacement: { label: "Displacement", chance: 50, concealment: true, sight: true },
  blink: { label: "Blink", chance: 50, blink: true },
  "entropic shield": { label: "Entropic Shield", chance: 20, rangedOnly: true },
  "crystalline dust": { label: "Crystalline Dust", chance: 20 },
};

const missBuff = (item) => (item.type === "buff" ? BUFFS[item.name.toLowerCase()] ?? null : null);
const activeMissBuffs = (actor) => (actor?.itemTypes?.buff ?? []).filter((b) => b.isActive && missBuff(b));
const hasBuff = (actor, re) => (actor?.itemTypes?.buff ?? []).some((b) => b.isActive && re.test(b.name));

const hasTruesight = (actor) => (actor?.system.traits?.senses?.tr?.total ?? 0) > 0 || hasBuff(actor, /^true seeing$/i);
export const seesInvisible = (actor) => hasTruesight(actor) || hasBuff(actor, /^see invisibility$/i);
const hasBlindFight = (actor) => (actor?.itemTypes?.feat ?? []).some((f) => /^blind-fight$/i.test(f.name));

/** Can this attack strike ethereal creatures (ghost touch weapon, force effect)? */
function strikesEthereal(item) {
  if (/ghost touch/i.test(item?.name ?? "")) return true;
  return (item?.system.descriptors?.names ?? []).some((d) => /force/i.test(d));
}

const NEVELA = "nevelas-automation-suite";
const nevelaActive = () => game.modules.get(NEVELA)?.active;

/** Nevela marks total concealment with a flag on the condition's effect (or the buff giving it). */
function isTotalConcealment(actor) {
  const total = (doc) => doc?.flags?.[NEVELA]?.concealedVariant === "total";
  return (
    actor.effects.some((e) => e.statuses.has("concealed") && total(e)) ||
    (actor.itemTypes?.buff ?? []).some((b) => b.isActive && b.system.conditions?.includes?.("concealed") && (total(b) || total(b.effect)))
  );
}

/**
 * Best miss chance a defender has against this attack.
 * @returns {{ chance: number, label: string, concealment?: boolean, nevela?: boolean } | null}
 */
export function defenderMissChance(defender, attacker, item, actionType) {
  const melee = MELEE.includes(actionType);
  const candidates = [];

  for (const buff of activeMissBuffs(defender)) {
    const rule = missBuff(buff);
    if (rule.rangedOnly && melee) continue;
    if (rule.sight && (hasTruesight(attacker) || attacker.statuses.has("blind"))) continue;
    if (rule.blink) {
      const steps = (seesInvisible(attacker) ? 1 : 0) + (strikesEthereal(item) ? 1 : 0);
      const chance = [50, 20, 0][steps];
      if (chance) candidates.push({ chance, label: buff.name });
      continue;
    }
    candidates.push({ chance: rule.chance, label: buff.name, concealment: rule.concealment });
  }

  // Unseen opponents have total concealment
  if (attacker.statuses.has("blind")) candidates.push({ chance: 50, label: "Blinded attacker", concealment: true });
  else if (defender.statuses.has("invisible") && !seesInvisible(attacker)) {
    candidates.push({ chance: 50, label: "Invisible", concealment: true });
  }
  // PF1's Concealed condition: Nevela rolls it when present, otherwise we do
  if (defender.statuses.has("concealed")) {
    candidates.push({ chance: nevelaActive() && isTotalConcealment(defender) ? 50 : 20, label: "Concealed", concealment: true, nevela: nevelaActive() });
  }

  // Highest wins; on a tie, leave it to Nevela's roll so it isn't rolled twice
  return candidates.reduce((best, c) => (!best || c.chance > best.chance || (c.chance === best.chance && c.nevela) ? c : best), null);
}

// preCreateChatMessage can't wait for an async Roll (v13 dice can't be rolled synchronously), so
// draw from the same random source dice use.
const d100 = () => Math.ceil(CONFIG.Dice.randomUniform() * 100) || 1;

/** Roll a miss chance; Blind-Fight rerolls a concealment miss in melee. */
function rollMiss({ chance, label, concealment }, reroll) {
  const rolls = [d100()];
  if (rolls[0] <= chance && concealment && reroll) rolls.push(d100());
  return { chance, label, rolls, miss: rolls.at(-1) <= chance };
}

// Roll when the action card is created, so every client sees the same results.
Hooks.on("preCreateChatMessage", (message) => {
  if (message.type !== "action") return;
  const action = message.actionSource;
  const attacker = ChatMessage.implementation.getSpeakerActor(message.speaker);
  if (!action || !attacker) return;
  const item = action.item;
  const actionType = action.actionType;
  const attackCount = message.system.rolls?.attacks?.length ?? 0;
  const isAttack = attackCount > 0 && (MELEE.includes(actionType) || RANGED.includes(actionType));
  const isSpell = item.type === "spell";
  const targets = (message.system.targets ?? []).map((uuid) => fromUuidSync(uuid)).filter((t) => t?.actor);
  const reroll = MELEE.includes(actionType) && hasBlindFight(attacker);
  const attackerBlinks = hasBuff(attacker, /^blink$/i);

  const result = { attacks: [], card: [], nevelaSuperseded: false };

  if (isAttack) {
    for (let i = 0; i < attackCount; i++) {
      const lines = [];
      if (attackerBlinks && !isSpell) lines.push({ ...rollMiss({ chance: 20, label: "Blink (yours)" }), own: true });
      for (const token of targets) {
        if (isSpell && hasBuff(token.actor, /^blink$/i)) continue; // spell failure below instead
        const best = defenderMissChance(token.actor, attacker, item, actionType);
        if (!best) continue;
        if (best.nevela) continue; // Nevela rolls it
        if (token.actor.statuses.has("concealed") && nevelaActive()) result.nevelaSuperseded = true;
        lines.push({ ...rollMiss(best, reroll), target: token.name });
      }
      result.attacks.push(lines);
    }
  }

  if (isSpell) {
    // Individually targeted spells (no area) against a blinking target
    if (!action.hasTemplate) {
      for (const token of targets) {
        if (!hasBuff(token.actor, /^blink$/i) || hasTruesight(attacker)) continue;
        result.card.push({ ...rollMiss({ chance: 50, label: "Blink" }), target: token.name, spell: true });
      }
    }
    if (attackerBlinks) result.card.push({ ...rollMiss({ chance: 20, label: "Blink (yours)" }), own: true, spell: true });
  }

  if (!result.attacks.some((l) => l.length) && !result.card.length) return;
  message.updateSource({ [`flags.${MODULE_ID}.missChance`]: result });
});

function lineHtml(line, multipleTargets) {
  const who = line.own ? "" : multipleTargets && line.target ? ` vs. ${esc(line.target)}` : "";
  const rolled = line.rolls.join(", Blind-Fight reroll ");
  const outcome = line.spell
    ? line.miss
      ? line.own ? "goes off on the Ethereal Plane" : "fails"
      : "takes effect"
    : line.miss
      ? "misses"
      : "not a miss";
  const style = `margin: 0.25em 0; padding: 0 4px; border-left: 3px solid ${line.miss ? "#b33" : "#5a5"};`;
  return `<div class="${MODULE_ID}-miss-chance ${line.miss ? "miss" : "hit"}" style="${style}">${esc(line.label)} ${line.chance}%${who}: rolled ${rolled} → <strong>${outcome}</strong></div>`;
}

Hooks.on("renderChatMessagePF", (message, html) => {
  const data = message.getFlag(MODULE_ID, "missChance");
  if (!data) return;
  const multipleTargets = (message.system.targets?.length ?? 0) > 1;

  data.attacks?.forEach((lines, i) => {
    if (!lines.length) return;
    const attackEl = html.querySelector(`.chat-attack[data-index="${i}"]`);
    attackEl?.querySelector("table")?.insertAdjacentHTML("afterend", lines.map((l) => lineHtml(l, multipleTargets)).join(""));
  });
  if (data.card?.length) {
    const content = html.querySelector(".card-content") ?? html.querySelector(".message-content");
    content?.insertAdjacentHTML("beforeend", data.card.map((l) => lineHtml(l, multipleTargets)).join(""));
  }
  if (data.nevelaSuperseded) {
    for (const el of html.querySelectorAll("[data-nas-concealment-footnote]")) {
      el.style.textDecoration = "line-through";
      el.dataset.tooltip = "Superseded by a higher miss chance (PF1e Revamp); miss chances don't stack.";
    }
  }
});

registerFootnote((item) => {
  const rule = missBuff(item);
  if (!rule) return null;
  const vs = rule.rangedOnly ? "ranged attacks" : "attacks";
  let text = `Automated: a ${rule.chance}% miss chance is rolled on ${vs} against you, shown under each attack on the card.`;
  if (rule.blink) text += " Drops to 20% (or none) for attackers who see invisible creatures or strike ethereal ones; targeted spells against you have a 50% chance to fail; your own attacks have a 20% miss chance.";
  if (rule.sight) text += " Negated by true seeing.";
  if (rule.concealment) text += " Blind-Fight rerolls a miss in melee.";
  return [text];
});
