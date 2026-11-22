// Afflictions (poison, disease, curse), phase 1. PF1 tracks none of them: a monster's "plus poison" only
// rolled its first save. A contracted affliction is a buff on the victim ("Poison: Viper Venom") holding its
// schedule; its periodic saves come due by game time (and, for "/round" ones in combat, at the start of the
// victim's turn), and each failed save applies its effect. Rules map: afflictions area; verbatim rules in
// Rules Text/monster-rules/afflictions.txt. Rulings: DECISIONS.md, "Afflictions".
//
// Rules (Core Rulebook, Afflictions; verbatim where quoted):
//   - "All afflictions grant a saving throw when they are contracted. If successful, the creature does not
//     suffer from the affliction and does not need to make any further rolls."
//   - Onset: "Failure means that the creature has contracted the affliction and must begin making
//     additional saves after the onset period has elapsed. The affliction's effect does not occur until
//     after the onset period has elapsed and then only if further saving throws are failed."
//   - Frequency: "how often the periodic saving throw must be attempted after the affliction has been
//     contracted ... a poison with a frequency of '1/round for 6 rounds' ends after 6 rounds have passed.
//     Afflictions without a frequency occur only once, immediately upon contraction (or after the onset time
//     if one is listed)." Without an onset, the failed contraction save is the first failed save (its
//     effect applies at once) and counts as the first of the frequency's saves.
//   - Effect: "the effect that the character suffers each time if he fails his saving throw ... These
//     afflictions have an initial effect, which occurs when the first save is failed, and a secondary
//     effect, when additional saves are failed."
//   - Cure: "a number of saving throws that must be made consecutively ... Afflictions without a cure entry
//     can only be cured through powerful spells." Damage taken stays.
//   - Poison doses: "if there is still poison active in you when you are attacked with that type of poison
//     again, and you fail your initial save against the new dose, the doses stack": +2 DC and "1/2 the amount
//     listed in its frequency entry" more duration, cumulative; one save at the higher DC.
//   - Undead and constructs are immune to poison and disease.
// Rulings (2026-11-17): the owner rolls each periodic save from a card (creatures no player owns: the GM's
// client rolls them); a "/round" affliction outside combat offers "Resolve all"; effects are applied
// automatically, with an Undo.
//
// Phase 2 (verbatim rules in the same file):
//   - Cure spells: "a caster level check (1d20 + caster level) against the DC of each poison [disease, curse]
//     affecting the target. Success means that the poison is neutralized ... the spell does not reverse
//     instantaneous effects, such as hit point damage, temporary ability damage".
//   - Delay poison: "Any poison in its system or any poison to which it is exposed during the spell's duration
//     does not affect the subject until the spell's duration has expired": poison saves and effects wait.
//   - Pernicious poison: "-4 penalty on saves against poison, and poisons affecting the target continue for
//     another 2 frequency increments ... Attempts to cure the poisoned target with skill or magic take a -4".
//   - Treat poison / disease (Heal): "Every time the poisoned character makes a saving throw against the
//     poison, you make a Heal check. If your Heal check exceeds the DC of the poison, the character receives a
//     +4 competence bonus on his saving throw". Ruling: the healer is chosen once and checks every save until
//     they stop.
//   - "Hit point and ability score damage caused by an affliction cannot be healed naturally while the
//     affliction persists": PF1's rest leaves that damage (ruling: put back, with a note).

import { MODULE_ID } from "./const.mjs";
import { esc, isActiveGM, onGmRequest, requestedByOwner, saveResult, rollTotal, ownerWhisper, timed, plainText, applyCondition, rollSaveAgainst, activeBuff, gmWhisper, turnActors } from "./util.mjs";
import { registerFootnote, footnoteButton } from "./footnote.mjs";
import { creatureTypes } from "./creature-types.mjs";

export const FLAG = "affliction"; // buff flag: the affliction's state (below)
const CARD = "afflictionCard"; // chat message flag: { buff (uuid), count, resolveAll }
const RESULT = "afflictionResult"; // chat message flag: { actor (uuid), undo: [...] }

const UNIT_SECONDS = { round: 6, minute: 60, hour: 3600, day: 86400, week: 604800 };
const ABILITIES = { str: "str", strength: "str", dex: "dex", dexterity: "dex", con: "con", constitution: "con", int: "int", intelligence: "int", wis: "wis", wisdom: "wis", cha: "cha", charisma: "cha" };
const CONDITIONS = { daze: "dazed", dazed: "dazed", sickened: "sickened", nauseated: "nauseated", fatigued: "fatigued", exhausted: "exhausted", staggered: "staggered", confused: "confused", paralyzed: "paralyzed", unconscious: "unconscious", blinded: "blind", blind: "blind", deafened: "deaf", deaf: "deaf", stunned: "stunned", shaken: "shaken", frightened: "frightened", entangled: "entangled", dazzled: "dazzled", prone: "prone", slowed: "slowed" };
const SAVES = { fort: "fort", fortitude: "fort", ref: "ref", reflex: "ref", will: "will" };
const DICE = "\\d+d\\d+(?:\\s*[+-]\\s*\\d+)?|\\d+";
const unitOf = (w) => w.toLowerCase().replace(/s$/, "");
const hasBuff = (actor, re) => !!activeBuff(actor, re);
/** Delay poison: poisons wait. */
export const delayed = (actor, kind) => kind === "poison" && hasBuff(actor, /^delay poison\b/i);
/** Pernicious poison: −4 on saves against poison and on attempts to cure it. */
const pernicious = (actor, kind) => kind === "poison" && hasBuff(actor, /^pernicious poison\b/i);

