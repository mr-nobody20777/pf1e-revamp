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
//       Constrict deals its damage on a successful grab.
// Rulings (DECISIONS.md, 2026-11-10): automatic riders are applied when the module can tell the attack hit
// (attack total against AC, natural 20 and 1, after miss chances), else they wait for an Apply button;
// the creature's own entry gives the numbers, and when PF1's data disagrees with the rules text the text
// wins (the universal Paralysis item's Charisma-based DC is computed from Constitution).

import { MODULE_ID } from "./const.mjs";
import { esc, isActiveGM, onGmRequest, requestedByOwner, saveResult, timed } from "./util.mjs";
import { creatureTypes } from "./creature-types.mjs";
import { setBleed, stopBleed } from "./bleed.mjs";

const FLAG = "naturalRiders";
const SAVE_NAME = { fort: "Fortitude", ref: "Reflex", will: "Will" };
const roll = async (formula) => (await new Roll(formula).evaluate()).total;
const WORDS = { "energy drain": "energyDrain", grab: "grab", trip: "trip", pull: "pull", push: "push", paralysis: "paralysis", poison: "poison", disease: "disease", bleed: "bleed", attach: "attach" };
const WORD_RE = new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\b`, "gi");
const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/* -------------------------------------------- */
/*  Reading the attack and the creature's entry */
/* -------------------------------------------- */

const plain = (html) => String(html ?? "").replace(/@Use\[([^;\]]+)[^\]]*\]/g, "$1").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

/** The rider keys an attack carries ("plus grab", "Bite (plus Grab)", "plus @Use[Poison]"), with any "(…)" detail. */
export function ridersOf(item, action) {
  const notes = [...(item.system.attackNotes ?? []), ...(item.system.effectNotes ?? []), ...(action?.notes?.effect ?? []), ...(action?.notes?.footer ?? [])].map((n) => plain(n?.text ?? n));
  // A clause runs to the end of the sentence: details in parentheses may hold ";" ("poison (Fort DC 13; effect …)")
  const clauses = [item.name, ...notes].flatMap((t) => [...t.matchAll(/\bplus\s+([^.]+)/gi)].map((m) => m[1]));
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

/** The creature's own ability item for a rider ("Paralysis (Su)", "Poison", "Energy Drain (Su)"). */
const abilityOf = (actor, key) => {
  const word = Object.keys(WORDS).find((w) => WORDS[w] === key);
  return actor.items.find((i) => i.type === "feat" && i.name.toLowerCase().replace(/\s*\(.*$/, "") === word) ?? null;
};
const constrictOf = (actor) => actor.items.find((i) => i.type === "feat" && /^constrict\b/i.test(i.name)) ?? null;

/** "DC = 10 + 1/2 racial HD + Con modifier", the universal monster rules' default. */
const defaultDC = (actor) => 10 + Math.floor((actor.system.attributes?.hd?.total ?? 0) / 2) + (actor.system.abilities?.con?.mod ?? 0);
const isGenericRule = (item) => /pf-universal-monster-rules|monster-abilities/.test(item?._stats?.compendiumSource ?? "");

/** The rider's numbers: DC, duration, bleed amount, negative levels, distance, constrict damage. */
function detailsOf(actor, key, detail) {
  const item = abilityOf(actor, key);
  const text = `${detail} ${plain(item?.system.description?.value)}`;
  const out = { key, label: key === "energyDrain" ? "Energy drain" : key.charAt(0).toUpperCase() + key.slice(1) };
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

const SIZES = () => Object.keys(pf1.config.sizeChart);
const sizeOf = (actor) => SIZES().indexOf(actor.system.traits?.size?.base ?? actor.system.traits?.size ?? "med");

function immuneTo(target, key) {
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
  return null;
}

/** Automatic riders: returns { text, undo }. */
async function applyAuto(rider, { attacker, target, critical, message }) {
  const immune = immuneTo(target, rider.key);
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
      return { text: `${attacker.name} is attached (grappled; ${target.name} is not)`, undo: { attackerConditions: ["grappled"] } };
    }
    case "bleed": {
      if (!rider.amount) return { text: "bleeds (its entry gives no amount: apply it by hand)" };
      const amount = await roll(rider.amount);
      return { text: await setBleed(target, amount, `${rider.label} (${attacker.name})`), undo: { bleed: true } };
    }
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
async function applyManeuver(rider, { attacker, target, message, hold = false }) {
  const diff = sizeOf(target) - sizeOf(attacker);
  if (rider.key === "trip" ? diff > 1 : diff > 0) return { text: `no effect: ${target.name} is too big` };
  const bonus = (rider.key === "grab" ? 4 : 0) + (hold ? -20 : 0);
  const cmd = target.system.attributes.cmd;
  const against = target.statuses.has("flatFooted") ? cmd.flatFootedTotal : cmd.total;
  const check = await new Roll(`1d20 + ${attacker.system.attributes.cmb.total}${bonus ? ` + ${bonus}` : ""}`).evaluate();
  const natural = check.dice[0]?.total;
  const success = natural === 20 || (natural !== 1 && check.total >= against);
  await check.toMessage({ speaker: ChatMessage.implementation.getSpeaker({ actor: attacker }), flavor: `${rider.label}${hold ? " (hold, −20)" : ""}: combat maneuver check — <strong>${success ? "succeeds" : "fails"}</strong>` });
  if (!success) return { text: `${check.total}: fails${rider.key === "trip" ? " (not tripped in return)" : ""}` };
  switch (rider.key) {
    case "grab": {
      const update = [target.setConditions({ grappled: true })];
      if (!hold && !attacker.statuses.has("grappled")) update.push(attacker.setConditions({ grappled: true }));
      await Promise.all(update);
      return { text: `${check.total}: grabs ${target.name}${hold ? ` (held; ${attacker.name} isn't grappled)` : " (both grappled)"}`, undo: { conditions: ["grappled"], ...(hold ? {} : { attackerConditions: ["grappled"] }) }, success: true };
    }
    case "trip":
      await target.setConditions({ prone: true });
      return { text: `${check.total}: ${target.name} is knocked prone`, undo: { conditions: ["prone"] }, success: true };
    default:
      return { text: `${check.total}: ${rider.key === "push" ? "pushes" : "pulls"} ${target.name}${rider.distance ? ` ${rider.distance} ft` : ""} (move the token)`, success: true };
  }
}

/** Constrict after a successful grab: its damage (or the attack's) as bludgeoning damage to the target. */
async function constrict(message, index, data, target) {
  const attacker = fromUuidSync(data.attacker);
  const formula = data.constrict ?? message.systemRolls?.attacks?.[index]?.damage?.[0]?.formula;
  if (!formula) return "constrict: no damage given";
  const total = await roll(formula);
  const instance = new pf1.models.action.DamagePartModel({ formula: "0", types: ["bludgeoning"] });
  await target.applyDamage(total, { instances: [instance], forceDialog: false });
  return `constricts for ${total} bludgeoning damage`;
}

async function undo(entry, data) {
  const target = fromUuidSync(data.target)?.actor;
  const attacker = fromUuidSync(data.attacker);
  const u = entry.undo ?? {};
  if (target && u.conditions?.length) await target.setConditions(Object.fromEntries(u.conditions.map((c) => [c, false])));
  if (attacker && u.attackerConditions?.length) await attacker.setConditions(Object.fromEntries(u.attackerConditions.map((c) => [c, false])));
  if (target && u.bleed) await stopBleed(target);
  if (target && u.levels) await target.update({ "system.attributes.energyDrain": Math.max(0, (target.system.attributes.energyDrain ?? 0) - u.levels) });
  if (attacker && u.temp) await attacker.update({ "system.attributes.hp.temp": Math.max(0, (attacker.system.attributes.hp.temp ?? 0) - u.temp) });
}

/**
 * Run one rider on attack `index` (the GM's client). `how`: "auto" (automatic, on a seen hit), "apply"
 * (automatic, by hand), "maneuver", "hold", "constrict" or "undo".
 */
export async function runRider(message, index, r, how) {
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
    await undo(current, data);
    entry = { ...current, text: `${current.text} — undone`, undone: true, undo: null };
  } else if (how === "constrict") {
    if (!current?.success || current.constricted || !target) return null;
    entry = { ...current, constricted: await constrict(message, index, data, target) };
  } else {
    if (current) return null;
    if (!target || !attacker) entry = { text: "no target" };
    else if (rider.may) entry = await applyManeuver(rider, { attacker, target, message, hold: how === "hold" });
    else {
      const hit = hitOf(message, index, data.target);
      entry = await applyAuto(rider, { attacker, target, critical: hit.critical, message });
    }
  }
  if (message.isOwner) await message.update({ [path]: entry });
  return entry;
}

/* -------------------------------------------- */
/*  The card                                    */
/* -------------------------------------------- */

const MAY = new Set(["grab", "trip", "pull", "push"]);

Hooks.on("pf1PreDisplayActionUse", (use) => {
  const actor = use.actor;
  const item = use.item;
  if (!actor || !item || !["attack", "weapon"].includes(item.type) || !use.shared.chatAttacks?.length) return;
  const found = ridersOf(item, use.action);
  if (!found.size) return;
  const riders = [...found].map(([key, detail]) => ({ ...detailsOf(actor, key, detail), may: MAY.has(key) }));
  const c = constrictOf(actor);
  const constrictDamage = c ? plain(c.system.description?.value).match(/constrict\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)/i)?.[1] ?? c.defaultAction?.damage?.parts?.[0]?.formula ?? null : null;
  use.shared.chatData[`flags.${MODULE_ID}.${FLAG}`] = {
    riders,
    attacker: actor.uuid,
    target: use.shared.targets?.[0]?.document?.uuid ?? null,
    constrict: c ? constrictDamage : null,
    hasConstrict: !!c,
    applied: {},
  };
});

// Automatic riders, as soon as the card exists and the hit is known (the active GM's client)
Hooks.on("createChatMessage", async (message) => {
  if (!isActiveGM()) return;
  const data = message.getFlag(MODULE_ID, FLAG);
  if (!data?.target) return;
  const attacks = message.systemRolls?.attacks ?? [];
  for (let i = 0; i < attacks.length; i++) {
    const hit = hitOf(message, i, data.target);
    if (!hit.known || !hit.hit) continue;
    for (const [r, rider] of data.riders.entries()) if (!rider.may) await runRider(message, i, r, "auto");
  }
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
  if (!data?.riders?.length) return;
  const attacker = fromUuidSync(data.attacker);
  const canAct = game.user.isGM || !!attacker?.isOwner;
  (message.systemRolls?.attacks ?? []).forEach((attack, i) => {
    const el = html.querySelector(`.chat-attack[data-index="${i}"]`);
    if (!el || !attack?.attack) return;
    const div = document.createElement("div");
    div.className = `${MODULE_ID}-natural-riders`;
    div.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #a85;";
    div.innerHTML = "<strong>If it hits:</strong>";
    for (const [r, rider] of data.riders.entries()) {
      const done = data.applied?.[i]?.[r];
      const line = document.createElement("div");
      line.innerHTML = `· <strong>${esc(rider.label)}</strong>${rider.may || done ? "" : ` <span style="opacity:0.7">(automatic${["paralysis", "poison", "disease"].includes(rider.key) ? `, Fortitude DC ${rider.dc}` : ""})</span>`}${done ? `: ${esc(done.text)}${done.constricted ? `; ${esc(done.constricted)}` : ""}` : ""}`;
      if (canAct && !done) {
        if (rider.may) {
          line.append(button(rider.label, `${rider.label}: the creature's combat maneuver check against the target's CMD`, () => request(message, i, r, "maneuver")));
          if (rider.key === "grab") line.append(button("Hold (−20)", "Grab with the body part only: −20 on the check, and the creature isn't grappled itself", () => request(message, i, r, "hold")));
        } else line.append(button("Apply", "The attack hit: apply it", () => request(message, i, r, "apply")));
      }
      if (game.user.isGM && done?.success && rider.key === "grab" && data.hasConstrict && !done.constricted) line.append(button("Constrict", `Constrict damage${data.constrict ? ` (${data.constrict})` : ""}`, () => runRider(message, i, r, "constrict")));
      if (game.user.isGM && done?.undo && !done.undone) line.append(button("Undo", "Remove what this did", () => runRider(message, i, r, "undo")));
      div.append(line);
    }
    const table = el.querySelector("table");
    table ? table.after(div) : el.append(div);
  });
});

onGmRequest("naturalRider", async (request, { message, index, rider, how }) => {
  const card = game.messages.get(message);
  const attacker = fromUuidSync(card?.getFlag(MODULE_ID, FLAG)?.attacker);
  if (card && requestedByOwner(request, attacker) && ["apply", "maneuver", "hold"].includes(how)) await runRider(card, index, rider, how);
  await request.delete();
});

export const _test = { ridersOf, detailsOf, hitOf, runRider, FLAG };
