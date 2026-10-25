// Sneak attack (phase 1): the extra dice of every Sneak Attack class feature, added to attacks that
// qualify and shown in the roll window (roll-effects.mjs), where they can be left out of a roll.
// Research and phases: docs/SNEAK-ATTACK-RESEARCH.md; rulings: DECISIONS.md.
//
// Rules (rogue and slayer text):
//   - "The slayer's attack deals extra damage anytime his target would be denied a Dexterity bonus to AC
//     (whether the target actually has a Dexterity bonus or not), or when the slayer flanks his target."
//   - "Should the slayer score a critical hit with a sneak attack, this additional damage is not multiplied."
//   - "Ranged attacks can count as sneak attacks only if the target is within 30 feet."
//   - "A slayer cannot use sneak attack while striking a creature with concealment."
//   - Dice from different classes stack. PF1's own formula on each feature gives its dice.
//   - Denied Dexterity: flat-footed, blinded, cowering, helpless (paralyzed, unconscious, asleep,
//     petrified), pinned, stunned, or unable to see the attacker. Uncanny Dodge: not caught flat-footed
//     and keeps Dex against an invisible attacker. Improved Uncanny Dodge: can't be flanked except by
//     a character with at least four more levels in classes that grant sneak attack.
//   - Immune: oozes, elementals, incorporeal creatures (no ghost touch), amorphous creatures, and
//     creatures in gaseous form, elemental body III/IV or particulate form. Not checked here: the roll
//     window would tell the player before the attack. The dice are typed precision and the immunity
//     takes them out when the damage is applied (resistance.mjs).
//   - Deadly Range: +10 ft of sneak attack range each time it's taken. Sniper's Eye: ranged sneak
//     attacks within 30 ft against a target with concealment (not total concealment).
// The GM still judges "must be able to see the target ... and reach such a spot": untick it when not.

import { MODULE_ID, RANGED_ATTACKS } from "./const.mjs";
import { evaluate, classLevel } from "./util.mjs";
import { registerRollEffect } from "./roll-effects.mjs";
import { missChances, seesInvisible } from "./miss-chance.mjs";
import { isIncorporeal } from "./resistance.mjs";
import { registerFootnote, footnoteButton } from "./footnote.mjs";
import { riderChoice } from "./sneak-talents.mjs";

const SNEAK_TAG = /^sneakAttack/;
// Dice progressions for Sneak Attack features without their own roll formula (archetype versions)
const PROGRESSION = { rogue: (l) => Math.ceil(l / 2), rogueUnchained: (l) => Math.ceil(l / 2), ninja: (l) => Math.ceil(l / 2), slayer: (l) => Math.floor(l / 3) };
const DENIES_DEX = ["flatFooted", "blind", "cowering", "helpless", "paralyzed", "pinned", "stunned", "unconscious", "sleep", "petrified"];

const hasFeat = (actor, re) => (actor?.itemTypes?.feat ?? []).filter((f) => f.isActive !== false && re.test(f.name));
const isSneakAttack = (item) => item?.type === "feat" && SNEAK_TAG.test(item.system.tag ?? "");

/** Sneak attack features and their dice: [{ item, dice, size, classTag }]. */
function sources(actor) {
  return (actor?.itemTypes?.feat ?? [])
    .filter((f) => f.isActive !== false && isSneakAttack(f))
    .map((item) => {
      // "(floor(@class.level / 3))d6" or "ceil(@class.level / 2)d6": the count, then the die size
      const m = (item.defaultAction?.damage?.parts?.[0]?.formula ?? "").trim().match(/^(.+)d(\d+)$/);
      let count = m?.[1].trim();
      if (count?.startsWith("(") && count.endsWith(")")) count = count.slice(1, -1);
      const classTag = item.system.class;
      const dice = count ? evaluate(count, item) : PROGRESSION[classTag]?.(classLevel(item)) ?? 0;
      return { item, dice, size: m ? Number(m[2]) : 6, classTag };
    })
    .filter((s) => s.dice > 0);
}

/** The dice of all sources by die size: [{ n, size }]. */
function termsOf(srcs) {
  const bySize = new Map();
  for (const s of srcs) bySize.set(s.size, (bySize.get(s.size) ?? 0) + s.dice);
  return [...bySize].sort((a, b) => a[0] - b[0]).map(([size, n]) => ({ n, size }));
}