async function rollSave(actor, data, dc, reference, extra = []) {
  const bonus = [...extra, ...(pernicious(actor, data.kind) ? ["-4[Pernicious Poison]"] : [])].join(" + ") || undefined;
  return rollSaveAgainst(actor, data.save, [data.kind], { dc, reference, bonus });
}

/** Treat poison / disease: the healer's Heal check against the DC; +4 competence on the save when it beats it. */
async function treatment(actor, data) {
  const healer = data.treatedBy ? fromUuidSync(data.treatedBy) : null;
  if (!healer || !["poison", "disease"].includes(data.kind)) return { bonus: [], text: "" };
  const penalty = pernicious(actor, data.kind) ? " - 4[Pernicious Poison]" : "";
  const check = await healer.rollSkill("hea", { skipDialog: true, bonus: penalty || undefined });
  const total = check?.rolls?.[0]?.total ?? check?.total;
  const beats = Number.isFinite(total) && total > data.dc;
  return { bonus: beats ? ["4[Treat " + titleCase(data.kind) + "]"] : [], text: `${healer.name}'s Heal ${total ?? "?"}${beats ? " (+4)" : ""}` };
}

/* -------------------------------------------- */
/*  Reading an affliction                       */
/* -------------------------------------------- */

/**
 * An affliction's entry, from either form: "Bite—injury; save Fort DC 9; frequency 1/round for 6 rounds;
 * effect 1d2 Con; cure 1 save" or "Type poison (injury); Save Fortitude DC 14 Frequency 1/round for 2 rounds
 * Initial Effect 1 Con; Secondary Effect unconscious 1d3 hours Cure 1 save". Null when it has no save DC.
 */
export function parseAffliction(text, { name = "", kind = null } = {}) {
  const t = plainText(String(text ?? "")).replace(/[–—]/g, "-").replace(/\s+/g, " ");
  // "save Fort DC 13", "Save Fortitude DC 14", "save DC 12", or the short "Fort DC 13"
  const save = t.match(/\b(?:save\s+)?(Fort(?:itude)?|Ref(?:lex)?|Will)\s+DC\s*(\d+)/i) ?? t.match(/\bsave\s+()DC\s*(\d+)/i);
  if (!save) return null;
  kind ??= (t.match(/\btype\s+(poison|disease|curse)\b/i)?.[1] ?? name.match(/\b(poison|disease|curse|venom)\b/i)?.[1] ?? "poison").toLowerCase().replace("venom", "poison");
  const out = { name: name || kind, kind, save: SAVES[(save[1] ?? "").toLowerCase()] ?? (kind === "curse" ? "will" : "fort"), dc: Number(save[2]) };
  out.delivery = t.match(/\b(injury|contact|ingested|inhaled|ingestion|inhalation)\b/i)?.[1]?.toLowerCase() ?? null;
  const onset = t.match(new RegExp(`\\bonset\\s+(${DICE})\\s+(round|minute|hour|day|week)s?`, "i"));
  if (onset) out.onset = { amount: onset[1], unit: unitOf(onset[2]) };
  const freq = t.match(new RegExp(`\\bfrequency\\s+(\\d+)\\s*\\/\\s*(round|minute|hour|day|week)(?:\\s+for\\s+(${DICE})\\s+(round|minute|hour|day|week)s?)?`, "i"));
  if (freq) {
    out.frequency = { per: Number(freq[1]) || 1, unit: unitOf(freq[2]) };
    if (freq[3]) out.frequency.for = { amount: freq[3], unit: unitOf(freq[4]) };
  }
  const cut = (s) => s?.replace(/\s*;?\s*\b(?:cure|secondary effect)\b.*$/i, "").replace(/[;.]\s*$/, "").trim() || null;
  const initial = t.match(/\binitial effect\s+(.+?)(?=;?\s*secondary effect\b)/i)?.[1];
  const secondary = t.match(/\bsecondary effect\s+(.+?)(?=;?\s*\bcure\b|$)/i)?.[1];
  if (initial) Object.assign(out, { initial: cut(initial), secondary: cut(secondary) });
  else out.effect = cut(t.match(/\beffect\s+(.+?)(?=;?\s*\bcure\b|$)/i)?.[1]);
  const cure = t.match(/\bcure\s+(\d+|one|two|three)\s+(?:consecutive\s+)?saves?/i);
  out.cure = cure ? Number(cure[1]) || { one: 1, two: 2, three: 3 }[cure[1].toLowerCase()] : null; // null: magic only
  return out;
}

