// Ranged combat, phase 1: range and Point-Blank Shot. Research: docs/RANGED-COMBAT-RESEARCH.md;
// rulings: DECISIONS.md.
//
// Rules:
//   - "Beyond this range, the attack takes a cumulative –2 penalty for each full range increment (or
//     fraction thereof) of distance to the target." Roll Bonuses applies this penalty and the maximum
//     range; this module recognizes what changes it and adjusts Roll Bonuses' range data (without Roll
//     Bonuses these changes do nothing).
//   - Far Shot: "only suffer a –1 penalty per full range increment". Sniper's accuracy: "halves all
//     range increment penalties" with bows and crossbows. Distance Thrower, Arc Slinger, Wasteland
//     Hunter: the penalty is reduced by 2 (thrown, slings, some thrown weapons). Hunter's Eye: "no
//     penalties for the second range increment" (bows). A reduction never turns into a bonus.
//   - Longer increments are added first, then doubled ("Apply this benefit before doubling the range
//     increment", Ki Range): Longshot +10 ft, Hawkeye +5 ft per 4 levels (bows), Roving Range +5 ft
//     (not thrown), Belt of Mighty Hurling and Bomber's Eye +10 ft (thrown), Skilled Thrower +10 ft
//     (thrown), Winding Path Renegade +10 ft, Flying Blade +5 ft per 4 levels and precise throw +5 ft
//     (daggers and starknives); distance weapons and Raging Hurler (thrown, raging) double it.
//   - Point-Blank Shot: "+1 bonus on attack and damage rolls with ranged weapons at ranges of up to 30
//     feet" (PF1's checkbox, ticked here when every target is that close); mythic +2. Arc Slinger: "Point-
//     Blank Shot's damage bonus applies within the first normal range increment of your sling".
//   - Situational: Eagle-Eyed (+2 circumstance beyond 100 ft), Observant Archer (+1 trait when the target
//     is at least 10 ft above or below), Canopy Shooter (+1 trait damage on higher ground within 30 ft),
//     Improved Charging Hurler (+2 damage within 30 ft on a charge), Focused Shot (+Int damage with a bow
//     or crossbow within 30 ft, as a standard action), Bomber's Eye (+1 insight with thrown weapons).
//   - Phase 4: Aspect of the Falcon ("the critical multiplier for your bows and crossbows becomes
//     19–20/×3. This effect does not stack with any other effect that expands the threat range": the
//     better range counts); Toxophilite (+2 trait to confirm critical hits with bows) and Alkenstar
//     Defender (+1 trait to confirm with ranged weapons); Halfling Slinger (+1 racial with slings);
//     Arrow-Splitter (+1 against targets two or more sizes smaller); Large Target (+1 damage per size
//     category larger with slings, precision damage); Coordinated Shot (+1 when an ally with the feat
//     threatens the target, +2 when that ally flanks it); Bullseye Shot (+4 after a move action steadying
//     the shot), Pinpoint Targeting (a single attack as a standard action without moving: the target
//     gets no armor, natural armor or shield bonus; shown on the card) and Opening Volley (+4 circumstance
//     on the next melee attack after damaging the target with a ranged attack) are ticked by the player.
// Left for later (they depend on something the module can't see yet): see TODO.md.

import { MODULE_ID, RANGED_ATTACKS } from "./const.mjs";
import { classLevel, equippedItem, tokenDistance } from "./util.mjs";
import { registerRollEffect } from "./roll-effects.mjs";
import { CRIT } from "./traits.mjs";

const feat = (actor, re) => (actor?.itemTypes?.feat ?? []).find((f) => f.isActive !== false && re.test(f.name)) ?? null;
const buff = (actor, re) => (actor?.itemTypes?.buff ?? []).find((b) => b.isActive && re.test(b.name)) ?? null;

