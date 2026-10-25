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
//   - Phase 3 (feats, items, traits): extra dice (Accomplished Sneak Attacker, capped at half the
//     character level rounded up; Armor of the Shadow Lord; Mantis Blade; Sense Vitals, which also grants
//     sneak attack; Merciless Precision), bonuses on sneak attacks (The Vessel Between, Blade of the
//     Society, Headband of Ninjitsu, Sniper Goggles, Sap Adept and Sap Master), concealment (Shadow
//     Strike, Mirrored, Shadow Cleaver, Acute Shot; Headband of Ninjitsu even total), range (Sniping 45 ft,
//     Sniper Goggles any distance) and Amulet of Uncanny Defense on the target. Fortification:
//     fortification.mjs.
// The GM still judges "must be able to see the target ... and reach such a spot": untick it when not.

import { MODULE_ID, RANGED_ATTACKS } from "./const.mjs";
import { evaluate, classLevel, equippedItem as equipped } from "./util.mjs";
import { registerRollEffect, registerDamageFilter, rollPlan } from "./roll-effects.mjs";
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
// Phase 3: feats, items and traits
const MERCILESS = ["blind", "dying", "entangled", "exhausted", "frightened", "helpless", "nauseated", "panicked", "paralyzed", "stunned"];
const isBludgeoningNonlethal = (action) =>
  (action.nonlethal || !!action.item?.system.properties?.nnl) && (action.damage?.parts ?? []).some((p) => [...(p.types ?? [])].includes("bludgeoning"));

/** Dice from feats, items and spells, added to the class features' dice: [{ dice, size, label }]. */
function bonusDice(actor, action, target, classDice) {
  const out = [];
  const add = (dice, label) => dice > 0 && out.push({ dice, size: 6, label });
  // Sense Vitals: +1d6, +1d6 per 3 caster levels beyond 3rd (max 5d6), with manufactured weapons
  const vitals = actor.itemTypes.buff.find((b) => b.isActive && /^sense vitals/i.test(b.name));
  if (vitals && action.item?.subType !== "natural") add(Math.min(5, 1 + Math.floor(Math.max(0, (vitals.system.level ?? 3) - 3) / 3)), "Sense Vitals");
  if (classDice || out.length) {
    if (equipped(actor, /armor of the shadow lord/i)) add(1, "Armor of the Shadow Lord");
    if (/mantis blade/i.test(action.item?.name ?? "")) add(1, "Mantis Blade");
    if (hasFeat(actor, /^merciless precision/i).length && MERCILESS.some((id) => target?.statuses?.has(id))) add(1, "Merciless Precision");
  }
  // Accomplished Sneak Attacker: +1d6, but no more dice than half the character level (rounded up)
  if (classDice && hasFeat(actor, /^accomplished sneak attacker/i).length) {
    const total = classDice + out.reduce((t, x) => t + x.dice, 0);
    const cap = Math.ceil((actor.system.details?.level?.value ?? 0) / 2);
    add(Math.min(1, cap - total), "Accomplished Sneak Attacker");
  }
  return out;
}

/** Bonuses on attacks that deal sneak attack damage: { atk, dmg, labels }. */
function sneakBonuses(actor, action, ranged, dist, n, target) {
  const atk = [], dmg = [];
  if (hasFeat(actor, /^the vessel between/i).length) atk.push([1, "The Vessel Between"]);
  if (equipped(actor, /headband of ninjitsu/i)) atk.push([2, "Headband of Ninjitsu"]);
  if (hasFeat(actor, /^blade of the society/i).length) dmg.push([1, "Blade of the Society"]);
  const goggles = equipped(actor, /sniper goggles/i);
  if (goggles && ranged && (/greater/i.test(goggles.name) || dist == null || dist <= 30)) dmg.push([2 * n, goggles.name]);
  if (isBludgeoningNonlethal(action) && hasFeat(actor, /^sap adept/i).length) dmg.push([n, "Sap Adept"]);
  const sum = (list) => list.reduce((t, [v]) => t + v, 0);
  const label = (list) => list.map(([, l]) => l).join(", ");
  return { atk: sum(atk), dmg: sum(dmg), partLabel: { atk: label(atk), dmg: label(dmg) } };
}