/** The effects in an affliction's effect text: { abilities: [{ ability, formula, drain }], conditions: [{ id, duration }], damage, rest }. */
export function parseEffect(text) {
  let rest = ` ${text ?? ""} `;
  const abilities = [];
  const abil = "(str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma)";
  rest = rest.replace(new RegExp(`(${DICE})\\s+${abil}\\b(?:\\s*(?:and|,)\\s*${abil}\\b)?(?:\\s+(damage|drain))?`, "gi"), (m, formula, a, b, kind) => {
    for (const w of [a, b].filter(Boolean)) abilities.push({ ability: ABILITIES[w.toLowerCase()], formula: formula.replace(/\s+/g, ""), drain: /drain/i.test(kind ?? "") });
    return " ";
  });
  const conditions = [];
  rest = rest.replace(new RegExp(`\\b(${Object.keys(CONDITIONS).join("|")})\\b(?:\\s+(?:for\\s+)?(${DICE})\\s+(round|minute|hour|day)s?)?`, "gi"), (m, word, amount, unit) => {
    conditions.push({ id: CONDITIONS[word.toLowerCase()], duration: amount ? { amount, unit: unitOf(unit) } : null });
    return " ";
  });
  let damage = null;
  rest = rest.replace(new RegExp(`(${DICE})\\s+(?:points?\\s+of\\s+)?(nonlethal\\s+)?(?:hit point\\s+)?damage\\b`, "i"), (m, formula, nonlethal) => {
    damage = { formula: formula.replace(/\s+/g, ""), nonlethal: !!nonlethal };
    return " ";
  });
  rest = rest.replace(/\b(and|target is|the target is|is|for|plus|,|;)\b/gi, " ").replace(/[,;.]/g, " ").replace(/\s+/g, " ").trim();
  return { abilities, conditions, damage, rest };
}

/* -------------------------------------------- */
/*  Effects                                     */
/* -------------------------------------------- */

const roundsOf = async ({ amount, unit }) => (await rollTotal(amount)) * Math.round((UNIT_SECONDS[unit] ?? 6) / 6);

/** Apply an effect text to the actor. Returns { text, undo, held } (held: conditions kept while the affliction lasts). */
/** Add an effect's damage to the affliction's record of what it dealt. */
function recordDealt(data, undo) {
  data.dealt ??= {};
  // By ability ("con"), not by path: a dotted key would be expanded when the flag is saved
  for (const a of undo?.abilities ?? []) if (a.key.endsWith(".damage")) data.dealt[a.key.split(".")[2]] = (data.dealt[a.key.split(".")[2]] ?? 0) + a.amount;
  if (undo?.damage) data.dealt.hp = (data.dealt.hp ?? 0) + undo.damage;
}

async function applyEffect(actor, text) {
  const e = parseEffect(text);
  const parts = [];
  const undo = { abilities: [], conditions: [], damage: 0 };
  const held = [];
  const update = {};
  for (const a of e.abilities) {
    const amount = await rollTotal(a.formula);
    const key = `system.abilities.${a.ability}.${a.drain ? "drain" : "damage"}`;
    update[key] = (update[key] ?? foundry.utils.getProperty(actor, key) ?? 0) + amount;
    undo.abilities.push({ key, amount });
    parts.push(`${amount} ${a.ability.toUpperCase()} ${a.drain ? "drain" : "damage"}`);
  }
  if (Object.keys(update).length) await actor.update(update);
  for (const c of e.conditions) {
    if (!pf1.registry.conditions.get(c.id)) continue;
    if (c.duration) {
      parts.push(await applyCondition(actor, c.id, await roundsOf(c.duration)));
    } else {
      await actor.setConditions({ [c.id]: true });
      held.push(c.id);
      parts.push(`${c.id} (while it lasts)`);
    }
    undo.conditions.push(c.id);
  }
  if (e.damage) {
    const total = await rollTotal(e.damage.formula);
    const hp = actor.system.attributes.hp;
    if (e.damage.nonlethal) await actor.update({ "system.attributes.hp.nonlethal": (hp.nonlethal ?? 0) + total });
    else await actor.applyDamage(total, { forceDialog: false });
    undo.damage = e.damage.nonlethal ? 0 : total;
    undo.nonlethal = e.damage.nonlethal ? total : 0;
    parts.push(`${total}${e.damage.nonlethal ? " nonlethal" : ""} damage`);
  }
  if (e.rest) parts.push(`apply by hand: ${e.rest}`);
  return { text: parts.join(", ") || "no effect read", undo, held };
}

async function undoEffect(actor, undo) {
  if (!actor || !undo) return;
  const update = {};
  for (const a of undo.abilities ?? []) update[a.key] = Math.max(0, (update[a.key] ?? foundry.utils.getProperty(actor, a.key) ?? 0) - a.amount);
  if (undo.nonlethal) update["system.attributes.hp.nonlethal"] = Math.max(0, (actor.system.attributes.hp.nonlethal ?? 0) - undo.nonlethal);
  if (Object.keys(update).length) await actor.update(update);
  if (undo.conditions?.length) await actor.setConditions(Object.fromEntries(undo.conditions.map((c) => [c, false])));
  if (undo.damage) await actor.applyDamage(-undo.damage, { forceDialog: false });
}

/* -------------------------------------------- */
/*  Contracting                                 */
/* -------------------------------------------- */

const LABEL = { poison: "Poison", disease: "Disease", curse: "Curse" };
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
/** The creature's afflictions (active buffs with the flag). */
export const afflictionsOf = (actor) => (actor?.itemTypes?.buff ?? []).filter((b) => b.flags?.[MODULE_ID]?.[FLAG]);

