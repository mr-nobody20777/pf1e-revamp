// Alignment wards: defensive bonuses that only apply against creatures of a given alignment
// (Protection from Evil, Holy Aura, etc.). The buffs people already have (pf-content's, or any
// buff with the same name) are recognized by name; any buff can also opt in with
//   flags["pf1e-revamp"].ward = { vs, ac: { type, value }, saves: { type, value } }
// where vs is "lawful" | "chaotic" | "good" | "evil".
//
// Some of those buffs (pf-content's Holy Aura, Unholy Aura, Shield of Law, Cloak of Chaos) give
// their bonuses against everyone as flat changes. When such a buff lands on a character, its flat
// ward changes are removed from that character's copy (never the compendium), so the bonus applies
// only against the opposed alignment.
//
// Attacks: PF1 doesn't resolve hits, it prints each target's AC on the attack card. When an
// action card is created we snapshot the ward bonus for each target, and on render we add it
// to the printed AC values.
// Saves: when a save is rolled from a card's save button, PF1 passes the card as `reference`;
// the card's speaker is the source creature. Otherwise we fall back to the roller's single target.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote } from "./footnote.mjs";
import { isActiveGM, onSceneCatchUp } from "./util.mjs";
import { registerRollEffect } from "./roll-effects.mjs";

const ward = (vs, value) => ({ vs, ac: { type: "deflection", value }, saves: { type: "resist", value } });
const KNOWN_WARDS = {
  "protection from evil": ward("evil", 2),
  "protection from good": ward("good", 2),
  "protection from chaos": ward("chaotic", 2),
  "protection from law": ward("lawful", 2),
  "holy aura": ward("evil", 4),
  "unholy aura": ward("good", 4),
  "shield of law": ward("chaotic", 4),
  "cloak of chaos": ward("lawful", 4),
};

/** Ward config for a buff: its own flag, or a known ward spell by name. */
function wardFor(item) {
  if (item.type !== "buff") return null;
  return item.flags[MODULE_ID]?.ward ?? KNOWN_WARDS[item.name.toLowerCase()] ?? null;
}

/** Is this change a flat copy of the ward's bonus (vs. everyone instead of vs. the alignment)? */
function isFlatWardChange(c, w) {
  return (
    (c.target === "ac" && c.type === w.ac.type && Number(c.formula) === w.ac.value) ||
    (c.target === "allSavingThrows" && c.type === w.saves.type && Number(c.formula) === w.saves.value)
  );
}

async function fixFlatWard(item) {
  if (item.flags[MODULE_ID]?.ward) return; // our own ward buffs carry no flat changes
  const w = wardFor(item);
  if (!w) return;
  const source = item._source.system.changes ?? [];
  const kept = source.filter((c) => !isFlatWardChange(c, w));
  if (kept.length === source.length) return;
  await item.update({ "system.changes": kept, [`flags.${MODULE_ID}.wardFixed`]: true });
}

// Fix a ward buff's copy as it lands on a character (dragged in, or applied by another module)
Hooks.on("createItem", (item, options, userId) => {
  if (userId === game.user.id && item.actor && wardFor(item)) fixFlatWard(item);
});
// ...and copies already on characters, once per scene load
onSceneCatchUp((item) => {
  if (wardFor(item)) fixFlatWard(item);
});

// Which letter of PF1's two-letter alignment code (lg, cn, tn, ...) to test, and for what.
const ALIGNMENT_AXES = {
  lawful: [0, "l"],
  chaotic: [0, "c"],
  good: [1, "g"],
  evil: [1, "e"],
};

function isAlignment(actor, vs) {
  const code = actor?.system.details?.alignment;
  const axis = ALIGNMENT_AXES[vs];
  if (!code || !axis) return false;
  return code[axis[0]] === axis[1];
}

/** Active ward buffs on an actor. */
function getWards(actor) {
  return (actor.itemTypes?.buff ?? []).filter((i) => i.isActive && wardFor(i));
}

/** Highest existing change of the given bonus type affecting any of the targets. */
function highestExisting(actor, targets, type) {
  let best = 0;
  for (const c of actor.changes ?? []) {
    if (c.type === type && targets.includes(c.target) && c.value > best) best = c.value;
  }
  return best;
}

/**
 * Bonus a defender gets against an attacker for one category ("ac" or "saves").
 * Same-typed bonuses don't stack, so only the part above the defender's existing
 * bonus of that type counts.
 *
 * @returns {{ value: number, label: string } | null}
 */
