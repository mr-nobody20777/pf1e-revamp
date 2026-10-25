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
//     creatures in gaseous form, elemental body III/IV or particulate form.
//   - Deadly Range: +10 ft of sneak attack range each time it's taken. Sniper's Eye: ranged sneak
//     attacks within 30 ft against a target with concealment (not total concealment).
// The GM still judges "must be able to see the target ... and reach such a spot": untick it when not.

import { RANGED_ATTACKS } from "./const.mjs";
import { evaluate } from "./util.mjs";
import { registerRollEffect } from "./roll-effects.mjs";
import { defenderMissChance, seesInvisible } from "./miss-chance.mjs";

const SNEAK_TAG = /^sneakAttack/;
// Dice progressions for Sneak Attack features without their own roll formula (archetype versions)
const PROGRESSION = { rogue: (l) => Math.ceil(l / 2), rogueUnchained: (l) => Math.ceil(l / 2), ninja: (l) => Math.ceil(l / 2), slayer: (l) => Math.floor(l / 3) };
const DENIES_DEX = ["flatFooted", "blind", "cowering", "helpless", "paralyzed", "pinned", "stunned", "unconscious", "sleep", "petrified"];
const IMMUNE_FORMS = /^(gaseous form|elemental body (iii|iv)|particulate form)$/i;

const hasFeat = (actor, re) => (actor?.itemTypes?.feat ?? []).filter((f) => f.isActive !== false && re.test(f.name));
const classLevel = (actor, tag) => actor?.itemTypes?.class.find((c) => c.system.tag === tag)?.system.level ?? 0;

/** Sneak attack features and their dice: [{ item, dice, classTag }]. */
function sources(actor) {
  return (actor?.itemTypes?.feat ?? [])
    .filter((f) => f.isActive !== false && SNEAK_TAG.test(f.system.tag ?? ""))
    .map((item) => {
      const formula = item.defaultAction?.damage?.parts?.[0]?.formula ?? "";
      const m = formula.match(/^\(?(.+?)\)?d(\d+)$/);
      const classTag = item.system.class;
      const dice = m ? evaluate(m[1], item) : PROGRESSION[classTag]?.(classLevel(actor, classTag)) ?? 0;
      return { item, dice, size: m ? Number(m[2]) : 6, classTag };
    })
    .filter((s) => s.dice > 0);
}

function creatureTypes(actor) {
  const race = actor?.race?.system;
  const set = (field) => new Set([...(race?.[field]?.base ?? []), ...(race?.[field]?.total ?? [])].map((t) => String(t).toLowerCase()));
  return { types: set("creatureTypes"), subtypes: set("creatureSubtypes") };
}

/** Why the target can't take precision damage, or null. */
function immunity(target, item) {
  const { types, subtypes } = creatureTypes(target);
  if (types.has("ooze")) return "oozes are immune to precision damage";
  if (subtypes.has("elemental")) return "elementals are immune to precision damage";
  if ((target.statuses?.has("incorporeal") || subtypes.has("incorporeal")) && !/ghost touch/i.test(item?.name ?? "")) return "incorporeal (ghost touch weapons only)";
  if (hasFeat(target, /^amorphous$/i).length || (target.system.traits?.di?.total ?? new Set()).has?.("precision")) return "the target is immune to precision damage";
  const form = (target.itemTypes?.buff ?? []).find((b) => b.isActive && IMMUNE_FORMS.test(b.name));
  return form ? `${form.name} makes it immune` : null;
}

/** How the target is denied its Dexterity bonus against this attacker, or null. */
function deniedDex(target, attacker) {
  const uncanny = hasFeat(target, /uncanny dodge/i).length > 0;
  for (const id of DENIES_DEX) {
    if (id === "flatFooted" && uncanny) continue;
    if (target.statuses?.has(id)) return pf1.registry.conditions.get(id)?.name?.toLowerCase() ?? id;
  }
  // PF1's flag also follows its conditions (flat-footed even with Uncanny Dodge): other sources only
  const flagged = target.items.find((i) => i.isActive && i.system.changeFlags?.loseDexToAC);
  if (flagged) return `denied its Dexterity bonus (${flagged.name})`;
  if (attacker.statuses?.has("invisible") && !seesInvisible(target) && !uncanny) return "can't see you";
  return null;
}

/** Can this attacker flank the target (Improved Uncanny Dodge)? */
function canFlank(target, attacker, srcs) {
  const iud = hasFeat(target, /^improved uncanny dodge/i)[0];
  if (!iud) return true;
  const theirs = classLevel(target, iud.system.class) || target.system.attributes?.hd?.total || 0;
  const ours = [...new Set(srcs.map((s) => s.classTag))].reduce((t, tag) => t + classLevel(attacker, tag), 0);
  return ours >= theirs + 4;
}

const distance = (a, b) => (a && b ? canvas.grid.measurePath([a.center, b.center]).distance : null);

registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "attack") return [];
    const srcs = sources(actor);
    if (!srcs.length) return [];
    const count = srcs.reduce((t, s) => t + s.dice, 0);
    const size = Math.max(...srcs.map((s) => s.size));
    const base = { id: "sneak-attack", label: "Sneak Attack", type: "untyped", dice: { dmg: `${count}d${size}` }, nonCrit: true };
    const not = (reason) => [{ ...base, applies: false, reason }];

    const targets = [...game.user.targets];
    if (targets.length !== 1) return not(targets.length ? "more than one target" : "no target selected");
    const targetToken = targets[0];
    const target = targetToken.actor;
    if (!target) return not("no target selected");
    const { action } = roll;
    const ranged = RANGED_ATTACKS.includes(action.actionType);

    const immune = immunity(target, action.item);
    if (immune) return not(immune);

    // Range: 30 ft for ranged attacks, +10 ft per Deadly Range
    const attackerToken = actor.getActiveTokens()[0];
    const range = 30 + 10 * hasFeat(actor, /^deadly range/i).length;
    const dist = distance(attackerToken, targetToken);
    if (ranged && dist != null && dist > range) return not(`beyond ${range} ft`);

    // Concealment; Sniper's Eye allows ranged attacks within 30 ft through concealment (not total)
    const miss = defenderMissChance(target, actor, action.item, action.actionType);
    if (miss?.concealment) {
      const total = miss.chance >= 50;
      const snipersEye = ranged && !total && hasFeat(actor, /^sniper's eye/i).length && (dist == null || dist <= 30);
      if (!snipersEye) return not(`${miss.label}: concealment`);
    }

    const denied = deniedDex(target, actor);
    if (denied) return [{ ...base, applies: true, tooltip: `${base.dice.dmg}: the target is ${denied}` }];
    if (!ranged && roll.flanking) {
      if (canFlank(target, actor, srcs)) return [{ ...base, applies: true, tooltip: `${base.dice.dmg}: you flank the target` }];
      return not("Improved Uncanny Dodge: can't be flanked by you");
    }
    return not("the target isn't flanked or denied its Dexterity bonus");
  },
});

export const _test = { sources, deniedDex, immunity, canFlank };