/** Why the creature can't contract it, or null. */
export function immunity(actor, kind) {
  if (kind === "curse") return null;
  const { types } = creatureTypes(actor);
  if (types.has("undead") || types.has("construct")) return `immune to ${kind} (${types.has("undead") ? "undead" : "construct"})`;
  const ci = actor.system.traits?.ci?.total ?? new Set();
  return ci.has?.(kind) ? `immune to ${kind}` : null;
}

/** Saves left in a limited frequency ("for 6 rounds" at 1/round: 6), or null (until cured). */
async function savesFor(frequency) {
  if (!frequency?.for) return null;
  const span = (await rollTotal(frequency.for.amount)) * (UNIT_SECONDS[frequency.for.unit] ?? 6);
  return Math.max(1, Math.floor(span / ((UNIT_SECONDS[frequency.unit] ?? 6) / frequency.per)));
}
const periodOf = (f) => (f ? (UNIT_SECONDS[f.unit] ?? 6) / (f.per || 1) : null);

/**
 * Expose a creature to an affliction: its contraction save (unless `failed` is given), then the buff that
 * tracks it. Returns { text, undo } for the card that caused it.
 */
export async function contract(target, spec, { source = null, reference = null, failed = null } = {}) {
  const immune = immunity(target, spec.kind);
  if (immune) return { text: immune };
  const existing = spec.kind === "poison" ? afflictionsOf(target).find((b) => b.flags[MODULE_ID][FLAG].name === spec.name) : null;
  const dc = spec.dc + (existing ? 2 * (existing.flags[MODULE_ID][FLAG].doses ?? 1) : 0);
  let passed = failed === null ? null : !failed;
  if (passed === null) {
    const result = await rollSave(target, spec, dc, reference);
    passed = saveResult(result, dc).passed;
  }
  const saveText = `${titleCase(spec.save === "fort" ? "Fortitude" : spec.save === "ref" ? "Reflex" : "Will")} DC ${dc}`;
  if (passed) return { text: `saved (${saveText})` };

  // Another dose of an active poison: +2 DC and half its frequency's duration more
  if (existing) {
    const data = existing.flags[MODULE_ID][FLAG];
    const extra = data.total ? Math.floor(data.total / 2) : 0;
    const update = { doses: (data.doses ?? 1) + 1, dc: data.dc + 2, ...(data.remaining !== null ? { remaining: data.remaining + extra, total: data.total + extra } : {}) };
    await existing.update({ [`flags.${MODULE_ID}.${FLAG}`]: update });
    return { text: `failed (${saveText}): another dose of ${spec.name}: DC ${update.dc}${extra ? `, ${extra} more saves` : ""}`, undo: { dose: existing.uuid, before: data } };
  }

  const now = game.time.worldTime;
  let total = await savesFor(spec.frequency);
  if (total !== null && pernicious(target, spec.kind)) total += 2; // "another 2 frequency increments"
  const onsetSeconds = spec.onset ? (await rollTotal(spec.onset.amount)) * (UNIT_SECONDS[spec.onset.unit] ?? 6) : 0;
  const data = {
    name: spec.name, kind: spec.kind, save: spec.save, dc: spec.dc, doses: 1, source,
    frequency: spec.frequency ?? null, period: periodOf(spec.frequency),
    effect: spec.effect ?? null, initial: spec.initial ?? null, secondary: spec.secondary ?? null,
    cure: spec.cure, streak: 0, failures: 0, total, remaining: total, held: [],
    dueAt: now + (onsetSeconds || periodOf(spec.frequency) || 0),
  };
  let text = `failed (${saveText}): ${spec.name} contracted`;
  let applied = null;
  // Delay poison: nothing happens until it ends (the first effect waits, then the schedule runs)
  if (delayed(target, spec.kind)) {
    data.firstWaiting = !onsetSeconds;
    data.dueAt = now;
    text += "; delay poison holds it off until the spell ends";
  }
  // No onset: the failed contraction save is the first failed save, and its effect applies now
  else if (!onsetSeconds) {
    data.failures = 1;
    applied = await applyEffect(target, data.initial ?? data.effect);
    data.held = applied.held;
    recordDealt(data, applied.undo);
    if (data.remaining !== null) data.remaining -= 1;
    text += `: ${applied.text}`;
  } else text += `; onset ${Math.round(onsetSeconds / 6)} rounds of game time`;
  // Nothing more to come (no frequency, or its last save already made)
  if (!data.firstWaiting && ((!spec.frequency && !onsetSeconds) || data.remaining === 0)) return { text, undo: { effect: applied?.undo } };
  const [buff] = await target.createEmbeddedDocuments("Item", [{
    name: `${LABEL[spec.kind] ?? "Affliction"}: ${spec.name}`, type: "buff", img: "icons/svg/poison.svg",
    system: { subType: "temp", active: true },
    flags: { [MODULE_ID]: { [FLAG]: data } },
  }]);
  await checkDue(target, buff);
  return { text, undo: { buff: buff.uuid, effect: applied?.undo } };
}