/** The dice of all sources, each die size on its own: "3d6", "3d6 + 1d8". */
const diceText = (srcs) => termsOf(srcs).map((t) => `${t.n}d${t.size}`).join(" + ");

// Vicious Claws (catfolk): d8s instead of d6s when the sneak attack is made with claws
const viciousClaws = (actor, item) => item?.subType === "natural" && /claw/i.test(item.name) && hasFeat(actor, /^vicious claws/i).length > 0;

// Hunter's Surprise: once a day, an adjacent enemy designated as prey takes sneak attack damage from
// all of the character's attacks until the end of her next turn, flanked or not
const HUNTER = "Hunter's Surprise";
const preyOf = (actor) => actor.itemTypes.buff.find((b) => b.isActive && b.getFlag(MODULE_ID, "hunterPrey"))?.getFlag(MODULE_ID, "hunterPrey") ?? null;

/** How the target is denied its Dexterity bonus against this attacker ("the target is stunned"), or null. */
function deniedDex(target, attacker) {
  const uncanny = hasFeat(target, /uncanny dodge/i).length > 0;
  for (const id of DENIES_DEX) {
    if (id === "flatFooted" && uncanny) continue;
    if (target.statuses?.has(id)) return `the target is ${pf1.registry.conditions.get(id)?.name?.toLowerCase() ?? id}`;
  }
  // PF1's flag also follows its conditions (flat-footed even with Uncanny Dodge): other sources only
  const flagged = target.items.find((i) => i.isActive && i.system.changeFlags?.loseDexToAC);
  if (flagged) return `the target is denied its Dexterity bonus (${flagged.name})`;
  if (attacker.statuses?.has("invisible") && !seesInvisible(target) && !uncanny) return "the target can't see you";
  return null;
}

/** Can this attacker flank the target (Improved Uncanny Dodge)? */
function canFlank(target, attacker, srcs) {
  const iud = hasFeat(target, /^improved uncanny dodge/i)[0];
  if (!iud) return true;
  const theirs = classLevel(iud) || target.system.attributes?.hd?.total || 0;
  const bySource = new Map(srcs.map((s) => [s.classTag, classLevel(s.item)]));
  const ours = [...bySource.values()].reduce((t, l) => t + l, 0);
  return ours >= theirs + 4;
}

/** Distance between the nearest squares the two tokens occupy (large creatures fill several). */
function distance(a, b) {
  if (!a || !b) return null;
  if (canvas.grid.isGridless) return canvas.grid.measurePath([a.center, b.center]).distance;
  const cells = (t) => t.document.getOccupiedGridSpaceOffsets().map((o) => canvas.grid.getCenterPoint(o));
  let best = Infinity;
  for (const p of cells(a)) for (const q of cells(b)) best = Math.min(best, canvas.grid.measurePath([p, q]).distance);
  return best;
}

registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "attack") return [];
    let srcs = sources(actor);
    if (!srcs.length) return [];
    const { action } = roll;
    if (viciousClaws(actor, action.item)) srcs = srcs.map((s) => ({ ...s, size: 8 }));
    const base = { id: "sneak-attack", label: "Sneak Attack", type: "untyped", dice: { dmg: diceText(srcs) }, damageType: "precision", showIn: ["dmg"] };
    const choice = riderChoice(actor, termsOf(srcs), action, srcs);
    if (choice) base.choice = choice;
    // Assassinate: ticked by the player once the target has been studied for 1 round
    const assassinate = hasFeat(actor, /^assassinate/i)[0];
    const extra = assassinate ? [{ id: "assassinate", label: "Assassinate", type: "untyped", showIn: ["dmg"], valueText: "Fortitude or die", applies: false, reason: "tick it after studying the target for 1 round (a standard action)", assassinate: assassinate.uuid }] : [];
    const not = (reason) => [{ ...base, applies: false, reason }, ...extra];
    const yes = (tooltip) => [{ ...base, applies: true, tooltip }, ...extra];

    const targets = [...game.user.targets];
    if (targets.length !== 1) return not(targets.length ? "more than one target" : "no target selected");
    const targetToken = targets[0];
    const target = targetToken.actor;
    if (!target) return not("no target selected");
    const ranged = RANGED_ATTACKS.includes(action.actionType);

    // A ghost touch weapon deals precision damage to an incorporeal creature: not typed precision then
    if (isIncorporeal(target) && /ghost touch/i.test(action.item?.name ?? "")) delete base.damageType;

    // Range: 30 ft for ranged attacks, +10 ft per Deadly Range
    const attackerToken = actor.getActiveTokens()[0];
    const range = 30 + 10 * hasFeat(actor, /^deadly range/i).length;
    const dist = distance(attackerToken, targetToken);
    if (ranged && dist != null && dist > range) return not(`beyond ${range} ft`);

    // Concealment (any, not only the best miss chance); Sniper's Eye allows ranged attacks within 30 ft
    // through concealment (not total)
    const concealment = missChances(target, actor, action.item, action.actionType).filter((c) => c.concealment);
    if (concealment.length) {
      const worst = concealment.reduce((a, b) => (b.chance > a.chance ? b : a));
      const total = worst.chance >= 50;
      const snipersEye = ranged && !total && hasFeat(actor, /^sniper's eye/i).length && (dist == null || dist <= 30);
      if (!snipersEye) return not(`${worst.label}: concealment`);
    }

    if (preyOf(actor) === targetToken.document.uuid) return yes(`${base.dice.dmg}: ${HUNTER} (your prey)`);
    const denied = deniedDex(target, actor);
    if (denied) return yes(`${base.dice.dmg}: ${denied}`);
    if (!ranged && roll.flags?.flanking) {
      if (canFlank(target, actor, srcs)) return yes(`${base.dice.dmg}: you flank the target`);
      return not("Improved Uncanny Dodge: can't be flanked by you");
    }
    return not("the target isn't flanked or denied its Dexterity bonus");
  },
});

// PF1's own Use button on the feature still rolls the dice on their own
registerFootnote((item) =>
  isSneakAttack(item) ? ["Added to attack damage automatically when it applies (see the attack window). No need to roll it from here as well."] : null
);

// Hunter's Surprise: designate the targeted adjacent enemy as prey (once a day, until the end of your next turn)
async function designatePrey(item) {
  const actor = item.actor;
  const targets = [...game.user.targets];
  const mine = actor?.getActiveTokens()[0];
  if (targets.length !== 1) return ui.notifications.warn(`${HUNTER}: target the one enemy to designate as prey.`);
  const dist = distance(mine, targets[0]);
  if (dist != null && dist > 5) return ui.notifications.warn(`${HUNTER}: your prey must be adjacent to you.`);
  // Daily uses, when tracked (PF1 leaves them empty until the first rest)
  const uses = item.system.uses;
  if (uses?.per && uses.maxFormula && uses.value != null) {
    if (!(uses.value > 0)) return ui.notifications.warn(`${HUNTER}: no uses left today.`);
    await item.update({ "system.uses.value": uses.value - 1 });
  }
  const old = actor.itemTypes.buff.filter((b) => b.getFlag(MODULE_ID, "hunterPrey"));
  if (old.length) await actor.deleteEmbeddedDocuments("Item", old.map((b) => b.id));
  await actor.createEmbeddedDocuments("Item", [{
    type: "buff", name: `${HUNTER}: ${targets[0].name}`, img: item.img,
    system: { subType: "temp", active: true, duration: { value: "2", units: "round" }, description: { value: `<p>Sneak attack damage on every attack against ${targets[0].name}, flanked or not, until the end of your next turn.</p>` } },
    flags: { [MODULE_ID]: { hunterPrey: targets[0].document.uuid } },
  }]);
}

registerFootnote((item) =>
  item?.type === "feat" && /^hunter'?s surprise/i.test(item.name) && item.actor?.isOwner
    ? ["Target the adjacent enemy, then: ", footnoteButton("Designate prey", "Once a day: sneak attack applies to all your attacks against it until the end of your next turn", () => designatePrey(item))]
    : null
);

export const _test = { sources, diceText, termsOf, deniedDex, canFlank, distance, designatePrey };