function wardBonus(defender, attacker, category, changeTargets) {
  if (!defender || !attacker) return null;

  let best = null;
  for (const buff of getWards(defender)) {
    const ward = wardFor(buff);
    const grant = ward[category];
    if (!grant || !isAlignment(attacker, ward.vs)) continue;
    if (!best || grant.value > best.grant.value) best = { grant, buff };
  }
  if (!best) return null;

  const value = best.grant.value - highestExisting(defender, changeTargets, best.grant.type);
  if (value <= 0) return null;
  return { value, label: best.buff.name };
}

const BONUS_LABELS = { deflection: "deflection", resist: "resistance" };

registerFootnote((item) => {
  const ward = wardFor(item);
  if (!ward) return null;
  const parts = [];
  if (ward.ac) parts.push(`+${ward.ac.value} ${BONUS_LABELS[ward.ac.type] ?? ward.ac.type} bonus to AC on attack cards`);
  if (ward.saves) parts.push(`+${ward.saves.value} ${BONUS_LABELS[ward.saves.type] ?? ward.saves.type} bonus on saving throws`);
  let text = `While active, automatically applies ${parts.join(" and ")} against ${ward.vs} creatures. Doesn't stack with existing bonuses of the same type.`;
  if (item.flags[MODULE_ID]?.wardFixed) text += " This copy's always-on bonuses were removed so they apply only against that alignment.";
  return [text];
});

// Snapshot AC bonuses when an action card is created, so the card keeps showing what applied at
// the time of the attack even if buffs change later.
Hooks.on("preCreateChatMessage", (message) => {
  if (message.type !== "action") return;
  const targets = message.system.targets ?? [];
  if (!targets.length) return;

  const attacker = ChatMessage.implementation.getSpeakerActor(message.speaker);
  if (!attacker) return;

  const acBonus = {};
  for (const uuid of targets) {
    const defender = fromUuidSync(uuid)?.actor;
    const bonus = wardBonus(defender, attacker, "ac", ["ac"]);
    if (bonus) acBonus[uuid.replaceAll(".", "_")] = bonus;
  }
  if (Object.keys(acBonus).length) message.updateSource({ [`flags.${MODULE_ID}.acBonus`]: acBonus });
});

Hooks.on("renderChatMessagePF", (message, html) => {
  const acBonus = message.getFlag(MODULE_ID, "acBonus");
  if (!acBonus) return;

  for (const targetEl of html.querySelectorAll(".attack-targets .target[data-uuid]")) {
    const bonus = acBonus[targetEl.dataset.uuid.replaceAll(".", "_")];
    if (!bonus) continue;

    // Deflection-style bonuses apply to normal, touch and flat-footed AC alike.
    for (const valueEl of targetEl.querySelectorAll(".ac .value")) {
      const base = parseInt(valueEl.textContent);
      if (!Number.isFinite(base)) continue;
      valueEl.textContent = base + bonus.value;
      valueEl.classList.add("pf1e-revamp-warded");
      valueEl.dataset.tooltip = `${base} +${bonus.value} (${bonus.label})`;
    }
  }
});

// Saves: shown in the roll window (roll-effects.mjs); listed as not applying, with the reason, when the
// effect's source isn't of the warded alignment or isn't known
registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "save") return [];
    const wards = getWards(actor).filter((b) => wardFor(b).saves);
    if (!wards.length) return [];
    let source = null;
    const card = roll.reference ? fromUuidSync(roll.reference) : null;
    if (card) source = ChatMessage.implementation.getSpeakerActor(card.speaker);
    else if (game.user.targets.size === 1) source = game.user.targets.first().actor;

    const bonus = wardBonus(actor, source, "saves", ["allSavingThrows", roll.saveId]);
    const best = wards.reduce((a, b) => (wardFor(b).saves.value > wardFor(a).saves.value ? b : a));
    const grant = wardFor(best).saves;
    if (bonus) return [{ id: "ward", label: bonus.label, part: bonus.label, type: grant.type, roll: bonus.value, applies: true }];
    const reason = !source
      ? "roll from the effect's card, or target its source"
      : wards.some((b) => isAlignment(source, wardFor(b).vs))
        ? `a ${BONUS_LABELS[grant.type] ?? grant.type} bonus at least as high already applies`
        : `${source.name} isn't ${wards.map((b) => wardFor(b).vs).join(" or ")}`;
    return [{ id: "ward", label: best.name, part: best.name, type: grant.type, roll: grant.value, applies: false, reason }];
  },
});