/** Undo a contraction (from the card that caused it). */
export async function undoContract(target, undo) {
  if (!undo) return;
  if (undo.dose) {
    const buff = fromUuidSync(undo.dose);
    if (buff) await buff.update({ [`flags.${MODULE_ID}.${FLAG}`]: undo.before });
    return;
  }
  const buff = undo.buff ? fromUuidSync(undo.buff) : null;
  if (buff) await buff.delete();
  await undoEffect(target, undo.effect);
}

/* -------------------------------------------- */
/*  Periodic saves                              */
/* -------------------------------------------- */

/** Is the creature in a started combat (any of them: the one viewed isn't always its own)? */
const inCombat = (actor) => game.combats.some((combat) => combat.started && combat.combatants.some((c) => c.actor === actor || (c.token?.actorLink && c.actorId === actor.id)));
/** Owned by a player (not only the GM)? Then that player rolls. */
const playerOwned = (actor) => game.users.some((u) => !u.isGM && actor.testUserPermission(u, "OWNER"));

/** How many saves are due now (game time), for an affliction not waiting on a card. */
function dueCount(data) {
  const now = game.time.worldTime;
  if (now < data.dueAt) return 0;
  const n = data.period ? Math.floor((now - data.dueAt) / data.period) + 1 : 1;
  return data.remaining === null ? n : Math.min(n, data.remaining);
}

/**
 * Offer (or roll) the saves that are due. "/round" afflictions in combat come due at the start of the
 * creature's turn (one a round); out of combat they're offered all at once.
 */
async function checkDue(actor, buff, { turnStart = false } = {}) {
  const data = buff.flags[MODULE_ID]?.[FLAG];
  if (!data || data.pending) return;
  if (delayed(actor, data.kind)) return; // delay poison: its time is pushed back as game time passes (below)
  const rounds = data.frequency?.unit === "round";
  if (rounds && inCombat(actor) && !turnStart) return;
  let count = rounds && !inCombat(actor) ? data.remaining ?? 1 : dueCount(data);
  if (turnStart) count = game.time.worldTime >= data.dueAt - 0.5 ? 1 : 0;
  if (data.firstWaiting) count = Math.max(count, 1);
  if (!count) return;
  const resolveAll = rounds && !inCombat(actor);
  if (!playerOwned(actor)) return resolve(buff, count);
  await buff.update({ [`flags.${MODULE_ID}.${FLAG}.pending`]: true });
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: ownerWhisper(actor),
    content: `<div class="${MODULE_ID}-affliction"><p><strong>${esc(actor.name)}</strong>: ${esc(data.name)} (${esc(data.kind)}). ${count > 1 ? `${count} saves are due` : "A save is due"}: ${saveName(data.save)} DC ${data.dc}${data.cure ? `; ${data.cure} in a row cure it (${data.streak} so far)` : ""}.</p>
      <button type="button" data-action="${MODULE_ID}-afflict-save">${resolveAll ? `Resolve all (${count} saves)` : count > 1 ? `Roll ${count} saves` : `Roll ${saveName(data.save)}`}</button></div>`,
    flags: { [MODULE_ID]: { [CARD]: { buff: buff.uuid, count, kind: data.kind } } },
  });
}
const saveName = (s) => ({ fort: "Fortitude", ref: "Reflex", will: "Will" })[s] ?? s;

/** Roll `count` periodic saves, apply each failure's effect, and end the affliction when it's cured or done. */
async function resolve(buff, count, reference = null) {
  const actor = buff.actor;
  const data = foundry.utils.deepClone(buff.flags[MODULE_ID][FLAG]);
  const lines = [];
  const undo = [];
  let ended = null;
  // Held off by delay poison: the failed contraction save's effect comes first, without a save
  if (data.firstWaiting) {
    data.firstWaiting = false;
    data.failures = 1;
    const applied = await applyEffect(actor, data.initial ?? data.effect);
    data.held = [...new Set([...(data.held ?? []), ...applied.held])];
    recordDealt(data, applied.undo);
    undo.push(applied.undo);
    lines.push(`the delayed effect: ${applied.text}`);
    if (data.remaining !== null) data.remaining -= 1;
    if (data.remaining !== null && data.remaining <= 0) ended = "it has run its course";
    count -= 1;
  }
  for (let i = 0; i < count && !ended; i++) {
    const treat = await treatment(actor, data);
    const result = await rollSave(actor, data, data.dc, reference, treat.bonus);
    const passed = saveResult(result, data.dc).passed;
    if (treat.text) lines.push(treat.text);
    if (passed) {
      data.streak += 1;
      lines.push(`saved (${result?.rolls?.[0]?.total ?? "?"})`);
      if (data.cure && data.streak >= data.cure) ended = `cured (${data.cure} save${data.cure === 1 ? "" : "s"} in a row)`;
    } else {
      data.streak = 0;
      data.failures += 1;
      const text = data.initial ? (data.failures === 1 ? data.initial : data.secondary ?? data.initial) : data.effect;
      const applied = await applyEffect(actor, text);
      data.held = [...new Set([...(data.held ?? []), ...applied.held])];
      recordDealt(data, applied.undo);
      undo.push(applied.undo);
      lines.push(`failed (${result?.rolls?.[0]?.total ?? "?"}): ${applied.text}`);
    }
    if (data.remaining !== null) {
      data.remaining -= 1;
      if (data.remaining <= 0 && !ended) ended = "it has run its course";
    }
    data.dueAt += data.period ?? 0;
  }
  data.pending = false;
  if (ended) await endAffliction(buff, data);
  else await buff.update({ [`flags.${MODULE_ID}.${FLAG}`]: data });
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: ownerWhisper(actor),
    content: `<p><strong>${esc(actor.name)}</strong>, ${esc(data.name)} (${saveName(data.save)} DC ${data.dc}): ${lines.map(esc).join("; ")}.${ended ? ` <strong>${esc(ended.charAt(0).toUpperCase() + ended.slice(1))}.</strong>` : data.remaining !== null ? ` ${data.remaining} save${data.remaining === 1 ? "" : "s"} left.` : ""}</p>${undo.some((u) => u && (u.abilities?.length || u.conditions?.length || u.damage || u.nonlethal)) ? `<button type="button" data-action="${MODULE_ID}-afflict-undo">Undo the effects</button>` : ""}`,
    flags: { [MODULE_ID]: { [RESULT]: { actor: actor.uuid, undo } } },
  });
}