/** What lets this attack deal sneak attack damage through concealment, or null. */
function ignoresConcealment(actor, action, ranged, total) {
  if (equipped(actor, /headband of ninjitsu/i)) return "Headband of Ninjitsu";
  if (total) return null;
  if (hasFeat(actor, /^shadow strike/i).length) return "Shadow Strike";
  if (/shadow cleaver/i.test(action.item?.name ?? "")) return "Shadow Cleaver";
  if (equipped(actor, /mirrored/i)) return "Mirrored";
  if (ranged && hasFeat(actor, /^acute shot/i).length && (action.item?.system.enh ?? 0) > 0) return "Acute Shot";
  return null;
}

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
  // Amulet of Uncanny Defense: Uncanny Dodge works as Improved Uncanny Dodge, or 4 more levels for it
  const amulet = equipped(target, /amulet of uncanny defense/i);
  const iud = hasFeat(target, /^improved uncanny dodge/i)[0] ?? (amulet ? hasFeat(target, /uncanny dodge/i)[0] : null);
  if (!iud) return true;
  const theirs = (classLevel(iud) || target.system.attributes?.hd?.total || 0) + (amulet && /^improved/i.test(iud.name) ? 4 : 0);
  const bySource = new Map(srcs.filter((s) => s.item).map((s) => [s.classTag, classLevel(s.item)]));
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
    const { action } = roll;
    const chosenTargets = [...game.user.targets];
    let srcs = sources(actor);
    srcs = [...srcs, ...bonusDice(actor, action, chosenTargets.length === 1 ? chosenTargets[0].actor : null, srcs.reduce((t, s) => t + s.dice, 0))];
    if (!srcs.length) return [];
    if (viciousClaws(actor, action.item)) srcs = srcs.map((s) => ({ ...s, size: 8 }));
    const base = { id: "sneak-attack", label: "Sneak Attack", type: "untyped", dice: { dmg: diceText(srcs) }, damageType: "precision", showIn: ["dmg"] };
    // The dice as this attack has them (Sap Master doubles them, Acute Shot caps them); the talent
    // dropdown works from these
    let terms = termsOf(srcs);
    const withChoice = () => {
      base.dice = { dmg: terms.map((t) => `${t.n}d${t.size}`).join(" + ") };
      const choice = riderChoice(actor, terms, action, srcs);
      if (choice) base.choice = choice;
      return base;
    };
    // Assassinate: ticked by the player once the target has been studied for 1 round
    const assassinate = hasFeat(actor, /^assassinate/i)[0];
    const extra = assassinate ? [{ id: "assassinate", label: "Assassinate", type: "untyped", showIn: ["dmg"], valueText: "Fortitude or die", applies: false, reason: "tick it after studying the target for 1 round (a standard action)", assassinate: assassinate.uuid }] : [];
    // Night Stalker's Tonic: +1d6 for 1 round when its drinker accepts alchemical burn
    if (actor.items.some((i) => /night stalker'?s tonic/i.test(i.name))) {
      extra.push({ id: "night-stalker", label: "Night Stalker's Tonic", type: "untyped", dice: { dmg: "1d6" }, damageType: "precision", showIn: ["dmg"], applies: false, reason: "tick it when you accept alchemical burn (within the tonic's hour)" });
    }
    // In a surprise round, Surprise Attack and Onslaught make it apply: a tick for the player
    const surprise = hasFeat(actor, /^(surprise attack|onslaught)/i)[0];
    const not = (reason) => [{ ...withChoice(), applies: false, reason: surprise ? `${reason}; tick it in a surprise round (${surprise.name})` : reason }, ...extra];
    const yes = (tooltip) => [{ ...withChoice(), applies: true, tooltip: `${base.dice.dmg}: ${tooltip}` }, ...extra];

    const targets = [...game.user.targets];
    if (targets.length !== 1) return not(targets.length ? "more than one target" : "no target selected");
    const targetToken = targets[0];
    const target = targetToken.actor;
    if (!target) return not("no target selected");
    const ranged = RANGED_ATTACKS.includes(action.actionType);

    // A ghost touch weapon deals precision damage to an incorporeal creature: not typed precision then
    if (isIncorporeal(target) && /ghost touch/i.test(action.item?.name ?? "")) delete base.damageType;

    // Range: 30 ft for ranged attacks, +10 ft per Deadly Range; a Sniping weapon 45 ft (not stacking);
    // Sniper Goggles any distance
    const attackerToken = actor.getActiveTokens()[0];
    const sniping = /sniping/i.test(action.item?.name ?? "") ? 45 : 0;
    const range = equipped(actor, /sniper goggles/i) ? Infinity : Math.max(30 + 10 * hasFeat(actor, /^deadly range/i).length, sniping);
    const dist = distance(attackerToken, targetToken);
    if (ranged && dist != null && dist > range) return not(`beyond ${range} ft`);

    // Bonuses on the attack and damage, and Sap Master's doubled dice
    const n = srcs.reduce((t, x) => t + x.dice, 0);
    const bonus = sneakBonuses(actor, action, ranged, dist, n, target);
    if (bonus.atk) Object.assign(base, { atk: bonus.atk, showIn: ["atk", "dmg"] });
    if (bonus.dmg) base.dmg = bonus.dmg;
    base.partLabel = { atk: `Sneak Attack (${bonus.partLabel.atk})`, dmg: `Sneak Attack (${bonus.partLabel.dmg})` };
    if (isBludgeoningNonlethal(action) && hasFeat(actor, /^sap master/i).length && target.statuses?.has("flatFooted")) {
      terms = terms.map((t) => ({ ...t, n: t.n * 2 }));
    }

    // Concealment (any, not only the best miss chance); Sniper's Eye allows ranged attacks within 30 ft
    // through concealment (not total)
    const concealment = missChances(target, actor, action.item, action.actionType).filter((c) => c.concealment);
    if (concealment.length) {
      const worst = concealment.reduce((a, b) => (b.chance > a.chance ? b : a));
      const total = worst.chance >= 50;
      const snipersEye = ranged && !total && hasFeat(actor, /^sniper's eye/i).length && (dist == null || dist <= 30);
      const through = snipersEye ? "Sniper's Eye" : ignoresConcealment(actor, action, ranged, total);
      if (!through) return not(`${worst.label}: concealment`);
      // Acute Shot: no more dice than the weapon's magic bonus
      if (through === "Acute Shot") terms = [{ n: Math.min(n, action.item.system.enh), size: 6 }];
    }

    if (preyOf(actor) === targetToken.document.uuid) return yes(`${HUNTER} (your prey)`);
    const denied = deniedDex(target, actor);
    if (denied) return yes(denied);
    if (!ranged && roll.flags?.flanking) {
      if (canFlank(target, actor, srcs)) return yes("you flank the target");
      return not("Improved Uncanny Dodge: can't be flanked by you");
    }
    return not("the target isn't flanked or denied its Dexterity bonus");
  },
});

