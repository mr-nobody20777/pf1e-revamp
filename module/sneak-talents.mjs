// Sneak attack talents (phase 2): the rider chosen in the roll window's "With:" dropdown, how it
// changes the dice, and its effect, applied from the attack card once the attack has hit.
// Research: docs/SNEAK-ATTACK-RESEARCH.md; rulings: DECISIONS.md.
//
// Rules:
//   - "Talents marked with an asterisk add effects to a rogue's sneak attack. Only one of these talents
//     can be applied to an individual attack and the decision must be made before the attack roll is
//     made." One choice per roll window; a full attack uses it on every sneak attack.
//   - Effects happen only when the attack deals sneak attack damage. Talents that forgo the dice deal
//     weapon damage as normal and trigger no other sneak attack effect.
//   - Save DCs: 10 + 1/2 the class level + the ability modifier named by the talent.
//   - Same-source bonuses (Offensive Defense, Emboldening Strike) don't stack: a new hit refreshes them.

import { MODULE_ID, MELEE_ATTACKS } from "./const.mjs";
import { esc, classLevel, onGmRequest } from "./util.mjs";
import { rollPlan } from "./roll-effects.mjs";
import { precisionImmune } from "./resistance.mjs";
import { setBleed } from "./bleed.mjs";

const EFFECT = "Adds an effect (one per attack)";
const INSTEAD = "Instead of the dice";
const LAST = "lastSneakRider";
const FLAG = "sneakRiders";

const roll = async (formula) => (await new Roll(formula).evaluate()).total;
const perTwo = (n) => Math.max(1, Math.floor(n / 2));

/** A temporary buff with a duration in rounds; one with the same name is replaced (no stacking). */
async function timedBuff(actor, { name, rounds, text, changes = [] }) {
  const old = actor.itemTypes.buff.filter((b) => b.name === name);
  if (old.length) await actor.deleteEmbeddedDocuments("Item", old.map((b) => b.id));
  await actor.createEmbeddedDocuments("Item", [
    {
      type: "buff",
      name,
      img: "icons/skills/melee/strike-dagger-blood-red.webp",
      system: {
        subType: "temp",
        active: true,
        duration: { value: String(rounds), units: "round" },
        description: { value: `<p>${esc(text)}</p>` },
        changes: changes.map((c) => ({ operator: "add", ...c })),
      },
    },
  ]);
  return `${text} (${rounds} round${rounds === 1 ? "" : "s"})`;
}

async function abilityDamage(actor, ability, amount) {
  const current = actor.system.abilities[ability]?.damage ?? 0;
  await actor.update({ [`system.abilities.${ability}.damage`]: current + amount });
  return `${amount} ${ability.charAt(0).toUpperCase() + ability.slice(1)} damage`;
}

/**
 * The talents. `re` matches the talent's name (rogue, slayer, ninja and unchained versions).
 * dice(terms, n) changes the dice (terms: [{ n, size }]); fields(terms, n) adds entry fields.
 * text(n, dc) is the card line; apply({ attacker, target, n, saved, name }) does it (target: the
 * attacked creature; self: the attacker). save: the target's save against the DC; ability: the DC's
 * ability modifier (Int unless named). card: false for talents that only change the dice.
 */