/** End it: the buff goes, and conditions it held (with no duration of their own) with it. */
async function endAffliction(buff, data = buff.flags[MODULE_ID][FLAG]) {
  const actor = buff.actor;
  const held = (data.held ?? []).filter((id) => actor.statuses.has(id));
  if (held.length) await actor.setConditions(Object.fromEntries(held.map((id) => [id, false])));
  await buff.delete();
}

// "/round" afflictions in combat: at the start of the creature's turn, once a round
Hooks.on("updateCombat", async (combat, changes, options) => {
  if (!isActiveGM() || !("turn" in changes || "round" in changes) || options.direction === -1) return;
  for (const actor of turnActors(combat)) {
    for (const buff of afflictionsOf(actor)) {
      const data = buff.flags[MODULE_ID][FLAG];
      if (data.frequency?.unit !== "round") continue;
      const tick = `${combat.id}.${combat.round}`;
      if (data.tick === tick) continue;
      await buff.update({ [`flags.${MODULE_ID}.${FLAG}.tick`]: tick });
      await checkDue(actor, buff, { turnStart: true });
    }
  }
});

// Longer frequencies (and "/round" ones outside combat): when game time passes their due time
// Runs on every change of game time: the check for work is synchronous, and only work starts anything async
Hooks.on("updateWorldTime", (worldTime, delta) => {
  if (!isActiveGM()) return;
  const work = [];
  const now = game.time.worldTime;
  for (const actor of new Set([...game.actors, ...(canvas?.scene?.tokens?.map((t) => t.actor).filter(Boolean) ?? [])])) {
    for (const buff of afflictionsOf(actor)) {
      const data = buff.flags[MODULE_ID][FLAG];
      // Delay poison: the poison's clock stands still while the spell lasts
      if (delayed(actor, data.kind)) {
        if (delta > 0) work.push(() => buff.update({ [`flags.${MODULE_ID}.${FLAG}.dueAt`]: data.dueAt + delta }));
      } else if (!data.pending && (now >= data.dueAt || data.firstWaiting)) work.push(() => checkDue(actor, buff));
    }
  }
  if (work.length) (async () => { for (const fn of work) await fn(); })();
});

/* -------------------------------------------- */
/*  Cures, treatment, healing                   */
/* -------------------------------------------- */

/**
 * Neutralize poison, remove disease, remove curse: a caster level check against each affliction of that kind;
 * those beaten end (damage already dealt stays). Returns a short description.
 */
export async function cureAfflictions(actor, kind, cl, { automatic = false } = {}) {
  const list = afflictionsOf(actor).filter((b) => b.flags[MODULE_ID][FLAG].kind === kind);
  if (!list.length) return `no ${kind} to cure`;
  const out = [];
  for (const buff of list) {
    const data = buff.flags[MODULE_ID][FLAG];
    // Heal: "immediately ends ... diseased ... poisoned" (no caster level check)
    if (automatic) {
      await endAffliction(buff);
      out.push(`${data.name} ended`);
      continue;
    }
    const penalty = pernicious(actor, kind) ? 4 : 0;
    const roll = await new Roll(`1d20 + ${cl}${penalty ? " - 4" : ""}`).evaluate();
    if (roll.total >= data.dc) {
      await endAffliction(buff);
      out.push(`${data.name} ended (${roll.total} vs DC ${data.dc})`);
    } else out.push(`${data.name} remains (${roll.total} vs DC ${data.dc})`);
  }
  return out.join("; ");
}

// Pernicious poison cast on a poisoned creature: its poisons last 2 more saves (once per casting)
Hooks.on("createItem", (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "buff" || !item.isActive || !/^pernicious poison\b/i.test(item.name) || !item.actor) return;
  for (const buff of afflictionsOf(item.actor)) {
    const data = buff.flags[MODULE_ID][FLAG];
    if (data.kind === "poison" && data.remaining !== null) buff.update({ [`flags.${MODULE_ID}.${FLAG}`]: { remaining: data.remaining + 2, total: (data.total ?? 0) + 2 } });
  }
});