// Critical hits (PF1 rolls the critical damage on its own, where sneak attack dice never go):
//   - Sneaking Critical: "Whenever you confirm a critical hit on a sneak attack, you can roll an additional
//     number of sneak attack dice equal to your weapon's critical modifier."
//   - Savage Critical: "When you ... confirm a critical hit against an opponent, add your sneak attack
//     damage to the damage from the attack. This feat has no effect on attacks that already allow you
//     to add sneak attack damage." (Its Vital Strike half isn't automated.)
// PF1 rolls the critical damage critMult − 1 times, counting them in critCount: these go in the first only.
registerDamageFilter((rollData, parts, action) => {
  const actor = action.actor;
  if (!(rollData.critMult > 1) || (rollData.critCount ?? 1) > 1 || !actor || !parts[0]) return;
  const sneak = rollPlan(rollData)?.provided.find((p) => p.id === "sneak-attack");
  const types = [...new Set([...(parts[0].damageType ?? []), "precision"])];
  if (sneak?.dice?.dmg && hasFeat(actor, /^sneaking critical/i).length) {
    parts.push({ base: `${rollData.critMult}d6[Sneaking Critical]`, extra: [], damageType: types, type: "normal" });
  } else if (!sneak && hasFeat(actor, /^savage critical/i).length) {
    const srcs = sources(actor);
    if (srcs.length) parts.push({ base: `${diceText(srcs)}[Savage Critical]`, extra: [], damageType: types, type: "normal" });
  }
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
