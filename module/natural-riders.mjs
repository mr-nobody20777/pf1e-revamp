// Natural-attack riders (on-hit riders, phase 2): what a monster's attack does when it hits, written in
// its statblock as "plus grab", "plus poison", "plus bleed and grab", or as an @Use link to the ability.
//
// Rules (universal monster rules, verbatim where quoted):
//   - Automatic, on every hit (applied by the module once it sees the hit, with an Undo):
//       energy drain "happens automatically when a melee or ranged attack hits" (twice the negative levels on
//       a confirmed critical; "a draining creature gains 5 temporary hit points for each negative level");
//       paralysis (Fortitude save; "does not allow a new save each round"; duration from the creature's
//       entry); attach ("The creature is grappled, but the target is not"); bleed (amount from the entry);
//       poison and disease (only the first save here: their schedule belongs to the afflictions engine).
//   - The monster's choice ("can attempt", "can choose to attempt"), buttons on the card:
//       grab ("+4 bonus on combat maneuver checks to start and maintain a grapple"; or a hold with the body
//       part, "-20 penalty ... but does not gain the grappled condition itself"; only against creatures its
//       size or smaller); trip ("If the attempt fails, the creature is not tripped in return"; no more than
//       one size larger, as for any trip); pull and push (its size or smaller; the GM moves the token).
//       Constrict deals its damage on a successful grab. The grapple on later rounds: monster-grapple.mjs.
//   - Phase 3: burn "deals fire damage in addition to damage dealt on a successful hit in melee", with a
//     Reflex save or catch fire (burning.mjs); "Creatures that hit a burning creature with natural weapons or
//     unarmed attacks take fire damage as though hit by the burning creature" (the attacker's card). Rend:
//     "If it hits with two or more natural attacks in 1 round… an additional amount of damage, but no more
//     than once per round": the creature's hits on a target are counted for the round (on one card outside
//     combat) and the card that completes them offers it, as the monster's choice ("can cause").
//     An @Use link to the ability in any note is a rider even without "plus" (the stirge's touch attack).
//   - Weapon qualities that act on a hit (phase 4b; text in magic-arms.mjs and the rules map): wounding
//     ("1 point of bleed damage when it hits a creature. Multiple hits from a wounding weapon increase the
//     bleed damage ... Creatures immune to critical hits are immune to the bleed damage"); disruption ("Any
//     undead creature struck in combat must succeed at a DC 14 Will save or be destroyed"); thundering
//     ("Subjects dealt critical hits by a thundering weapon must make a successful DC 14 Fortitude save or be
//     deafened permanently"); vorpal ("Upon a roll of natural 20 (followed by a successful roll to confirm
//     the critical hit), the weapon severs the opponent's head (if it has one) ... Some creatures, such as
//     many aberrations and all oozes, have no heads. Others, such as golems and undead creatures other than
//     vampires, are not affected by the loss of their heads"): the GM decides, with a button (ruling
//     2026-11-16).
// Rulings (DECISIONS.md, 2026-11-10): automatic riders are applied when the module can tell the attack hit
// (attack total against AC, natural 20 and 1, after miss chances), else they wait for an Apply button;
// the creature's own entry gives the numbers, and when PF1's data disagrees with the rules text the text
// wins (the universal Paralysis item's Charisma-based DC is computed from Constitution).

import { MODULE_ID } from "./const.mjs";
import { dealDamage, esc, isActiveGM, onGmRequest, requestedByOwner, restoreDamage, rollTotal, saveResult, timed } from "./util.mjs";
import { creatureTypes } from "./creature-types.mjs";
import { setBleed, stopBleed } from "./bleed.mjs";
import { extinguish, setBurning } from "./burning.mjs";
import { constrictFormula, endGrapple, maneuverCheck, recordGrapple, sizeOf, specialAttack } from "./monster-grapple.mjs";
import { qualitiesOf, fits } from "./magic-arms.mjs";
import { precisionImmune } from "./resistance.mjs";