/** Start or stop a healer treating the affliction (Heal: treat poison or disease). */
export async function setTreatment(buff, healer) {
  await buff.update({ [`flags.${MODULE_ID}.${FLAG}.treatedBy`]: healer?.uuid ?? null });
}

onGmRequest("afflictTreat", async (message, data) => {
  const buff = fromUuidSync(data.buff);
  const healer = data.healer ? fromUuidSync(data.healer) : null;
  if (buff && (!healer || requestedByOwner(message, healer))) await setTreatment(buff, healer);
  await message.delete();
});

async function treat(buff, stop = false) {
  let healer = null;
  if (!stop) {
    // The user's characters; failing that, any creature they own (a GM's NPC healer, a player's companion)
    const owned = game.actors.filter((a) => a.isOwner && (!game.user.isGM || a.hasPlayerOwner || a === game.user.character));
    const characters = owned.filter((a) => a.type === "character");
    const mine = characters.length ? characters : owned.length ? owned : game.actors.filter((a) => a.isOwner);
    const pool = game.user.character ? [game.user.character, ...mine.filter((a) => a !== game.user.character)] : mine;
    if (!pool.length) return ui.notifications.warn("You have no character to treat it with.");
    if (pool.length === 1) healer = pool[0];
    else {
      const id = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Treat ${buff.name}` },
        content: `<div class="form-group"><label>Healer</label><div class="form-fields"><select name="healer">${pool.map((a) => `<option value="${a.uuid}">${esc(a.name)}</option>`).join("")}</select></div></div>`,
        ok: { label: "Treat", callback: (event, button) => button.form.elements.healer.value },
        rejectClose: false,
      });
      if (!id) return;
      healer = fromUuidSync(id);
    }
  }
  if (buff.isOwner) await setTreatment(buff, healer);
  else await ChatMessage.implementation.create({ whisper: gmWhisper(), content: `<p>${healer ? `${esc(healer.name)} treats` : "Stop treating"} ${esc(buff.actor?.name ?? "")}'s ${esc(buff.name)}…</p>`, flags: { [MODULE_ID]: { afflictTreat: { buff: buff.uuid, healer: healer?.uuid ?? null } } } });
}

// On the affliction's buff: its schedule, and the Treat button
registerFootnote((item) => {
  const data = item.flags?.[MODULE_ID]?.[FLAG];
  if (!data || item.type !== "buff") return null;
  const parts = [`${titleCase(data.kind)}: ${saveName(data.save)} DC ${data.dc}${data.doses > 1 ? ` (${data.doses} doses)` : ""}; ${data.remaining === null ? "until cured" : `${data.remaining} save${data.remaining === 1 ? "" : "s"} left`}${data.cure ? `; ${data.cure} in a row cure it (${data.streak} so far)` : "; only magic cures it"}.${delayed(item.actor, data.kind) ? " Held off by delay poison." : ""}`];
  const healer = data.treatedBy ? fromUuidSync(data.treatedBy) : null;
  if (healer) parts.push(`Treated by ${healer.name}: a Heal check with every save (+4 when it beats the DC).`);
  if (["poison", "disease"].includes(data.kind)) parts.push(healer ? footnoteButton("Stop treating", "The healer stops tending it", () => treat(item, true)) : footnoteButton("Treat (Heal)…", "A healer tends it: a Heal check with each save", () => treat(item)));
  return parts;
});

// Resting doesn't heal an affliction's damage while it lasts: PF1's rest is held back to it
Hooks.on("pf1PreActorRest", (actor, options, updateData) => {
  const dealt = {};
  for (const buff of afflictionsOf(actor)) for (const [key, n] of Object.entries(buff.flags[MODULE_ID][FLAG].dealt ?? {})) dealt[key] = (dealt[key] ?? 0) + n;
  const kept = [];
  // PF1 builds the update flat and then merges it into a nested object: read and write either form
  const get = (key) => (key in updateData ? updateData[key] : foundry.utils.getProperty(updateData, key));
  const set = (key, value) => (key in updateData ? (updateData[key] = value) : foundry.utils.setProperty(updateData, key, value));
  for (const [what, n] of Object.entries(dealt)) {
    if (what === "hp") {
      const hp = actor.system.attributes.hp;
      const healed = get("system.attributes.hp.value");
      const cap = Math.max(hp.value, hp.max - n);
      if (healed !== undefined && healed > cap) {
        set("system.attributes.hp.value", cap);
        kept.push(`${Math.min(n, healed - cap)} hit points`);
      }
      continue;
    }
    const key = `system.abilities.${what}.damage`;
    const current = foundry.utils.getProperty(actor, key) ?? 0;
    const after = get(key);
    const floor = Math.min(current, n);
    if (after !== undefined && after < floor) {
      set(key, floor);
      kept.push(`${floor - after} ${what.toUpperCase()} damage`);
    }
  }
  if (kept.length) ChatMessage.implementation.create({ speaker: ChatMessage.implementation.getSpeaker({ actor }), whisper: ownerWhisper(actor), content: `<p><strong>${esc(actor.name)}</strong> rests, but ${kept.join(", ")} from an affliction can't heal naturally while it lasts.</p>` });
});

/* -------------------------------------------- */
/*  Cards                                       */
/* -------------------------------------------- */

Hooks.on("renderChatMessageHTML", (message, html) => {
  const card = message.getFlag(MODULE_ID, CARD);
  const save = card && html.querySelector(`[data-action="${MODULE_ID}-afflict-save"]`);
  if (save) {
    const buff = fromUuidSync(card.buff);
    if (!buff || !buff.flags[MODULE_ID]?.[FLAG]?.pending) save.remove();
    else save.addEventListener("click", async () => {
      if (!buff.isOwner) return ui.notifications.warn("Only the creature's owner can roll this.");
      if (!buff.flags[MODULE_ID]?.[FLAG]?.pending) return save.remove(); // already rolled
      save.remove();
      await resolve(buff, card.count, message.uuid);
    });
  }
  const result = message.getFlag(MODULE_ID, RESULT);
  const undo = result && html.querySelector(`[data-action="${MODULE_ID}-afflict-undo"]`);
  if (undo) {
    const actor = fromUuidSync(result.actor);
    if (!actor?.isOwner || message.getFlag(MODULE_ID, "undone")) return void undo.remove();
    undo.addEventListener("click", async () => {
      undo.remove();
      for (const u of result.undo ?? []) await undoEffect(actor, u);
      if (message.isOwner) await message.setFlag(MODULE_ID, "undone", true);
    });
  }
});

/* -------------------------------------------- */
/*  Exposing a creature from a card             */
/* -------------------------------------------- */

/** The affliction an item describes (a poison, a disease, a monster's Poison ability), or null. */
export function afflictionOfItem(item) {
  if (!item) return null;
  const kind = /\bpoison|venom\b/i.test(item.name) || item.system?.subType === "poison" ? "poison" : /\bdisease|fever|plague|rot\b/i.test(item.name) ? "disease" : /\bcurse/i.test(item.name) ? "curse" : null;
  const spec = parseAffliction(item.system?.description?.value, { name: item.name.replace(/\s*\((ex|su|sp)\)\s*$/i, ""), kind });
  return spec && (spec.frequency || spec.onset || spec.effect || spec.initial) ? spec : null;
}

// "Expose targets" on the card of an item that describes an affliction
Hooks.on("renderChatMessageHTML", (message, html) => {
  const item = message.itemSource;
  const spec = afflictionOfItem(item);
  if (!spec || html.querySelector(`.${MODULE_ID}-expose`) || !(message.isAuthor || game.user.isGM)) return;
  const targets = message.system?.targets ?? [];
  const div = document.createElement("div");
  div.className = `${MODULE_ID}-expose`;
  div.innerHTML = `<button type="button">Expose ${targets.length ? `${targets.length} target${targets.length === 1 ? "" : "s"}` : "selected targets"} to ${esc(spec.name)} (${saveName(spec.save)} DC ${spec.dc})</button>`;
  div.querySelector("button").addEventListener("click", async () => {
    const uuids = targets.length ? targets : [...game.user.targets].map((t) => t.actor?.uuid).filter(Boolean);
    if (!uuids.length) return ui.notifications.warn("Target the creatures to expose first.");
    for (const uuid of uuids) {
      const target = fromUuidSync(uuid);
      const actor = target?.actor ?? target;
      if (!actor) continue;
      if (actor.isOwner) await exposeAndReport(actor, spec, message);
      else await ChatMessage.implementation.create({ whisper: gmWhisper(), content: `<p>Expose ${esc(actor.name)} to ${esc(spec.name)}…</p>`, flags: { [MODULE_ID]: { afflictExpose: { target: actor.uuid, spec, reference: message.uuid } } } });
    }
  });
  (html.querySelector(".card-content, .message-content") ?? html).append(div);
});

/** Expose a creature and post the result (with an Undo for the GM). */
export async function exposeAndReport(actor, spec, message) {
  const result = await contract(actor, spec, { source: message?.speaker?.alias ?? null, reference: message?.uuid ?? null });
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: ownerWhisper(actor),
    content: `<p><strong>${esc(actor.name)}</strong> exposed to ${esc(spec.name)}: ${esc(result.text)}.</p>${result.undo?.buff || result.undo?.effect || result.undo?.dose ? `<button type="button" data-action="${MODULE_ID}-afflict-unexpose">Undo</button>` : ""}`,
    flags: { [MODULE_ID]: { afflictExposed: { actor: actor.uuid, undo: result.undo ?? null } } },
  });
}

onGmRequest("afflictExpose", async (message, data) => {
  const actor = fromUuidSync(data.target);
  if (actor) await exposeAndReport(actor, data.spec, fromUuidSync(data.reference));
  await message.delete();
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, "afflictExposed");
  const button = data && html.querySelector(`[data-action="${MODULE_ID}-afflict-unexpose"]`);
  if (!button) return;
  if (!game.user.isGM || message.getFlag(MODULE_ID, "undone")) return void button.remove();
  button.addEventListener("click", async () => {
    button.disabled = true;
    await undoContract(fromUuidSync(data.actor), data.undo);
    await message.setFlag(MODULE_ID, "undone", true);
  });
});

export const _test = { FLAG, parseEffect, dueCount, resolve, checkDue, savesFor, treatment };