/** What kind of ranged weapon an action uses: { thrown, bow, crossbow, sling, names }. */
function weaponKind(action) {
  const item = action?.item;
  const names = [item?.name ?? "", ...(item?.system?.baseTypes ?? [])].join(" ").toLowerCase();
  const sling = /sling/.test(names);
  return {
    thrown: action?.actionType === "twak" && !sling, // PF1 marks slings as thrown attacks (Strength to damage)
    bow: /\b(long|short)?bow\b/.test(names) && !/crossbow/.test(names),
    crossbow: /crossbow/.test(names),
    sling,
    names,
  };
}

/**
 * How this attacker's range increment and penalty change: { add, double, perIncrement, reduce, sources }.
 * perIncrement replaces the –2 per increment; reduce lowers the total penalty.
 */
export function rangeChanges(actor, action) {
  const kind = weaponKind(action);
  const out = { add: 0, double: false, perIncrement: 2, reduce: 0, sources: [] };
  const add = (ft, label) => ft > 0 && ((out.add += ft), out.sources.push(`${label} +${ft} ft`));
  const reduce = (n, label) => ((out.reduce += n), out.sources.push(`${label} −${n}`));

  if (feat(actor, /^far shot\b/i)) (out.perIncrement = 1), out.sources.push("Far Shot");
  const sniper = feat(actor, /^accuracy \(sniper\)/i);
  if (sniper && (kind.bow || kind.crossbow)) (out.perIncrement = Math.ceil(out.perIncrement / 2)), out.sources.push(sniper.name);
  if (kind.thrown && feat(actor, /^distance thrower/i)) reduce(2, "Distance Thrower");
  if (kind.sling && feat(actor, /^arc slinger/i)) reduce(2, "Arc Slinger");
  if (kind.thrown && /club|shortspear|spear|javelin/.test(kind.names) && feat(actor, /^wasteland hunter/i)) reduce(2, "Wasteland Hunter");
  if (kind.bow && feat(actor, /^hunter's eye/i)) reduce(2, "Hunter's Eye");

  if (buff(actor, /^longshot\b/i)) add(10, "Longshot");
  const hawkeye = feat(actor, /^hawkeye\b/i);
  if (hawkeye && kind.bow) add(5 * (1 + Math.floor(Math.max(0, classLevel(hawkeye, "fighter") - 2) / 4)), "Hawkeye");
  if (!kind.thrown && feat(actor, /^roving range/i)) add(5, "Roving Range");
  if (kind.thrown && equippedItem(actor, /belt of mighty hurling/i)) add(10, "Belt of Mighty Hurling");
  if (kind.thrown && buff(actor, /^bomber's eye/i)) add(10, "Bomber's Eye");
  if (kind.thrown && feat(actor, /^skilled thrower/i)) add(10, "Skilled Thrower");
  const windingPath = feat(actor, /^mystery of unfolding wind/i);
  if (windingPath) add(10, windingPath.name);
  if (kind.thrown && /dagger|starknife/.test(kind.names)) {
    const training = feat(actor, /^flying blade training/i);
    if (training) add(5 * (1 + Math.floor(Math.max(0, classLevel(training, "swashbuckler") - 5) / 4)), "Flying Blade Training");
    if (feat(actor, /^precise throw/i)) add(5, "Precise Throw");
  }
  if (/\bdistance\b/.test((action?.item?.name ?? "").toLowerCase())) (out.double = true), out.sources.push("distance ×2");
  if (kind.thrown && feat(actor, /^raging hurler/i) && buff(actor, /\brage\b/i)) (out.double = true), out.sources.push("Raging Hurler ×2");
  return out;
}

/** Size category as an index (fine 0 … colossal 8). */
function sizeIndex(actor) {
  const size = actor?.system?.traits?.size;
  const value = typeof size === "object" ? (size?.value ?? size?.base) : size;
  return typeof value === "number" ? value : Object.keys(pf1.config.sizeChart ?? {}).indexOf(value);
}

/** Is a friendly token (with the feat) threatening the target, and is it flanking with another ally? (The
 * shooter doesn't count: flanking takes a creature threatening the target in melee.) */
function coordinated(actor, targetToken) {
  const mine = actor.getActiveTokens()[0];
  if (!mine || !targetToken) return null;
  const allies = canvas.tokens.placeables.filter((t) => t.id !== mine.id && t.actor && t.document.disposition === mine.document.disposition && (tokenDistance(t, targetToken) ?? 99) <= 5);
  const withFeat = allies.filter((t) => feat(t.actor, /^coordinated shot/i));
  if (!withFeat.length) return null;
  const c = targetToken.center;
  const opposite = (a, b) => {
    const [ax, ay, bx, by] = [a.center.x - c.x, a.center.y - c.y, b.center.x - c.x, b.center.y - c.y];
    return (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1) < -0.7;
  };
  return { flanking: withFeat.some((a) => allies.some((b) => b !== a && opposite(a, b))) };
}

// Aspect of the Falcon (bows and crossbows): threat range 19–20 unless already better, multiplier ×3;
// confirmation traits
Hooks.on("pf1PreAttackRoll", (action, config, rollData, rollOptions, parts) => {
  if (!RANGED_ATTACKS.includes(action.actionType)) return;
  const actor = action.actor;
  const kind = weaponKind(action);
  if ((kind.bow || kind.crossbow) && buff(actor, /^aspect of the falcon/i)) {
    rollOptions.critical = Math.min(rollOptions.critical ?? 20, 19);
    rollData.critMult = Math.max(rollData.critMult ?? 2, 3);
  }
  if (!rollData[CRIT]) return;
  if (kind.bow && feat(actor, /^toxophilite\b/i)) parts.push("2[Toxophilite]");
  if (["rwak", "twak"].includes(action.actionType) && feat(actor, /^alkenstar defender/i)) parts.push("1[Alkenstar Defender]");
});

/** The attacker's token and the distance to its farthest target (Roll Bonuses uses the farthest too). */
function distances(actor, use) {
  const mine = use?.token?.object ?? use?.token ?? actor?.getActiveTokens()[0];
  const targets = [...game.user.targets];
  if (!mine || !targets.length) return null;
  const all = targets.map((t) => tokenDistance(mine, t)).filter((d) => d != null);
  return all.length ? { farthest: Math.max(...all), nearest: Math.min(...all), mine, targets } : null;
}

// When the action use starts: adjust Roll Bonuses' range data, and preset Point-Blank Shot (PF1's
// attack window takes its checkbox from the use options; without a window they apply directly)
Hooks.on("pf1CreateActionUse", (use) => {
  const action = use.action;
  const actor = use.actor;
  if (!actor || !RANGED_ATTACKS.includes(action?.actionType)) return;
  const changes = rangeChanges(actor, action);
  const penalty = use.shared.rollData?.rb?.rangePenalty;
  if (penalty && !penalty[MODULE_ID]) {
    penalty.range = (penalty.range + changes.add) * (changes.double ? 2 : 1);
    penalty.penalty = Math.min(penalty.penalty, changes.perIncrement);
    penalty.penaltyOffset -= changes.reduce; // Roll Bonuses ignores a total that isn't a penalty
    penalty[MODULE_ID] = changes.sources;
  }
  const pbs = feat(actor, /^point-blank shot\b/i);
  const dist = distances(actor, use);
  if (pbs && dist) {
    const kind = weaponKind(action);
    const firstIncrement = (Number(action.range?.value) || 0) + changes.add;
    const limit = kind.sling && feat(actor, /^arc slinger/i) ? Math.max(30, firstIncrement) : 30;
    use.shared.useOptions ??= {};
    use.shared.useOptions.pointBlankShot ??= dist.farthest <= limit;
  }
});

// Situational bonuses that depend on distance, in the roll window
registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "attack") return [];
    // Opening Volley: the next melee attack after a ranged hit on that target
    if (!RANGED_ATTACKS.includes(roll.action?.actionType)) {
      const volley = feat(actor, /^opening volley/i);
      return volley && ["mwak", "msak", "mcman"].includes(roll.action?.actionType) ? [{ id: "opening-volley", label: "Opening Volley", type: "circumstance", atk: 4, applies: false, reason: "tick it if you damaged this target with a ranged attack since your last turn" }] : [];
    }
    const { action } = roll;
    const kind = weaponKind(action);
    const dist = distances(actor, null);
    const out = [];
    const entry = (id, label, part, value, type, applies, reason) => out.push({ id, label, type, [part]: value, applies, ...(applies ? {} : { reason }) });

    if (roll.flags?.pointBlankShot && feat(actor, /^point-blank shot \(mythic\)/i)) {
      out.push({ id: "pbs-mythic", label: "Point-Blank Shot (Mythic)", type: "untyped", atk: 1, dmg: 1, applies: true, tooltip: "+1 more than PF1's Point-Blank Shot" });
    }
    if (feat(actor, /^eagle-eyed/i)) entry("eagle-eyed", "Eagle-Eyed", "atk", 2, "circumstance", !!dist && dist.nearest > 100, "the target isn't more than 100 ft away");
    if (feat(actor, /^observant archer/i) && dist) {
      const myElevation = dist.mine.document?.elevation ?? 0;
      const differs = dist.targets.every((t) => Math.abs((t.document?.elevation ?? 0) - myElevation) >= 10);
      entry("observant-archer", "Observant Archer", "atk", 1, "trait", differs, "the target isn't 10 ft above or below you");
    }
    if (feat(actor, /^canopy shooter/i)) entry("canopy-shooter", "Canopy Shooter", "dmg", 1, "trait", !!roll.flags?.highGround && !!dist && dist.farthest <= 30, "needs higher ground and a target within 30 ft");
    if (kind.thrown && feat(actor, /^improved charging hurler/i)) entry("improved-charging-hurler", "Improved Charging Hurler", "dmg", 2, "untyped", !!roll.flags?.charge && !!dist && dist.farthest <= 30, "needs a charge and a target within 30 ft");
    if (kind.thrown && buff(actor, /^bomber's eye/i)) entry("bombers-eye", "Bomber's Eye", "atk", 1, "insight", true);
    const targetToken = game.user.targets.size === 1 ? [...game.user.targets][0] : null;
    const target = targetToken?.actor;
    if (kind.sling && feat(actor, /^halfling slinger/i)) entry("halfling-slinger", "Halfling Slinger", "atk", 1, "racial", true);
    if (feat(actor, /^arrow-splitter/i)) entry("arrow-splitter", "Arrow-Splitter", "atk", 1, "untyped", !!target && sizeIndex(actor) - sizeIndex(target) >= 2, "the target isn't two sizes smaller than you");
    if (kind.sling && feat(actor, /^large target/i) && target) {
      const larger = sizeIndex(target) - sizeIndex(actor);
      if (larger > 0) out.push({ id: "large-target", label: "Large Target", type: "untyped", dice: { dmg: String(larger) }, damageType: "precision", showIn: ["dmg"], applies: true, tooltip: `+${larger}: the target is ${larger} size${larger === 1 ? "" : "s"} larger (precision)` });
    }
    if (feat(actor, /^coordinated shot/i) && target) {
      const c = coordinated(actor, targetToken);
      entry("coordinated-shot", "Coordinated Shot", "atk", c?.flanking ? 2 : 1, "untyped", !!c, "no ally with Coordinated Shot threatens the target");
    }
    if (feat(actor, /^bullseye shot/i)) entry("bullseye-shot", "Bullseye Shot", "atk", 4, "untyped", false, "tick it after spending a move action to steady your shot");
    if (feat(actor, /^pinpoint targeting(?! \(mythic)/i)) out.push({ id: "pinpoint-targeting", label: "Pinpoint Targeting", type: "untyped", showIn: ["atk"], valueText: "ignores armor and shield", applies: false, reason: "tick it for a single attack as a standard action, without moving this round", pinpoint: true });
    if ((kind.bow || kind.crossbow) && feat(actor, /^focused shot/i)) {
      const close = !!dist && dist.farthest <= 30;
      entry("focused-shot", "Focused Shot", "dmg", Math.max(0, actor.system.abilities.int?.mod ?? 0), "untyped", false, close ? "tick it for a single attack made as a standard action" : "the target isn't within 30 ft");
    }
    return out;
  },
});

export const _test = { weaponKind, rangeChanges, sizeIndex, coordinated };