const FLAG = "naturalRiders";
const SAVE_NAME = { fort: "Fortitude", ref: "Reflex", will: "Will" };
const roll = rollTotal;
const DICE = String.raw`\d+d\d+(?:\s*[+-]\s*\d+)?`;
const WORDS = { "energy drain": "energyDrain", burn: "burn", grab: "grab", trip: "trip", pull: "pull", push: "push", paralysis: "paralysis", poison: "poison", disease: "disease", bleed: "bleed", attach: "attach" };
const WORD_RE = new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\b`, "gi");
const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/* -------------------------------------------- */
/*  Reading the attack and the creature's entry */
/* -------------------------------------------- */

const plain = (html) => String(html ?? "").replace(/@Use\[([^;\]]+)[^\]]*\]/g, "$1").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

/** The rider keys an attack carries ("plus grab", "Bite (plus Grab)", "plus @Use[Poison]"), with any "(…)" detail. */
export function ridersOf(item, action) {
  const raw = [...(item.system.attackNotes ?? []), ...(item.system.effectNotes ?? []), ...(action?.notes?.attack ?? []), ...(action?.notes?.effect ?? []), ...(action?.notes?.footer ?? [])].map((n) => String(n?.text ?? n ?? ""));
  const notes = raw.map(plain);
  // A clause runs to the end of the sentence: details in parentheses may hold ";" ("poison (Fort DC 13; effect …)").
  // A link to the ability is a rider by itself (the stirge's touch: "@Use[Attach;as=auto]")
  const clauses = [
    ...[item.name, ...notes].flatMap((t) => [...t.matchAll(/\bplus\s+([^.]+)/gi)].map((m) => m[1])),
    ...raw.flatMap((t) => [...t.matchAll(/@Use\[([^;\]]+)/g)].map((m) => m[1])),
  ];
  const found = new Map();
  for (const clause of clauses) {
    for (const m of clause.matchAll(WORD_RE)) {
      const key = WORDS[m[1].toLowerCase()];
      const detail = clause.slice(m.index + m[0].length).match(/^\s*\(([^)]*)\)/)?.[1] ?? "";
      if (!found.has(key)) found.set(key, detail);
    }
  }
  return found;
}

// Weapon qualities that act on a hit, as riders: `critOnly` on a confirmed critical, `gm` only by the GM's
// button (vorpal: on a natural 20 that's confirmed)
const WEAPON_RIDERS = {
  wounding: { key: "bleed", label: "Wounding", amount: "1", stack: true, critImmune: true },
  disruption: { key: "disruption", label: "Disruption", save: "will", dc: 14 },
  thundering: { key: "deafen", label: "Thundering", save: "fort", dc: 14, critOnly: true },
  vorpal: { key: "vorpal", label: "Vorpal", gm: true },
};

/** The weapon's qualities that act on a hit (those that fit the weapon), as riders. */
export function weaponRiders(item, action) {
  const q = qualitiesOf(item);
  if (!q) return [];
  const hidden = !!item.showUnidentifiedData;
  return Object.entries(WEAPON_RIDERS)
    .filter(([id]) => q.ids.has(id) && fits(id, action) !== false)
    .map(([id, r]) => ({ ...r, label: hidden ? "A quality of the weapon" : r.label, quality: id, may: false }));
}

/** The creature's own ability item for a rider ("Paralysis (Su)", "Poison", "Energy Drain (Su)"). */
const abilityOf = (actor, key) => {
  const word = Object.keys(WORDS).find((w) => WORDS[w] === key);
  return actor.items.find((i) => i.type === "feat" && i.name.toLowerCase().replace(/\s*\(.*$/, "") === word) ?? null;
};

/** "DC = 10 + 1/2 racial HD + Con modifier", the universal monster rules' default. */
const defaultDC = (actor) => 10 + Math.floor((actor.system.attributes?.hd?.total ?? 0) / 2) + (actor.system.abilities?.con?.mod ?? 0);
const isGenericRule = (item) => /pf-universal-monster-rules|monster-abilities/.test(item?._stats?.compendiumSource ?? "");

/** The rider's numbers: DC, duration, bleed amount, negative levels, distance, constrict damage. */
function detailsOf(actor, key, detail) {
  const item = abilityOf(actor, key);
  const text = `${detail} ${item?.name ?? ""} ${plain(item?.system.description?.value)}`;
  const out = { key, label: key === "energyDrain" ? "Energy drain" : key.charAt(0).toUpperCase() + key.slice(1) };
  out.save = { paralysis: "fort", poison: "fort", disease: "fort", burn: "ref" }[key] ?? null;
  // The exact DC is in the creature's text; else its ability's own formula (unless it's the generic rule,
  // whose Paralysis formula uses Charisma against its text); else the rules' default
  const textDC = Number(text.match(/\bDC\s*(\d+)/)?.[1]);
  const action = item?.defaultAction ?? item?.actions?.contents?.[0];
  out.dc = textDC || (item && !isGenericRule(item) && action?.save?.type ? action.getDC?.() : null) || defaultDC(actor);
  out.duration = text.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\s+(round|minute|hour)s?/i)?.slice(1, 3) ?? null;
  if (key === "bleed") out.amount = detail.match(/\d+d\d+(?:\s*[+-]\s*\d+)?|\d+/)?.[0] ?? text.match(/bleed\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\)/i)?.[1] ?? text.match(/(\d+d\d+|\d+)\s+(?:points? of\s+)?bleed/i)?.[1] ?? null;
  if (key === "energyDrain") {
    const n = text.match(/\b(\d+|one|two|three|four|five|six)\s+negative levels?/i)?.[1]?.toLowerCase();
    out.count = Number(n) || NUMBERS[n] || 1;
  }
  if (key === "burn") out.formula = detail.match(new RegExp(DICE))?.[0] ?? text.match(new RegExp(`burn\\s*\\((${DICE})`, "i"))?.[1] ?? text.match(new RegExp(DICE))?.[0] ?? null;
  if (key === "pull" || key === "push") out.distance = Number(text.match(/(\d+)\s*(?:feet|ft)/i)?.[1]) || null;
  if (["poison", "disease"].includes(key)) out.effect = text.match(/effect\s+([^;.]+)/i)?.[1]?.trim() ?? null;
  return out;
}

/* -------------------------------------------- */
/*  Did the attack hit?                         */
/* -------------------------------------------- */

/**
 * Hit and confirmed critical against the target, as far as the card can tell: the attack total against
 * the target's AC (flat-footed when it is, plus the ward and creature AC bonuses on the card), natural 20
 * and 1, and the miss chances rolled. { known: false } without a target or a roll.
 */
export function hitOf(message, index, targetUuid) {
  const attack = message.systemRolls?.attacks?.[index];
  const token = fromUuidSync(targetUuid);
  const defender = token?.actor;
  if (!attack?.attack || !defender) return { known: false };
  const key = targetUuid.replaceAll(".", "_");
  const flatFooted = defender.statuses.has("flatFooted");
  const ac = defender.system.attributes.ac;
  const creature = message.getFlag(MODULE_ID, "creatureAC")?.[key];
  const total = (flatFooted ? ac.flatFooted.total : ac.normal.total) + (message.getFlag(MODULE_ID, "acBonus")?.[key]?.value ?? 0) + (creature?.all ?? 0) + (flatFooted ? 0 : creature?.dodge ?? 0);
  const beats = (r) => {
    const natural = r?.dice?.[0]?.total;
    return natural === 20 || (natural !== 1 && (r?.total ?? -Infinity) >= total);
  };
  const missed = (message.getFlag(MODULE_ID, "missChance")?.attacks?.[index] ?? []).some((l) => l.miss && (!l.target || l.target === token.name));
  const hit = beats(attack.attack) && !missed;
  return { known: true, hit, critical: hit && !!attack.critConfirm && beats(attack.critConfirm) };
}

/* -------------------------------------------- */
/*  Applying                                    */
/* -------------------------------------------- */

function immuneTo(target, rider) {
  const key = rider.key;
  const { types } = creatureTypes(target);
  const undeadOrConstruct = types.has("undead") || types.has("construct");
  const ci = target.getConditionImmunities?.() ?? new Set();
  const traitCi = target.system.traits?.ci?.total ?? new Set();
  const has = (id) => ci.has(id) || traitCi.has(id);
  if (key === "paralysis" && (undeadOrConstruct || has("paralyze") || has("paralyzed"))) return "immune to paralysis";
  if (key === "poison" && (undeadOrConstruct || has("poison"))) return "immune to poison";
  if (key === "disease" && (undeadOrConstruct || has("disease"))) return "immune to disease";
  if (key === "energyDrain" && (undeadOrConstruct || has("energyDrain"))) return "immune to energy drain";
  if (key === "bleed" && has("bleed")) return "immune to bleed";
  if (rider.critImmune && precisionImmune(target)) return "immune to critical hits, so to this bleed";
  if (key === "disruption" && !types.has("undead")) return "not undead: no effect";
  if (key === "deafen" && (has("deaf") || has("deafened"))) return "immune to deafness";
  const di = target.system.traits?.di;
  if (key === "burn" && (di?.total ?? di?.standard)?.has?.("fire")) return "immune to fire";
  return null;
}

/** Destroyed or killed: no hit points left and the Dead condition. Returns the undo. */
async function destroy(target) {
  const hpValue = target.system.attributes.hp.value;
  await target.update({ "system.attributes.hp.value": Math.min(hpValue, -Math.max(1, target.system.abilities?.con?.total ?? 0)) });
  if (!target.statuses.has("dead")) await target.setConditions({ dead: true });
  return { hpValue, conditions: ["dead"] };
}

/** Automatic riders: returns { text, undo }. */
async function applyAuto(rider, { attacker, target, targetUuid, critical, message }) {
  const immune = immuneTo(target, rider);
  if (immune) return { text: immune };
  const save = async (type) => {
    const result = await target.rollSavingThrow(type, { skipDialog: true, dc: rider.dc, reference: message.uuid });
    return saveResult(result, rider.dc).passed;
  };
  switch (rider.key) {
    case "paralysis": {
      if (await save("fort")) return { text: `saved (Fortitude DC ${rider.dc})` };
      if (!rider.duration) return { text: `failed (Fortitude DC ${rider.dc}): paralyzed; its entry gives no duration, so apply it by hand` };
      const [amount, unit] = rider.duration;
      const rounds = (await roll(amount)) * (unit.toLowerCase() === "minute" ? 10 : unit.toLowerCase() === "hour" ? 600 : 1);
      await target.setConditions({ paralyzed: { duration: timed(rounds) } });
      return { text: `failed (Fortitude DC ${rider.dc}): paralyzed ${rounds} round${rounds === 1 ? "" : "s"}`, undo: { conditions: ["paralyzed"] } };
    }
    case "attach": {
      if (!attacker.statuses.has("grappled")) await attacker.setConditions({ grappled: true });
      await recordGrapple(attacker, { target: targetUuid, attach: true });
      return { text: `${attacker.name} is attached (grappled; ${target.name} is not)`, undo: { attackerConditions: ["grappled"], grapple: true } };
    }
    case "burn": {
      if (!rider.formula) return { text: "burns (its entry gives no damage: apply it by hand)" };
      const total = await roll(rider.formula);
      const lost = await dealDamage(target, total, ["fire"]);
      if (await save("ref")) return { text: `${total} fire damage; saved (Reflex DC ${rider.dc})`, undo: { lost } };
      const rounds = await setBurning(target, { formula: rider.formula, dc: rider.dc, source: rider.reverse ? `touching ${attacker.name}` : attacker.name });
      return { text: `${total} fire damage; failed (Reflex DC ${rider.dc}): catches fire for ${rounds} round${rounds === 1 ? "" : "s"}`, undo: { lost, burning: true } };
    }
    case "bleed": {
      if (!rider.amount) return { text: "bleeds (its entry gives no amount: apply it by hand)" };
      const amount = await roll(rider.amount);
      return { text: await setBleed(target, amount, `${rider.label} (${attacker.name})`, { stack: !!rider.stack }), undo: { bleed: true } };
    }
    case "disruption": {
      if (await save("will")) return { text: `saved (Will DC ${rider.dc})` };
      return { text: `failed (Will DC ${rider.dc}): destroyed`, undo: await destroy(target) };
    }
    case "deafen": {
      if (await save("fort")) return { text: `saved (Fortitude DC ${rider.dc})` };
      await target.setConditions({ deaf: true });
      return { text: `failed (Fortitude DC ${rider.dc}): deafened permanently`, undo: { conditions: ["deaf"] } };
    }
    case "vorpal":
      return { text: "head severed: dead", undo: await destroy(target) };
    case "energyDrain": {
      const levels = rider.count * (critical ? 2 : 1);
      await target.update({ "system.attributes.energyDrain": (target.system.attributes.energyDrain ?? 0) + levels });
      const temp = 5 * levels;
      await attacker.update({ "system.attributes.hp.temp": (attacker.system.attributes.hp.temp ?? 0) + temp });
      return { text: `${levels} negative level${levels === 1 ? "" : "s"}${critical ? " (critical: doubled)" : ""}; ${attacker.name} gains ${temp} temporary hit points`, undo: { levels, temp } };
    }
    case "poison":
    case "disease": {
      if (await save("fort")) return { text: `saved (Fortitude DC ${rider.dc})` };
      return { text: `failed (Fortitude DC ${rider.dc})${rider.effect ? `: ${rider.effect}` : ""}; apply the ${rider.key} by hand` };
    }
  }
  return { text: "apply it by hand" };
}

/** The monster's choice: a combat maneuver against the target's CMD. Returns { text, undo, success }. */
async function applyManeuver(rider, { attacker, target, targetUuid, message, index, hold = false }) {
  const diff = sizeOf(target) - sizeOf(attacker);
  if (rider.key === "trip" ? diff > 1 : diff > 0) return { text: `no effect: ${target.name} is too big` };
  const bonus = (rider.key === "grab" ? 4 : 0) + (hold ? -20 : 0);
  const check = await maneuverCheck(attacker, target, bonus, `${rider.label}${hold ? " (hold, −20)" : ""}`);
  if (!check.success) return { text: `check ${check.total}: fails${rider.key === "trip" ? " (not tripped in return)" : ""}` };
  switch (rider.key) {
    case "grab": {
      const update = [target.setConditions({ grappled: true })];
      if (!hold && !attacker.statuses.has("grappled")) update.push(attacker.setConditions({ grappled: true }));
      await Promise.all(update);
      // The grapple on later rounds (monster-grapple.mjs): the grab attack's damage, and a bite can swallow
      const rolls = message.systemRolls?.attacks?.[index]?.damage ?? [];
      const attackName = message.getFlag(MODULE_ID, FLAG)?.attackName ?? "";
      await recordGrapple(attacker, {
        target: targetUuid,
        hold,
        attack: attackName,
        bite: /\bbite\b/i.test(attackName),
        formula: rolls.map((r) => `(${r.formula})`).join(" + ") || null,
        types: [...new Set(rolls.flatMap((r) => r.options?.damageType ?? []))],
      });
      return { text: `check ${check.total}: grabs ${target.name}${hold ? ` (held; ${attacker.name} isn't grappled)` : " (both grappled)"}`, undo: { conditions: ["grappled"], ...(hold ? {} : { attackerConditions: ["grappled"] }), grapple: true }, success: true };
    }
    case "trip":
      await target.setConditions({ prone: true });
      return { text: `check ${check.total}: ${target.name} is knocked prone`, undo: { conditions: ["prone"] }, success: true };
    default:
      return { text: `check ${check.total}: ${rider.key === "push" ? "pushes" : "pulls"} ${target.name}${rider.distance ? ` ${rider.distance} ft` : ""} (move the token)`, success: true };
  }
}

/** Constrict after a successful grab: its damage (or the attack's) as bludgeoning damage to the target. */
async function constrict(message, index, data, target) {
  const formula = data.constrict || message.systemRolls?.attacks?.[index]?.damage?.[0]?.formula;
  if (!formula) return "constrict: no damage given";
  const total = await roll(formula);
  await dealDamage(target, total, ["bludgeoning"]);
  return `constricts for ${total} bludgeoning damage`;
}

async function undo(entry, data, rider) {
  let target = fromUuidSync(data.target)?.actor;
  let attacker = fromUuidSync(data.attacker);
  if (rider?.reverse) [attacker, target] = [target, attacker];
  const u = entry.undo ?? {};
  if (attacker && u.grapple) await endGrapple(attacker);
  if (target && u.burning) await extinguish(target);
  if (target && u.lost) await restoreDamage(target, u.lost);
  if (target && u.hpValue !== undefined) await target.update({ "system.attributes.hp.value": u.hpValue });
  if (target && u.conditions?.length) await target.setConditions(Object.fromEntries(u.conditions.map((c) => [c, false])));
  if (attacker && u.attackerConditions?.length) await attacker.setConditions(Object.fromEntries(u.attackerConditions.map((c) => [c, false])));
  if (target && u.bleed) await stopBleed(target);
  if (target && u.levels) await target.update({ "system.attributes.energyDrain": Math.max(0, (target.system.attributes.energyDrain ?? 0) - u.levels) });
  if (attacker && u.temp) await attacker.update({ "system.attributes.hp.temp": Math.max(0, (attacker.system.attributes.hp.temp ?? 0) - u.temp) });
}

/**
 * Run one rider on attack `index` (the GM's client). `how`: "auto" (automatic, on a seen hit), "apply"
 * (automatic, by hand), "maneuver", "hold", "constrict" or "undo"; "rend" and "rendUndo" for the card's rend.
 */
export async function runRider(message, index, r, how) {
  if (how === "rend" || how === "rendUndo") return runRend(message, how === "rendUndo");
  const data = message.getFlag(MODULE_ID, FLAG);
  const rider = data?.riders?.[r];
  if (!rider) return null;
  const attacker = fromUuidSync(data.attacker);
  const target = fromUuidSync(data.target)?.actor ?? null;
  const path = `flags.${MODULE_ID}.${FLAG}.applied.${index}.${r}`;
  const current = data.applied?.[index]?.[r];
  let entry;
  if (how === "undo") {
    if (!current || current.undone) return null;
    await undo(current, data, rider);
    entry = { ...current, text: `${current.text} — undone`, undone: true, undo: null };
  } else if (how === "constrict") {
    if (!current?.success || current.constricted || !target) return null;
    entry = { ...current, constricted: await constrict(message, index, data, target) };
  } else {
    if (current) return null;
    if (!target || !attacker) entry = { text: "no target" };
    else if (rider.may) entry = await applyManeuver(rider, { attacker, target, targetUuid: data.target, message, index, hold: how === "hold" });
    else {
      const hit = hitOf(message, index, data.target);
      // A burning creature hit with a natural weapon: the attacker is the one burned
      const [by, on] = rider.reverse ? [target, attacker] : [attacker, target];
      entry = await applyAuto(rider, { attacker: by, target: on, targetUuid: data.target, critical: hit.critical, message });
    }
  }
  if (message.isOwner) await message.update({ [path]: entry });
  return entry;
}

/* -------------------------------------------- */
/*  The card                                    */
/* -------------------------------------------- */

const MAY = new Set(["grab", "trip", "pull", "push"]);
const MELEE = new Set(["mwak", "msak", "mcman"]);

/** Rend "(2 claws, 1d8+9)": how many hits, with which attack ("claw"; any natural attack if it doesn't say), and the extra damage. */
function rendOf(actor) {
  const r = specialAttack(actor, "rend");
  if (!r) return null;
  const m = r.detail.match(/^\s*(\d+|two|three|four)\s+([a-z ]+?)\s*,/i);
  const n = m?.[1]?.toLowerCase();
  return { count: Number(n) || NUMBERS[n] || 2, attack: m?.[2]?.trim().replace(/s$/i, "") || null, formula: r.detail.match(new RegExp(DICE, "g"))?.pop() ?? null, detail: r.detail };
}

/** Does the creature burn those who touch it ("Burn" ability, or "plus burn" on one of its attacks)? Its detail, else undefined. */
function burnsOnTouch(actor) {
  if (abilityOf(actor, "burn")) return "";
  for (const item of actor.items.filter((i) => i.type === "attack")) {
    const detail = ridersOf(item, item.defaultAction).get("burn");
    if (detail !== undefined) return detail;
  }
  return undefined;
}

Hooks.on("pf1PreDisplayActionUse", (use) => {
  const actor = use.actor;
  const item = use.item;
  if (!actor || !item || !["attack", "weapon"].includes(item.type) || !use.shared.chatAttacks?.length) return;
  const melee = MELEE.has(use.action?.actionType);
  const targetToken = use.shared.targets?.[0]?.document ?? null;
  const defender = targetToken?.actor ?? null;
  // Burn only "on a successful hit in melee"
  const riders = [...ridersOf(item, use.action)].map(([key, detail]) => ({ ...detailsOf(actor, key, detail), may: MAY.has(key) })).filter((r) => r.key !== "burn" || melee);
  riders.push(...weaponRiders(item, use.action));
  // "Creatures that hit a burning creature with natural weapons or unarmed attacks take fire damage as though hit by the burning creature"
  const bodily = item.system.subType === "natural" || /\bunarmed\b/i.test(item.name);
  const touchBurn = melee && bodily && defender && defender !== actor ? burnsOnTouch(defender) : undefined;
  if (touchBurn !== undefined) riders.push({ ...detailsOf(defender, "burn", touchBurn), label: `Burn (touching ${defender.name})`, reverse: true, may: false });
  const rend = rendOf(actor);
  const rendHere = rend && melee && item.system.subType === "natural" && (!rend.attack || new RegExp(rend.attack, "i").test(item.name)) ? rend : null;
  if (!riders.length && !rendHere) return;
  const constrict = constrictFormula(actor);
  use.shared.chatData[`flags.${MODULE_ID}.${FLAG}`] = {
    riders,
    attacker: actor.uuid,
    target: targetToken?.uuid ?? null,
    attackName: item.name,
    constrict: constrict || null,
    hasConstrict: constrict !== null,
    rend: rendHere,
    applied: {},
  };
});

/**
 * Rend: count the creature's hits on this target this round (on this card outside combat); once there are
 * enough, the card offers the extra damage, once a round.
 */
async function countRend(message, data) {
  const attacker = fromUuidSync(data.attacker);
  const hits = (message.systemRolls?.attacks ?? []).filter((_, i) => hitOf(message, i, data.target).hit).length;
  if (!attacker || !hits) return;
  const combat = game.combats.find((c) => c.started && c.getCombatantsByActor(attacker).length) ?? null;
  const round = combat ? `${combat.id}.${combat.round}` : `card.${message.id}`;
  const prev = attacker.getFlag(MODULE_ID, "rendHits");
  const same = prev?.round === round && prev.target === data.target;
  const record = { round, target: data.target, count: (same ? prev.count : 0) + hits, offered: same && prev.offered, used: same && prev.used };
  const ready = record.count >= data.rend.count && !record.offered;
  if (ready) record.offered = true;
  await attacker.setFlag(MODULE_ID, "rendHits", record);
  if (ready) await message.update({ [`flags.${MODULE_ID}.${FLAG}.rendReady`]: true });
}

/** The rend's extra damage (the GM's client), or its undo. */
async function runRend(message, undoIt = false) {
  const data = message.getFlag(MODULE_ID, FLAG);
  const attacker = fromUuidSync(data?.attacker);
  const target = fromUuidSync(data?.target)?.actor;
  if (!data?.rendReady || !attacker || !target) return null;
  const done = data.rendDone;
  const record = attacker.getFlag(MODULE_ID, "rendHits");
  let entry;
  if (undoIt) {
    if (!done?.undo) return null;
    await restoreDamage(target, done.undo.lost);
    if (record) await attacker.setFlag(MODULE_ID, "rendHits", { ...record, used: false });
    entry = { text: `${done.text} — undone` };
  } else {
    if (done) return null;
    if (record?.used) entry = { text: "already used this round (no more than once per round)" };
    else if (!data.rend.formula) entry = { text: "its entry gives no damage: roll it by hand" };
    else {
      const total = await roll(data.rend.formula);
      const types = [...new Set((message.systemRolls?.attacks ?? []).flatMap((a) => a.damage ?? []).flatMap((r) => r.options?.damageType ?? []))];
      const lost = await dealDamage(target, total, types);
      if (record) await attacker.setFlag(MODULE_ID, "rendHits", { ...record, used: true });
      entry = { text: `tears ${target.name} for ${total} damage`, undo: { lost } };
    }
  }
  if (message.isOwner) await message.update({ [`flags.${MODULE_ID}.${FLAG}.rendDone`]: entry });
  return entry;
}

// Automatic riders, as soon as the card exists and the hit is known (the active GM's client)
Hooks.on("createChatMessage", async (message) => {
  if (!isActiveGM()) return;
  const data = message.getFlag(MODULE_ID, FLAG);
  if (!data?.target) return;
  const attacks = message.systemRolls?.attacks ?? [];
  for (let i = 0; i < attacks.length; i++) {
    const hit = hitOf(message, i, data.target);
    if (!hit.known || !hit.hit) continue;
    if (fromUuidSync(data.target)?.actor?.statuses?.has("dead")) break; // destroyed or killed by an earlier hit
    for (const [r, rider] of data.riders.entries()) {
      if (rider.may || rider.gm || (rider.critOnly && !hit.critical)) continue;
      await runRider(message, i, r, "auto");
    }
    // Vorpal: tell the GM about a natural 20 that's confirmed
    const vorpal = data.riders.findIndex((r) => r.key === "vorpal");
    if (vorpal >= 0 && hit.critical && attacks[i]?.attack?.dice?.[0]?.total === 20) {
      await ChatMessage.implementation.create({ whisper: game.users.filter((u) => u.isGM).map((u) => u.id), content: `<p><strong>Vorpal:</strong> ${esc(fromUuidSync(data.attacker)?.name ?? "")} rolled a natural 20 and confirmed the critical hit on ${esc(fromUuidSync(data.target)?.name ?? "the target")}. Its head is severed if it has one: use <strong>Sever</strong> on the attack card.</p>` });
    }
  }
  if (data.rend) await countRend(message, data);
});

function button(label, tooltip, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.dataset.tooltip = tooltip;
  b.style.cssText = "width: auto; line-height: 1.4; margin: 2px 0.25em; padding: 0 6px;";
  b.addEventListener("click", (event) => {
    event.preventDefault();
    b.disabled = true;
    onClick();
  });
  return b;
}

/** Run it here (GM) or ask the GM's client (the creature's owner). */
const request = (message, index, r, how) =>
  game.user.isGM
    ? runRider(message, index, r, how)
    : ChatMessage.implementation.create({ whisper: game.users.filter((u) => u.isGM).map((u) => u.id), content: `<p>Applying a rider…</p>`, flags: { [MODULE_ID]: { naturalRider: { message: message.id, index, rider: r, how } } } });

Hooks.on("renderChatMessagePF", (message, html) => {
  const data = message.getFlag(MODULE_ID, FLAG);
  if (!data) return;
  const attacker = fromUuidSync(data.attacker);
  const canAct = game.user.isGM || !!attacker?.isOwner;
  const attacks = message.systemRolls?.attacks ?? [];
  if (data.riders?.length) attacks.forEach((attack, i) => {
    const el = html.querySelector(`.chat-attack[data-index="${i}"]`);
    if (!el || !attack?.attack) return;
    const div = document.createElement("div");
    div.className = `${MODULE_ID}-natural-riders`;
    div.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #a85;";
    div.innerHTML = "<strong>If it hits:</strong>";
    for (const [r, rider] of data.riders.entries()) {
      const done = data.applied?.[i]?.[r];
      const line = document.createElement("div");
      const how = rider.gm
        ? "on a natural 20 that's confirmed, the GM decides: most creatures die; not those without heads (oozes, many aberrations), golems, or undead other than vampires"
        : `${rider.critOnly ? "on a critical hit" : "automatic"}${rider.save ? `, ${SAVE_NAME[rider.save]} DC ${rider.dc}` : ""}`;
      line.innerHTML = `· <strong>${esc(rider.label)}</strong>${rider.may || done ? "" : ` <span style="opacity:0.7">(${how})</span>`}${done ? `: ${esc(done.text)}${done.constricted ? `; ${esc(done.constricted)}` : ""}` : ""}`;
      if (rider.gm) {
        if (game.user.isGM && !done && attack.attack?.dice?.[0]?.total === 20) line.append(button("Sever", "The head is severed: the creature dies", () => runRider(message, i, r, "apply")));
      } else if (canAct && !done) {
        // A miss the module can see: say so; the buttons stay for the GM's judgment
        const seen = hitOf(message, i, data.target);
        const missed = seen.known && !seen.hit;
        if (missed) line.insertAdjacentHTML("beforeend", ` <span style="opacity:0.7">— missed</span>`);
        if (rider.may) {
          line.append(button(rider.label, `${rider.label}: the creature's combat maneuver check against the target's CMD`, () => request(message, i, r, "maneuver")));
          if (rider.key === "grab") line.append(button("Hold (−20)", "Grab with the body part only: −20 on the check, and the creature isn't grappled itself", () => request(message, i, r, "hold")));
        } else line.append(button(missed ? "Apply anyway" : "Apply", missed ? "The module counts this attack as a miss; apply the rider anyway" : "The attack hit: apply it", () => request(message, i, r, "apply")));
      }
      if (game.user.isGM && done?.success && rider.key === "grab" && data.hasConstrict && !done.constricted) line.append(button("Constrict", `Constrict damage${data.constrict ? ` (${data.constrict})` : ""}`, () => runRider(message, i, r, "constrict")));
      if (game.user.isGM && done?.undo && !done.undone) line.append(button("Undo", "Remove what this did", () => runRider(message, i, r, "undo")));
      div.append(line);
    }
    const table = el.querySelector("table");
    table ? table.after(div) : el.append(div);
  });
  // Rend, once the hits are there: under the last attack
  if (data.rendReady) {
    const last = html.querySelectorAll(".chat-attack");
    const el = last[last.length - 1];
    if (!el) return;
    const div = document.createElement("div");
    div.className = `${MODULE_ID}-rend`;
    div.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #a85;";
    div.innerHTML = `<strong>Rend</strong> (${esc(data.rend.detail)})${data.rendDone ? `: ${esc(data.rendDone.text)}` : ": the hits are there"}`;
    if (canAct && !data.rendDone) div.append(button("Rend", `Extra damage${data.rend.formula ? ` (${data.rend.formula})` : ""}, no more than once per round`, () => request(message, -1, -1, "rend")));
    if (game.user.isGM && data.rendDone?.undo) div.append(button("Undo", "Remove the rend's damage", () => runRider(message, -1, -1, "rendUndo")));
    el.append(div);
  }
});

onGmRequest("naturalRider", async (request, { message, index, rider, how }) => {
  const card = game.messages.get(message);
  const attacker = fromUuidSync(card?.getFlag(MODULE_ID, FLAG)?.attacker);
  const gmOnly = !!card?.getFlag(MODULE_ID, FLAG)?.riders?.[rider]?.gm; // vorpal: the GM's decision
  if (card && !gmOnly && requestedByOwner(request, attacker) && ["apply", "maneuver", "hold", "rend"].includes(how)) await runRider(card, index, rider, how);
  await request.delete();
});

export const _test = { ridersOf, detailsOf, hitOf, runRider, rendOf, FLAG };