const RIDERS = [
  // Effects
  { id: "bleeding", re: /^bleeding attack/i, text: (n) => `${n} bleed`, apply: ({ target, n }) => setBleed(target, n, "Bleeding Attack") },
  { id: "crippling", re: /^crippling strike/i, text: () => "2 Strength damage", apply: ({ target }) => abilityDamage(target, "str", 2) },
  { id: "petrifying", re: /^petrifying strike/i, text: () => "2 Dexterity damage", apply: ({ target }) => abilityDamage(target, "dex", 2) },
  { id: "befuddling", re: /^befuddling strike/i, text: () => "−2 on attack rolls against you for 1d4 rounds", apply: async ({ attacker, target }) => timedBuff(target, { name: "Befuddling Strike", rounds: await roll("1d4"), text: `−2 on attack rolls against ${attacker.name}` }) },
  { id: "slowReactions", re: /^slow reactions/i, text: () => "can't make attacks of opportunity for 1 round", apply: ({ target }) => timedBuff(target, { name: "Slow Reactions", rounds: 1, text: "Can't make attacks of opportunity" }) },
  { id: "confounding", re: /^confounding blades/i, melee: true, text: () => "can't make attacks of opportunity for 1d4+1 rounds", apply: async ({ target }) => timedBuff(target, { name: "Confounding Blades", rounds: await roll("1d4+1"), text: "Can't make attacks of opportunity" }) },
  { id: "entanglement", re: /^entanglement of blades/i, melee: true, text: () => "can't take a 5-foot step until your next turn", apply: ({ target }) => timedBuff(target, { name: "Entanglement of Blades", rounds: 1, text: "Can't take a 5-foot step" }) },
  { id: "slowing", re: /^slowing strike/i, save: "fort", text: (n, dc) => `speed halved for 1d4 rounds (Fortitude DC ${dc} negates)`, apply: async ({ target, saved }) => (saved ? "no effect" : timedBuff(target, { name: "Slowing Strike", rounds: await roll("1d4"), text: "Speed halved (choose the movement type)" })) },
  { id: "kiBlock", re: /^ki block/i, save: "will", ability: "cha", text: (n, dc) => `can't spend ki (Will DC ${dc} negates)`, apply: ({ attacker, target, saved }) => (saved ? "no effect" : timedBuff(target, { name: "Ki Block", rounds: Math.max(1, attacker.system.abilities.cha.mod), text: "Can't spend points from its ki pool" })) },
  { id: "offensiveDefense", re: /^offensive defense/i, melee: true, self: true, text: (n) => `you gain +${n} dodge bonus to AC for 1 round`, apply: ({ attacker, n }) => timedBuff(attacker, { name: "Offensive Defense", rounds: 1, text: `+${n} dodge bonus to AC`, changes: [{ formula: String(n), target: "ac", type: "dodge" }] }) },
  { id: "emboldening", re: /^emboldening strike/i, melee: true, self: true, text: (n) => `you gain +${perTwo(n)} circumstance bonus on saves for 1 round`, apply: ({ attacker, n }) => timedBuff(attacker, { name: "Emboldening Strike", rounds: 1, text: `+${perTwo(n)} circumstance bonus on saving throws`, changes: [{ formula: String(perTwo(n)), target: "allSavingThrows", type: "circumstance" }] }) },
  { id: "dispelling", re: /^dispelling attack/i, text: () => "targeted dispel magic against its lowest-level spell effect (caster level = your level)" },
  { id: "extinguishing", re: /^extinguishing strike/i, melee: true, text: () => "its nonmagical light sources go out" },
  { id: "focusing", re: /^focusing attack/i, melee: true, text: () => "you can end your chosen condition (confused, shaken or sickened)" },
  { id: "shadowsChill", card: false, re: /^shadow'?s chill/i, melee: true, text: (n) => `${n} of the sneak attack damage is cold`, fields: (terms, n) => ({ dice: { dmg: `${termsText(terms)} - ${n}` }, extraDamage: [{ formula: String(n), types: ["cold", "precision"], label: "Shadow's Chill" }] }) },
  { id: "improvedShadowsChill", card: false, re: /^improved shadow'?s chill/i, melee: true, text: () => "the sneak attack damage is cold", fields: () => ({ damageTypes: ["cold", "precision"] }) },
  { id: "powerful", card: false, re: /^powerful sneak/i, text: () => "full attack only: −2 on attack rolls until your next turn", fields: (terms, n, actor) => powerfulSneak(terms, actor) },
  // Instead of the dice
  { id: "knockOut", re: /^knock-?out blow/i, instead: true, daily: true, save: "fort", text: (n, dc) => `unconscious for 1d4 rounds (Fortitude DC ${dc}: staggered for 1 round instead)`, apply: async ({ target, saved }) => {
      if (saved) return (await target.setCondition("staggered", { duration: { rounds: 1 } }), "staggered for 1 round");
      const rounds = await roll("1d4");
      await target.setCondition("unconscious", { duration: { rounds } });
      return `unconscious for ${rounds} round${rounds === 1 ? "" : "s"}`;
    } },
  { id: "hamstring", re: /^hamstring strike/i, instead: true, save: "fort", ability: "dex", text: (n, dc) => `knocked prone and no move actions on its next turn (Fortitude DC ${dc} negates)`, apply: async ({ target, saved }) => {
      if (saved) return "no effect";
      await target.setCondition("prone", true);
      return timedBuff(target, { name: "Hamstring Strike", rounds: 1, text: "Prone; can't take move actions during its next turn" });
    } },
  { id: "obscuring", re: /^obscuring blow/i, instead: true, daily: true, save: "fort", text: (n, dc, level) => `20% miss chance on all its attacks for ${Math.max(1, Math.floor(level / 2))} rounds (Fortitude DC ${dc}: 1 round)`, apply: ({ target, saved, level }) => timedBuff(target, { name: "Obscuring Blow", rounds: saved ? 1 : Math.max(1, Math.floor(level / 2)), text: "Treats all other creatures as having concealment (20% miss chance)" }) },
  { id: "distracting", re: /^distracting attack/i, instead: true, melee: true, text: () => "flat-footed against one creature of your choice until your next turn (not against creatures with uncanny dodge)" },
  { id: "sever", re: /^sever alignment/i, instead: true, save: "fort", text: (n, dc) => `loses aligned DR and regeneration and can't use aligned spells for ${perTwo(n)} round(s) (Fortitude DC ${dc} negates)` },
  { id: "setUp", re: /^set-?up/i, instead: true, melee: true, text: () => "an adjacent ally's first melee attack against it before your next turn treats it as flanked" },
  { id: "stemTheFlow", re: /^stem the flow/i, forgo: 3, text: (n, dc, level) => `can't channel energy for ${Math.floor(level / 2)} rounds` },
  { id: "resonating", re: /^resonating rumbles/i, forgo: 3, text: (n, dc, level) => `can't use tremorsense for ${Math.floor(level / 2)} rounds` },
  { id: "accuratePoisoner", re: /^accurate poisoner/i, instead: true, text: () => "the poison's duration increases by 2" },
  { id: "sneakyManeuver", re: /^sneaky maneuver/i, instead: true, melee: true, fields: () => ({ atk: -2, partLabel: { atk: "Sneaky Maneuver" } }), text: () => "attempt a dirty trick, disarm, steal, sunder or trip as a swift action" },
  { id: "harrow", re: /^harrow strike/i, instead: true, daily: true, text: (n) => `${n} ability damage to the score of the harrow card's suit` },
  { id: "armorPiercer", re: /^armor piercer/i, perDie: true, text: (n, dc, level, given) => `natural armor −${given} until the end of your next turn` },
  { id: "demandAttention", re: /^demand attention/i, perDie: true, save: "will", ability: "cha", dcBonus: (given) => given, text: (n, dc) => `distracted until your next turn (Will DC ${dc} negates)` },
  // Dice
  { id: "marksman", card: false, re: /^marksman'?s shot/i, ranged: true, text: () => "studied target, single ranged attack: sneak attack dice doubled", fields: (terms) => ({ dice: { dmg: termsText(terms.map((t) => ({ ...t, n: t.n * 2 }))) } }) },
  // Not riders: shown alongside one (Assassinate is its own roll-window entry; an obliviating weapon's
  // effect comes with every sneak attack it deals)
  { id: "obliviating", hidden: true, save: "fort", text: (n, dc) => `loses all memory of the previous 1d6 minutes and is flat-footed until its next turn (Fortitude DC ${dc} negates)`, apply: async ({ target, saved }) => {
      if (saved) return "no effect";
      await target.setCondition("flatFooted", { duration: { rounds: 1 } });
      return `flat-footed, and loses ${await roll("1d6")} minutes of memory`;
    } },
  { id: "assassinate", re: /^assassinate/i, save: "fort", hidden: true, text: (n, dc) => `dies on a failed Fortitude save (DC ${dc}); otherwise immune to your assassinate for 24 hours`, apply: async ({ target, saved }) => {
      if (saved) return "survives, and is immune to your assassinate for 24 hours";
      await target.setCondition("dead", true);
      return "dies";
    } },
  { id: "mountainside", card: false, re: /^mountainside ambush/i, text: () => "unaware target, higher ground: maximum sneak attack damage", fields: (terms) => ({ dice: { dmg: String(terms.reduce((t, x) => t + x.n * x.size, 0)) } }) },
];

const termsText = (terms) => terms.filter((t) => t.n > 0).map((t) => `${t.n}d${t.size}`).join(" + ");

/** Powerful Sneak: 1s count as 2s (Deadly Sneak: 1s and 2s as 3s); unchained: reroll them once. */
function powerfulSneak(terms, actor) {
  const deadly = actor.itemTypes.feat.find((f) => f.isActive !== false && /^deadly sneak/i.test(f.name));
  const unchained = /\(UC\)/.test(actor.itemTypes.feat.find((f) => /^powerful sneak/i.test(f.name))?.name ?? "");
  const mod = unchained ? (deadly ? "r<=2" : "r1") : deadly ? "min3" : "min2";
  return { dice: { dmg: terms.map((t) => `${t.n}d${t.size}${mod}`).join(" + ") }, atk: -2, partLabel: { atk: "Powerful Sneak" } };
}

/** The talent item for a rider on this actor, if any (Improved Shadow's Chill isn't Shadow's Chill). */
function talentFor(actor, rider) {
  return actor.itemTypes.feat.find((f) => f.isActive !== false && rider.re.test(f.name) && !(rider.id === "shadowsChill" && /^improved/i.test(f.name)));
}

/** Class level and save DC for a talent. */
function dcFor(actor, rider, item, srcs, given = 0) {
  const level = classLevel(item) || Math.max(0, ...srcs.filter((s) => s.item).map((s) => classLevel(s.item)));
  const mod = actor.system.abilities[rider.ability ?? "int"]?.mod ?? 0;
  return { level, dc: 10 + Math.floor(level / 2) + mod + (rider.dcBonus?.(given) ?? 0) };
}

// Daily uses left, or null when the item doesn't track them (or hasn't been rested yet: PF1 leaves them empty)
const usesLeft = (item) => (item.system.uses?.per && item.system.uses.maxFormula ? (item.system.uses.value ?? null) : null);

/**
 * The "With:" dropdown for the sneak attack entry, or null when the character has no such talent.
 * terms: the dice ([{ n, size }]); srcs: the sneak attack features (for the class level).
 */
export function riderChoice(actor, terms, action, srcs) {
  const n = terms.reduce((t, x) => t + x.n, 0);
  const melee = MELEE_ATTACKS.includes(action.actionType);
  const options = [{ id: "none", label: "Damage only" }];
  const defs = new Map(); // option id → { rider, given }
  for (const rider of RIDERS) {
    if (rider.hidden) continue;
    if ((rider.melee && !melee) || (rider.ranged && melee)) continue;
    const item = talentFor(actor, rider);
    if (!item) continue;
    const left = rider.daily ? usesLeft(item) : null;
    const suffix = left === 0 ? " (none left today)" : rider.daily ? " (1/day)" : "";
    const group = rider.instead || rider.perDie || rider.forgo ? INSTEAD : EFFECT;
    if (rider.perDie) {
      for (let given = 1; given <= n; given++) {
        options.push({ id: `${rider.id}:${given}`, label: `${item.name}: ${given} ${given === 1 ? "die" : "dice"}`, group });
        defs.set(`${rider.id}:${given}`, { rider, item, given });
      }
    } else {
      options.push({ id: rider.id, label: `${item.name}${rider.forgo ? ` (−${rider.forgo} dice)` : ""}${suffix}`, group });
      defs.set(rider.id, { rider, item, given: rider.forgo ?? (rider.instead ? n : 0) });
    }
  }
  if (options.length === 1) return null;
  const last = actor.getFlag(MODULE_ID, LAST);
  return {
    label: "With:",
    options,
    default: defs.has(last) && !defs.get(last).rider.daily ? last : "none",
    apply(id) {
      const def = defs.get(id);
      if (!def) return {};
      const { rider, given } = def;
      // Fewer dice when some are given up (the smallest die size first)
      let left = given;
      const kept = [...terms].sort((a, b) => a.size - b.size).map((t) => {
        const take = Math.min(t.n, left);
        left -= take;
        return { ...t, n: t.n - take };
      });
      const keptN = kept.reduce((t, x) => t + x.n, 0);
      const fields = rider.fields?.(kept, keptN, actor) ?? {};
      // For the card: the dice the effect counts (those rolled, or those given up), and the DC
      const { level, dc } = dcFor(actor, rider, def.item, srcs, given);
      // Murderer's Blackcloth: +1 bleed on sneak attacks
      const blackcloth = rider.id === "bleeding" && actor.items.some((i) => i.type === "equipment" && i.system.equipped && /murderer'?s blackcloth/i.test(i.name)) ? 1 : 0;
      const counted = (rider.perDie ? given : rider.instead || rider.forgo ? n : keptN) + blackcloth;
      const rider_ = { id: rider.id, name: def.item.name, item: def.item.uuid, n: counted, given, dc, level, daily: !!rider.daily, text: rider.text(counted, dc, level, given) };
      if (keptN === 0) return { dice: null, valueText: `${def.item.name} instead of the dice`, ...fields, rider: rider_ };
      return { dice: { dmg: termsText(kept) }, ...fields, ...(given ? { valueText: `+${termsText(kept)} (${def.item.name})` } : {}), rider: rider_ };
    },
  };
}

/* -------------------------------------------- */
/*  The attack card                             */
/* -------------------------------------------- */

// When the card is made: which attacks carry the rider, and the details to apply it later
Hooks.on("pf1PreDisplayActionUse", (use) => {
  const provided = rollPlan(use.shared.rollData)?.provided ?? [];
  const entry = provided.find((p) => p.id === "sneak-attack");
  const actor = use.actor;
  if (!entry || !actor) return;
  const riders = [];
  if (entry.rider && riderOf(entry.rider.id)?.card !== false) riders.push(entry.rider);
  const assassinate = provided.find((p) => p.id === "assassinate") && fromUuidSync(provided.find((p) => p.id === "assassinate").assassinate);
  // An obliviating weapon (bludgeoning melee): on every sneak attack or critical hit, DC 16
  if (entry.dice && /obliviating/i.test(use.item?.name ?? "")) {
    const rider = riderOf("obliviating");
    riders.push({ id: rider.id, name: "Obliviating", item: use.item.uuid, n: 0, given: 0, dc: 16, level: 0, text: rider.text(0, 16) });
  }
  if (assassinate && entry.dice) {
    const rider = riderOf("assassinate");
    const { level, dc } = dcFor(actor, rider, assassinate, []);
    riders.push({ id: rider.id, name: assassinate.name, item: assassinate.uuid, n: 0, given: 0, dc, level, text: rider.text(0, dc) });
  }
  // "The decision must be made before the attack roll": the dropdown starts on this rider next time,
  // unless it's once a day (whose use is spent instead)
  if (entry.rider) {
    const item = fromUuidSync(entry.rider.item);
    if (!entry.rider.daily) actor.setFlag(MODULE_ID, LAST, entry.chosen);
    else if (item && usesLeft(item) > 0) item.update({ "system.uses.value": usesLeft(item) - 1 });
  } else if (actor.getFlag(MODULE_ID, LAST) && entry.choice) actor.unsetFlag(MODULE_ID, LAST);
  if (!riders.length) return;
  const attacks = use.shared.chatAttacks.map((a, i) => (a.type === "manyshot" || !a.damage?.rolls?.length ? -1 : i)).filter((i) => i >= 0);
  const target = use.shared.targets?.[0]?.document?.uuid ?? null;
  use.shared.chatData[`flags.${MODULE_ID}.${FLAG}`] = { riders, attacks, attacker: actor.uuid, target, applied: {} };
});

const riderOf = (id) => RIDERS.find((r) => r.id === id);
const SAVE_NAME = { fort: "Fortitude", ref: "Reflex", will: "Will" };
const immuneToPrecision = (actor) => precisionImmune(actor) || !!actor.system.traits?.di?.total?.has?.("precision");

Hooks.on("renderChatMessagePF", (message, html) => {
  const data = message.getFlag(MODULE_ID, FLAG);
  if (!data?.riders) return;
  const attacker = fromUuidSync(data.attacker);
  for (const i of data.attacks) {
    const el = html.querySelector(`.chat-attack[data-index="${i}"]`);
    if (!el) continue;
    const lines = data.riders.map((info, r) => riderLine(message, data, info, r, i, attacker));
    const table = el.querySelector("table");
    table ? table.after(...lines) : el.append(...lines);
  }
});

function riderLine(message, data, info, r, i, attacker) {
    const rider = riderOf(info.id);
    const canApply = rider?.apply && (game.user.isGM || attacker?.isOwner);
    const done = data.applied?.[`${r}-${i}`];
    const div = document.createElement("div");
    div.className = `${MODULE_ID}-sneak-rider`;
    div.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #7a5;";
    div.innerHTML = `<strong>${esc(info.name)}</strong> (if it hits): ${esc(info.text)}${done ? ` <em>· ${esc(done)}</em>` : ""}`;
    if (canApply && !done) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = rider.save ? `Apply (rolls its ${SAVE_NAME[rider.save]} save)` : "Apply";
      button.dataset.tooltip = "Apply once the attack has hit";
      button.style.cssText = "width: auto; line-height: 1.4; margin: 2px 0.25em; padding: 0 6px;";
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        button.disabled = true;
        if (game.user.isGM || (rider.self && attacker?.isOwner)) await applyRider(message, r, i);
        else await ChatMessage.implementation.create({ whisper: game.users.filter((u) => u.isGM).map((u) => u.id), content: `<p>Applying ${esc(info.name)}…</p>`, flags: { [MODULE_ID]: { applySneakRider: { message: message.id, rider: r, index: i } } } });
      });
      div.append(button);
    }
    return div;
}

/** Apply a card's rider r for attack `index` (GM, or the attacker's owner for effects on the attacker). */
export async function applyRider(message, r, index) {
  const data = message.getFlag(MODULE_ID, FLAG);
  const info = data?.riders?.[r];
  const rider = riderOf(info?.id);
  if (!rider?.apply || data.applied?.[`${r}-${index}`]) return null;
  const attacker = fromUuidSync(data.attacker);
  const target = fromUuidSync(data.target)?.actor ?? null;
  let result;
  if (!rider.self && !target) result = "no target";
  else if (!rider.instead && !rider.forgo && !rider.perDie && target && immuneToPrecision(target)) result = "no effect: no sneak attack damage was dealt (immune to precision damage)";
  else {
    let saved = false;
    if (rider.save) {
      const save = await target.rollSavingThrow(rider.save, { skipDialog: true, dc: info.dc, reference: message.uuid });
      const total = save?.rolls?.[0]?.total ?? save?.total;
      saved = Number.isFinite(total) && total >= info.dc;
    }
    result = await rider.apply({ attacker, target, n: info.n, saved, level: info.level, given: info.given });
    if (rider.save) result = `${saved ? "saved" : "failed"}: ${result}`;
  }
  const update = { [`flags.${MODULE_ID}.${FLAG}.applied.${r}-${index}`]: result };
  if (message.isOwner) await message.update(update);
  return result;
}

onGmRequest("applySneakRider", async (request, { message, rider, index }) => {
  const card = game.messages.get(message);
  if (card) await applyRider(card, rider, index);
  await request.delete();
});

export const _test = { RIDERS, applyRider, LAST, FLAG };
