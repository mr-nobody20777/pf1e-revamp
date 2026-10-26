// Spells on the creatures they affect. A spell's card gets a row per affected creature: its spell
// resistance check, its saving throw and what happened to it.
//
// Rules (Core Rulebook, Magic):
//   - Spell resistance: "the caster must make a caster level check (1d20 + caster level) at least equal
//     to the creature's spell resistance for the spell to affect that creature." Harmless spells on a
//     willing creature don't check it. Spell Penetration and Greater Spell Penetration add +2 each,
//     Elven Magic +2.
//   - Saving throws: "a natural 1 is always a failure, and a natural 20 is always a success." A
//     creature can give up its save; a harmless spell on an ally is treated as accepted (no save).
//   - Undead and constructs are "immune to any effect that requires a Fortitude save (unless the effect
//     also works on objects or is harmless)", and to mind-affecting effects, sleep, paralysis and
//     stunning; mindless creatures (no Intelligence score) to mind-affecting effects.
//   - Touch and ray spells need their attack to hit (touch AC); a natural 20 always hits, a natural 1
//     misses. "To use a touch spell [on an unwilling creature], you must succeed on a melee touch attack":
//     PF1's data gives many touch spells no attack roll (Touch of Fatigue, Touch of Blindness), so the
//     attack is rolled here for a spell with a range of touch and no attack of its own.
//   - A spell with a range of personal affects the caster.
//   - Chill Touch: "Each touch channels negative energy that deals 1d6 points of damage. The touched
//     creature also takes 1 point of Strength damage unless it makes a successful Fortitude saving
//     throw ... An undead creature you touch takes no damage of either sort, but it must make a
//     successful Will saving throw or flee as if panicked for 1d4 rounds + 1 round per caster level."
//     PF1's data has no attack or damage: the melee touch attack is rolled here (base attack bonus,
//     Strength, or Dexterity with Weapon Finesse, size and attack bonuses) and the damage applied on a hit.
//   - Hideous Laughter: "On the creature's next turn, it may attempt a new saving throw to end the
//     effect ... If not, the creature continues laughing for the entire duration"; "A creature whose type
//     is different from the caster's receives a +4 bonus on its saving throw". Hypnotism: "If you use
//     this spell in combat, each target gains a +2 bonus on its saving throw. If the spell affects only a
//     single creature not in combat at the time, the saving throw has a penalty of -2." These modifiers
//     are ticked entries in the save window.
//   - Fixes to PF1's spell data: Magic Missile "strikes unerringly" with "an additional missile [for
//     every two caster levels beyond 1st] ... the maximum of five missiles at 9th level" (PF1 rolls one,
//     and an attack); cure spells deal their healing as damage to undead "instead of curing their
//     wounds", and inflict spells heal them (PF1 applies both as written).
//
// Project rulings (DECISIONS.md): every save is rolled by clicking (the creature's owner or the GM,
// NPCs too); the result applies as soon as the save is known; the spell resistance check is rolled
// automatically and everyone sees whether it got through, only the GM sees the SR value. Immunities
// are found when the spell resolves, not before.
//
// Flow: the caster's card records the affected creatures (preCreateChatMessage); the active GM's
// client fills in each row (filters, spell resistance, the attack against touch AC, Hit Dice pools) and
// applies what needs no save; a save rolled against the card (from a row's button or PF1's own) is
// matched to its row on the GM's client, which applies the result. Damage stays with PF1's buttons:
// the row says whether the creature takes full or half.

import { MODULE_ID } from "./const.mjs";
import { SPELLS } from "./spell-data.mjs";
import { creatureTypes } from "./resistance.mjs";
import { compendiumBuff, nevelaAppliesBuff } from "./buff-grants.mjs";
import { esc, evaluate, isActiveGM, onGmRequest, createQueue, tokenDistance, timed, saveResult } from "./util.mjs";
import { isUndead } from "./channel-energy.mjs";
import { registerFootnote } from "./footnote.mjs";
import { registerRollEffect } from "./roll-effects.mjs";

const FLAG = "spell";
const SAVE_NAMES = { fort: "Fortitude", ref: "Reflex", will: "Will" };
const queue = createQueue("spell results");
// Spells another feature already puts on their targets (buff-grants.mjs)
const HANDLED_ELSEWHERE = new Set(["guidance"]);

/** The spell an item casts: the spell itself, or a scroll, wand or potion of it ("Wand of Daze"). */
function spellNameOf(item) {
  if (item?.type === "spell") return item.name;
  if (item?.type === "consumable" && ["scroll", "wand", "potion"].includes(item.system.subType)) return item.name.replace(/^(scroll|wand|potion) of /i, "");
  return null;
}

/** The spell's entry, or null. */
export function spellDef(item) {
  const name = spellNameOf(item);
  return name ? (SPELLS[name.toLowerCase().replace(/\s*\((?:mythic|communal)\)$/, "")] ?? null) : null;
}

/** The compendium spell a scroll, wand or potion was made from (its descriptors and spell resistance). */
async function sourceSpell(name) {
  const pack = game.packs.get("pf1.spells");
  const entry = pack?.index.find((e) => e.name === name);
  return entry ? pack.getDocument(entry._id) : null;
}

/** The entry as it applies to this row's creature (Chill Touch on undead has its own effect). */
const rowDef = (def, row) => (def && row.variant ? { ...def, ...def[row.variant] } : def);
/** The save this row's creature makes. */
const saveOf = (data, row) => (data.save ? { ...data.save, type: row.saveType ?? data.save.type } : null);

const actorOf = (uuid) => {
  const doc = fromUuidSync(uuid);
  return doc?.actor ?? (doc instanceof Actor ? doc : null);
};
const tokenOf = (uuid) => {
  const doc = fromUuidSync(uuid);
  return doc instanceof TokenDocument ? doc : null;
};

/* -------------------------------------------- */
/*  Who is affected                             */
/* -------------------------------------------- */

// The caster's card: which creatures the spell affects
Hooks.on("preCreateChatMessage", (message) => {
  if (message.type !== "action") return;
  const item = message.itemSource;
  const spellName = spellNameOf(item);
  if (!spellName || HANDLED_ELSEWHERE.has(spellName.toLowerCase())) return;
  const def = spellDef(item);
  const action = item.actions?.get(message.system.action?.id);
  const save = message.system.save?.type ? { type: message.system.save.type, dc: message.system.save.dc } : null;
  // The spell allows a save but PF1 couldn't work out its DC (a broken item): no rows, so nothing lands unsaved
  if (action?.save?.type && !save) return;
  const harmless = !!action?.save?.harmless;
  // A scroll, wand or potion doesn't carry the spell's spell resistance: found when the card resolves
  const sr = item.type === "spell" ? !!item.system.sr : null;
  if (!def && !save && !sr) return;
  const caster = ChatMessage.implementation.getSpeakerActor(message.speaker);
  const casterToken = caster?.getActiveTokens()[0]?.document ?? null;
  let targets = [...(message.system.targets ?? [])];
  const range = action?.range?.units;
  if (def?.self || (def && range === "personal")) targets = [casterToken?.uuid ?? caster?.uuid].filter(Boolean);
  if (def?.affects && casterToken) {
    const ally = (uuid) => tokenOf(uuid)?.disposition === casterToken.disposition;
    targets = targets.filter((uuid) => (def.affects === "allies") === ally(uuid));
  }
  if (!targets.length) return;
  message.updateSource({
    [`flags.${MODULE_ID}.${FLAG}`]: {
      name: spellName,
      itemId: item.id,
      actionId: action?.id ?? null,
      save,
      harmless,
      sr,
      attack: ["msak", "rsak"].includes(action?.actionType) && !def?.autoHit,
      // A touch spell without an attack roll of its own: the melee touch attack is rolled for it
      touch: (def?.touchAttack ?? (range === "touch" && !["msak", "rsak"].includes(action?.actionType))) || false,
      damage: !!action?.damage?.parts?.length,
      heal: action?.actionType === "heal",
      cl: message.system.config?.cl ?? item.system.cl ?? 0,
      // A save that also works on objects isn't one undead and constructs are immune to
      objectSave: /object/i.test(action?.save?.description ?? ""),
      casterDisposition: casterToken?.disposition ?? null,
      rows: targets.map((uuid) => ({ uuid, name: tokenOf(uuid)?.name ?? actorOf(uuid)?.name ?? "?" })),
    },
  });
});

/** Why the creature can't be affected (GM-only text), or null. */
function unaffectedBy(def, actor, spell) {
  const { types } = creatureTypes(actor);
  const hd = actor.system.attributes?.hd?.total ?? 0;
  const { subtypes } = creatureTypes(actor);
  if (def?.types && !def.types.some((t) => types.has(t) || subtypes.has(t))) return `only ${def.types.join(" or ")} creatures`;
  if (def?.hdMax != null && hd > def.hdMax) return `${def.hdMax} HD or less only`;
  const undeadOrConstruct = types.has("undead") || types.has("construct");
  if (def?.living && undeadOrConstruct) return "living creatures only";
  if (def?.dying && !((actor.system.attributes?.hp?.value ?? 0) < 0)) return "only a creature below 0 hit points";
  if (def?.wounded && !((actor.system.attributes?.hp?.value ?? 0) < (actor.system.attributes?.hp?.max ?? 0))) return "only a wounded creature";
  if (def?.intMin != null && !((actor.system.abilities?.int?.value ?? 0) >= def.intMin)) return `Intelligence ${def.intMin} or higher only`;
  if (def?.sighted && actor.statuses?.has("blind")) return "sightless creatures are unaffected";
  if (def?.unless && actor.statuses?.has(def.unless)) return `already ${def.unless}`;
  if (def?.cooldown) {
    const until = actor.getFlag(MODULE_ID, "spellCooldown")?.[spell.name.toLowerCase()];
    if (until && until > game.time.worldTime) return `immune to ${spell.name} for a while after being affected`;
  }
  const ci = actor.system.traits?.ci?.total ?? new Set();
  const descriptors = new Set(spell.descriptors);
  const mindless = actor.system.abilities?.int?.value == null || actor.system.abilities.int.value === 0;
  // Plants are immune whatever their Intelligence; vermin and oozes because they're mindless
  if (descriptors.has("mindAffecting") && (ci.has("mindAffecting") || undeadOrConstruct || mindless || types.has("plant"))) return "immune to mind-affecting effects";
  if (descriptors.has("fear") && ci.has("fear")) return "immune to fear";
  if (descriptors.has("death") && ci.has("deathEffects")) return "immune to death effects";
  if (spell.save === "fort" && !spell.harmless && !spell.objectSave && undeadOrConstruct) return "undead and constructs ignore Fortitude effects";
  return null;
}

/** Bonus on caster level checks against spell resistance. */
function penetration(caster) {
  const has = (re) => caster?.items.some((i) => i.type === "feat" && i.isActive !== false && re.test(i.name));
  let bonus = 0;
  if (has(/^spell penetration\b/i)) bonus += 2;
  if (has(/^greater spell penetration\b/i)) bonus += 2;
  if (has(/^elven magic\b/i)) bonus += 2;
  return bonus;
}

const isAlly = (data, token) => data.casterDisposition != null && token?.disposition === data.casterDisposition;
/** An ally (or the caster) accepts the touch; it also gives up the save and spell resistance of a harmless spell. */
const accepts = (data, row, caster) => isAlly(data, tokenOf(row.uuid)) || actorOf(row.uuid) === caster;

// The active GM resolves the card: filters, spell resistance, attacks, pools; effects that need no save
onGmRequest(FLAG, (message, data) => {
  if (data.resolved) return;
  queue(() => resolveCard(message));
});

async function resolveCard(message) {
  const data = foundry.utils.deepClone(message.getFlag(MODULE_ID, FLAG));
  if (!data || data.resolved) return;
  const caster = ChatMessage.implementation.getSpeakerActor(message.speaker);
  const item = caster?.items.get(message.system.item?.id) ?? message.itemSource;
  const def = spellDef(item);
  const source = item?.type === "spell" ? item : await sourceSpell(data.name);
  if (data.sr === null) data.sr = !!source?.system.sr;
  const spell = { name: data.name, descriptors: [...(source?.system.descriptors?.total ?? source?.system.descriptors?.base ?? [])], save: data.save?.type, harmless: data.harmless, objectSave: data.objectSave };
  let attack = message.systemRolls?.attacks?.[0]?.attack ?? null;
  // PF1's data for some touch spells has no attack roll (Chill Touch): roll it here
  const needsTouch = data.touch && data.rows.some((r) => !accepts(data, r, caster));
  if (needsTouch && !attack && caster) {
    attack = await new Roll(`1d20 + ${touchBonus(caster, data.touch === "ranged")}`).evaluate();
    data.touchRoll = { total: attack.total, ranged: data.touch === "ranged" };
  }
  const natural = attack?.dice?.[0]?.total;

  for (const row of data.rows) {
    const actor = actorOf(row.uuid);
    const token = tokenOf(row.uuid);
    if (!actor) {
      row.state = "unaffected";
      continue;
    }
    const willing = data.harmless && accepts(data, row, caster);
    if (def?.undead && creatureTypes(actor).types.has("undead")) {
      row.variant = "undead";
      if (def.undead.save) row.saveType = def.undead.save;
    }
    const why = unaffectedBy(rowDef(def, row), actor, { ...spell, save: row.saveType ?? spell.save });
    if (why) {
      Object.assign(row, { state: "unaffected", why });
      continue;
    }
    // Touch and ray attacks first (an ally accepting a touch needs no roll), then spell resistance
    const touchAccepted = data.touch && !data.attack && accepts(data, row, caster);
    if ((data.attack || data.touch) && attack && !willing && !touchAccepted) {
      const ac = actor.system.attributes?.ac?.touch?.total ?? 10;
      const intoMelee = data.touchRoll?.ranged && engaged(token, data, caster) ? -4 : 0;
      const total = attack.total + intoMelee;
      row.attack = { total, ac, intoMelee: !!intoMelee, hit: natural === 20 || (natural !== 1 && total >= ac) };
      if (!row.attack.hit) {
        row.state = "missed";
        continue;
      }
    }
    const sr = actor.system.attributes?.sr?.total ?? 0;
    if (data.sr && sr > 0 && !willing) {
      const roll = await new Roll(`1d20 + ${data.cl} + ${penetration(caster)}`).evaluate();
      row.sr = { total: roll.total, value: sr, passed: roll.total >= sr };
      if (!row.sr.passed) {
        row.state = "resisted";
        continue;
      }
    }
    // Damage PF1's card doesn't have (Chill Touch), on a hit
    const onHit = rowDef(def, row)?.onHit;
    if (onHit?.damage) {
      const roll = await new Roll(onHit.damage.formula, { cl: data.cl }).evaluate();
      await actor.applyDamage(roll.total, { forceDialog: false });
      row.hitDamage = `${roll.total} ${onHit.damage.type} damage`;
    }
    row.state = data.save && !willing && rowDef(def, row)?.initialSave !== false ? "save" : "apply";
  }

  // A pool of Hit Dice (Sleep): fewest HD first, then nearest to the spell's origin
  if (def?.pool) {
    let left = (await new Roll(def.pool).evaluate()).total;
    data.pool = left;
    const origin = fromUuidSync(message.system.template ?? "") ?? caster?.getActiveTokens()[0]?.document;
    const dist = (row) => {
      const t = tokenOf(row.uuid)?.object;
      return t && origin ? Math.hypot(t.center.x - origin.x, t.center.y - origin.y) : 0;
    };
    const hd = (row) => actorOf(row.uuid)?.system.attributes?.hd?.total ?? 0;
    const eligible = data.rows.filter((r) => r.state === "save" || r.state === "apply").sort((a, b) => hd(a) - hd(b) || dist(a) - dist(b));
    for (const row of eligible) {
      if (hd(row) <= left) left -= hd(row);
      else Object.assign(row, { state: "unaffected", why: `the ${data.pool} HD affected were used up` });
    }
  }

  for (const row of data.rows) if (row.state === "apply") await applyRow(row, rowDef(def, row), data, caster, { saved: false });
  data.resolved = true;
  await message.setFlag(MODULE_ID, FLAG, data);
}

/* -------------------------------------------- */
/*  Saves                                       */
/* -------------------------------------------- */

// A save rolled against the card, from a row's button or PF1's own: the GM's client applies it
Hooks.on("createChatMessage", (save) => {
  if (!isActiveGM() || save.type !== "check" || !save.system?.subject?.save || !save.system.reference) return;
  queue(async () => {
    const card = fromUuidSync(save.system.reference);
    const data = foundry.utils.deepClone(card?.getFlag?.(MODULE_ID, FLAG));
    if (!data?.resolved || !data.save) return;
    const { token: tokenId, actor: actorId } = save.speaker;
    // By token when the save has one: unlinked tokens of the same creature share its actor id
    const mine = (r) => (tokenId ? r.uuid.endsWith(`Token.${tokenId}`) || (!tokenOf(r.uuid) && actorOf(r.uuid)?.id === actorId) : actorOf(r.uuid)?.id === actorId && tokenOf(r.uuid)?.actorLink !== false);
    const row = data.rows.find((r) => r.state === "save" && mine(r) && saveOf(data, r).type === save.system.subject.save);
    if (!row) return;
    const { total, passed } = saveResult(save, data.save.dc);
    row.save = { total, passed };
    if (data.ends) await endEffect(row, data, passed);
    else {
      const caster = ChatMessage.implementation.getSpeakerActor(card.speaker);
      const item = caster?.items.get(card.system.item?.id) ?? card.itemSource;
      await applyRow(row, rowDef(spellDef(item), row), data, caster, { saved: passed });
    }
    await card.setFlag(MODULE_ID, FLAG, data);
  });
});

/** Roll this row's save (its creature's owner or the GM). */
async function rollSave(message, index) {
  const data = message.getFlag(MODULE_ID, FLAG);
  const actor = actorOf(data?.rows?.[index]?.uuid);
  if (!actor?.isOwner || !data.save) return;
  await actor.rollSavingThrow(saveOf(data, data.rows[index]).type, { dc: data.save.dc, reference: message.uuid });
}

/** Shooting into melee (a ranged touch rolled here): -4 when the target is next to one of the caster's allies, unless Precise Shot. */
function engaged(token, data, caster) {
  if (!token?.object || caster?.items.some((i) => i.type === "feat" && /^precise shot$/i.test(i.name))) return false;
  return canvas.tokens.placeables.some((t) => t.document !== token && t.actor && t.actor !== caster && isAlly(data, t.document) && (tokenDistance(t, token.object) ?? 99) <= 5);
}

/** Bonus on touch attacks: base attack, Strength (Dexterity with Weapon Finesse, or for a ranged touch), size, attack bonuses. */
function touchBonus(caster, ranged = false) {
  const rd = caster.getRollData();
  const finesse = caster.items.some((i) => i.type === "feat" && /^weapon finesse$/i.test(i.name));
  const ability = ranged ? rd.abilities.dex.mod : finesse ? Math.max(rd.abilities.str.mod, rd.abilities.dex.mod) : rd.abilities.str.mod;
  const size = pf1.config.sizeMods?.[caster.system.traits?.size?.value ?? caster.system.traits?.size] ?? 0;
  return [rd.attributes.bab.total, ability, size, rd.attributes.attack?.general ?? 0, rd.attributes.attack?.[ranged ? "ranged" : "melee"] ?? 0].reduce((a, b) => a + (Number(b) || 0), 0);
}

// Save modifiers that depend on the situation (Hypnotism, Hideous Laughter): ticked in the save window
registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "save" || !roll.reference) return [];
    const card = fromUuidSync(roll.reference);
    const data = card?.getFlag?.(MODULE_ID, FLAG);
    const def = SPELLS[data?.name?.toLowerCase()];
    if (!def?.saveModifiers) return [];
    const caster = ChatMessage.implementation.getSpeakerActor(card.speaker);
    const out = [];
    for (const m of def.saveModifiers) {
      const applies = m.when === "differentType" ? !sameType(actor, caster) : m.when === "inCombat" ? inCombat(actor) : m.when === "aloneOutOfCombat" ? data.rows.length === 1 && !inCombat(actor) : false;
      out.push({ id: `spell-save.${m.when}`, label: `${data.name}: ${m.label}`, part: data.name, type: "untyped", roll: m.value, applies, reason: m.reason });
    }
    return out;
  },
});

const inCombat = (actor) => !!game.combat?.started && game.combat.combatants.some((c) => c.actor === actor || (c.token?.actorLink && c.actorId === actor.id));
function sameType(a, b) {
  const ta = creatureTypes(a).types;
  return [...creatureTypes(b).types].some((t) => ta.has(t));
}

/* -------------------------------------------- */
/*  A new save to end the effect                */
/* -------------------------------------------- */

// On the creature's turn in combat, a card with its save to end the effect: once (Hideous Laughter) or
// every turn until it succeeds (Mudball, Shadow Trap, Unlock Flesh)
Hooks.on("combatTurnChange", (combat, prior, current) => {
  if (!isActiveGM()) return;
  if (prior && current && (current.round < prior.round || (current.round === prior.round && current.turn < prior.turn))) return;
  const actor = combat.combatant?.actor;
  const token = combat.combatant?.token;
  for (const buff of actor?.itemTypes.buff.filter((b) => b.isActive && b.getFlag(MODULE_ID, "resave")) ?? []) queue(() => offerResave(actor, token, buff, combat));
});

async function offerResave(actor, token, buff, combat) {
  const resave = buff.getFlag(MODULE_ID, "resave");
  if (!resave) return;
  // Once a round: stepping the tracker back and forward again doesn't offer it twice
  const offered = `${combat.id}.${combat.round}`;
  if (resave.offered === offered) return;
  if (resave.every) await buff.setFlag(MODULE_ID, "resave", { ...resave, offered });
  // Once (Hideous Laughter): used up when offered. Every turn: stays until a save succeeds, so a save
  // that's never rolled doesn't end the chance to save next turn
  if (!resave.every) await buff.unsetFlag(MODULE_ID, "resave");
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor, token }),
    whisper: game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id),
    content: `<p><strong>${esc(buff.name)}</strong>: ${esc(actor.name)} may make a new save to end it${resave.action ? ` (${esc(resave.action)})` : ""}.${resave.every ? "" : " On a failure it lasts the full duration."}</p>`,
    flags: { [MODULE_ID]: { [FLAG]: { name: buff.name, save: resave.save, cl: resave.cl, ends: buff.uuid, resave, resolved: true, rows: [{ uuid: token?.uuid ?? actor.uuid, name: token?.name ?? actor.name, state: "save" }] } } },
  });
}

/** The new save's result: the effect ends, or continues. */
async function endEffect(row, data, passed) {
  row.state = "done";
  const buff = fromUuidSync(data.ends);
  const actor = actorOf(row.uuid);
  const removeConditions = async () => {
    const removes = (data.resave?.removes ?? []).filter((id) => actor?.statuses.has(id));
    if (removes.length) await actor.setConditions(Object.fromEntries(removes.map((id) => [id, false])));
  };
  if (!buff) {
    await removeConditions();
    row.applied = [`${data.name} already ended`];
  } else if (passed) {
    await buff.delete();
    await removeConditions();
    row.applied = [`${data.name} ends`];
  } else row.applied = [data.resave?.every ? "still affected; another save next turn" : "lasts the full duration"];
}

/* -------------------------------------------- */
/*  Effects                                     */
/* -------------------------------------------- */

/** Apply the spell's effect to the row's creature (GM), and note what was done. */
async function applyRow(row, def, data, caster, { saved }) {
  row.state = "done";
  const actor = actorOf(row.uuid);
  const effect = !def ? null : saved ? def.onSave : def.tiers ? tierFor(def, actor) : def.effect;
  const applied = [];
  // A healing spell heals the living; undead take it as damage (half on a save)
  if (data.heal && actor && !isUndead(actor)) applied.push("healing");
  else if (saved && data.damage) applied.push("half damage");
  else if (data.damage) applied.push("full damage");
  if (saved && def && !def.onSave && !data.damage) applied.push(row.hitDamage ? "no further effect" : "no effect");
  if (effect && actor) applied.push(...(await applyEffect(actor, effect, data, caster)));
  if (def?.cooldown && actor && !saved) await actor.setFlag(MODULE_ID, "spellCooldown", { [data.name.toLowerCase()]: game.time.worldTime + def.cooldown * 6 });
  row.applied = applied;
}

function tierFor(def, actor) {
  const hd = actor?.system.attributes?.hd?.total ?? 0;
  return def.tiers.find(([max]) => hd <= max)?.[1] ?? null;
}

async function applyEffect(actor, effect, data, caster) {
  const out = [];
  const rollData = { cl: data.cl };
  for (const [key, formula] of Object.entries(effect.roll ?? {})) rollData[key] = (await new Roll(formula).evaluate()).total;
  const living = !creatureTypes(actor).types.has("undead") && !creatureTypes(actor).types.has("construct");
  const immune = actor.getConditionImmunities?.() ?? new Set();

  // Conditions, each with its own duration
  const conditions = {};
  for (let [id, formula] of effect.conditions ?? []) {
    if (effect.livingOnly?.includes(id) && !living) continue;
    id = stackedFear(actor, id);
    const condition = pf1.registry.conditions.get(id);
    if (!condition) continue;
    if (immune.has(id) || (id === "sleep" && actor.system.traits?.ci?.total?.has("sleep"))) {
      out.push(`immune to ${condition.name.toLowerCase()}`);
      continue;
    }
    if (formula == null) {
      conditions[id] = true;
      out.push(condition.name.toLowerCase());
      continue;
    }
    const rounds = Math.max(1, (await new Roll(String(formula), rollData).evaluate()).total);
    // Already under it: PF1 keeps the old effect, so a longer new duration replaces it
    const left = remainingSeconds(actor, id);
    if (left === Infinity || left >= rounds * (CONFIG.time.roundTime || 6)) {
      out.push(`already ${condition.name.toLowerCase()}`);
      continue;
    }
    if (left != null) await actor.setConditions({ [id]: false });
    conditions[id] = { duration: timed(rounds) };
    out.push(`${condition.name.toLowerCase()} ${rounds} round${rounds === 1 ? "" : "s"}`);
  }
  if (Object.keys(conditions).length) await actor.setConditions(conditions);
  if (effect.remove?.length) {
    const removed = effect.remove.filter((id) => actor.statuses.has(id));
    if (removed.length) {
      await actor.setConditions(Object.fromEntries(removed.map((id) => [id, false])));
      out.push(`no longer ${removed.join(", ")}`);
    }
  }

  // The spell's buff, at the caster's level and for the spell's duration (unless Nevela applies it)
  const item = caster?.items.get(data.itemId) ?? caster?.items.find((i) => i.type === "spell" && i.name === data.name);
  if (effect.buff && item && nevelaAppliesBuff(item, data.actionId ?? item.defaultAction?.id, effect.buff)) out.push(`${effect.buff} (applied by Nevela's Automation Suite)`);
  else if (effect.buff) {
    const buff = await compendiumBuff(effect.buff);
    buff.system.level = data.cl;
    const duration = spellDuration(item, data.cl);
    if (duration) buff.system.duration = duration;
    const existing = actor.itemTypes.buff.find((b) => b.name === buff.name);
    // Recast by a lower-level caster: the stronger one stays
    if (existing?.isActive && (existing.system.level ?? 0) > data.cl) out.push(`${buff.name} (already at caster level ${existing.system.level})`);
    else {
      if (existing) await existing.update({ "system.active": true, "system.level": data.cl, ...(duration ? { "system.duration": duration } : {}) });
      else await actor.createEmbeddedDocuments("Item", [buff]);
      out.push(buff.name);
    }
  }
  if (effect.changes) {
    const duration = spellDuration(item, data.cl);
    const changes = effect.changes.map((c) => ({ ...c }));
    const existing = actor.itemTypes.buff.find((b) => b.name === data.name);
    if (existing) await existing.update({ "system.active": true, "system.changes": changes, ...(duration ? { "system.duration": duration } : {}) });
    else await actor.createEmbeddedDocuments("Item", [{ name: data.name, type: "buff", img: item?.img, system: { subType: "spell", active: true, level: data.cl, changes, ...(duration ? { duration } : {}) } }]);
    out.push(effect.changes.map((c) => `${c.formula} ${c.target.replace(/^skill\./, "")}`).join(", "));
  }
  if (effect.marker && !effect.buff) {
    const duration = spellDuration(item, data.cl);
    const existing = actor.itemTypes.buff.find((b) => b.name === data.name);
    const marker = { name: data.name, type: "buff", img: item?.img, system: { subType: "spell", active: true, level: data.cl, ...(duration ? { duration } : {}) } };
    if (existing) await existing.update({ "system.active": true, ...(duration ? { "system.duration": duration } : {}) });
    else await actor.createEmbeddedDocuments("Item", [marker]);
    out.push(data.name);
  }

  // A penalty to an ability: the highest one counts ("This penalty does not stack with itself")
  if (effect.penalty) {
    const p = effect.penalty;
    let value = (await new Roll(p.formula, rollData).evaluate()).total;
    if (p.half) value = Math.floor(value / 2);
    const existing = actor.itemTypes.buff.find((b) => b.name === data.name && b.isActive);
    const current = -Number(existing?.system.changes?.[0]?.formula ?? 0);
    const label = `−${value} ${pf1.config.abilities?.[p.target] ?? p.target}`;
    if (existing && current >= value) out.push(`${label} (a higher penalty already applies)`);
    else {
      const duration = spellDuration(item, data.cl);
      const changes = [{ formula: String(-value), target: p.target, type: "untyped" }];
      if (existing) await existing.update({ "system.changes": changes, ...(duration ? { "system.duration": duration } : {}) });
      else await actor.createEmbeddedDocuments("Item", [{ name: data.name, type: "buff", img: item?.img, system: { subType: "spell", active: true, level: data.cl, changes, ...(duration ? { duration } : {}) } }]);
      out.push(label);
    }
  }
  // Ability damage (Chill Touch: 1 Strength)
  for (const [ability, amount] of Object.entries(effect.abilityDamage ?? {})) {
    const current = actor.system.abilities?.[ability]?.damage ?? 0;
    await actor.update({ [`system.abilities.${ability}.damage`]: current + amount });
    out.push(`${amount} ${pf1.config.abilities?.[ability] ?? ability} damage`);
  }
  // A new save on the creature's next turn ends it (Hideous Laughter)
  if (effect.resave && data.save) {
    const buff = actor.itemTypes.buff.find((b) => b.name === data.name);
    const r = effect.resave === true ? {} : effect.resave;
    await buff?.setFlag(MODULE_ID, "resave", { save: { ...data.save, type: r.save ?? data.save.type }, cl: data.cl, every: !!r.every, removes: r.removes ?? [], action: r.action ?? null });
  }
  if (effect.note) out.push(effect.note);
  return out;
}

/**
 * Fear effects stack (Core Rulebook, Conditions): "A shaken character who is made shaken again becomes
 * frightened, and a shaken character who is made frightened becomes panicked instead. A frightened
 * character who is made shaken or frightened becomes panicked instead."
 */
function stackedFear(actor, id) {
  if (!["shaken", "frightened"].includes(id)) return id;
  if (actor.statuses.has("panicked") || actor.statuses.has("frightened")) return "panicked";
  if (actor.statuses.has("shaken")) return id === "shaken" ? "frightened" : "panicked";
  return id;
}

/** Seconds left on a condition the creature already has: null if it hasn't, Infinity if it doesn't end. */
function remainingSeconds(actor, id) {
  if (!actor.statuses.has(id)) return null;
  const effect = actor.effects.find((e) => e.statuses.has(id));
  const { seconds, startTime } = effect?.duration ?? {};
  if (!Number.isFinite(seconds)) return Infinity;
  return seconds - (game.time.worldTime - (startTime ?? 0));
}

/** The spell's duration as a buff duration ({ value, units }), when it's a plain one. */
function spellDuration(item, cl) {
  const d = item?.defaultAction?.duration;
  if (!d?.units || !["round", "minute", "hour", "day"].includes(d.units)) return null;
  const value = evaluate(String(d.value || "1"), item, { cl, item: { level: item.system.level } });
  return value > 0 ? { value: String(value), units: d.units } : null;
}

/* -------------------------------------------- */
/*  PF1 data fixes                              */
/* -------------------------------------------- */

const missiles = (cl) => Math.max(1, Math.min(5, Math.floor((cl + 1) / 2)));

// Magic Missile: one 1d4+1 per missile
Hooks.on("pf1PreDamageRoll", (action, rollData, parts) => {
  if (action.item?.type !== "spell" || action.item.name !== "Magic Missile" || !parts[0]) return;
  const n = missiles(rollData.cl ?? 1);
  if (n > 1) parts[0].base = `${n}d4 + ${n}`;
});

// Cure spells harm undead, inflict spells heal them (from the card's buttons)
const REVERSED = /^(mass )?(cure|inflict) \w+ wounds\b/i;
Hooks.on("pf1ApplyDamage", (actor, options) => {
  const item = options.action?.item ?? options.message?.itemSource;
  if (item?.type !== "spell" || !REVERSED.test(item.name) || !isUndead(actor) || options[`${MODULE_ID}Reversed`]) return;
  options[`${MODULE_ID}Reversed`] = true;
  options.value = -options.value;
});

/* -------------------------------------------- */
/*  The card                                    */
/* -------------------------------------------- */

Hooks.on("renderChatMessagePF", (message, html) => {
  const data = message.getFlag(MODULE_ID, FLAG);
  if (!data?.rows?.length) return;
  const box = document.createElement("div");
  box.className = `${MODULE_ID}-spell-results`;
  box.style.cssText = "margin: 0.4em 0 0.2em; border-top: 1px solid var(--color-border-light-2, #999); padding-top: 0.25em;";
  const head = document.createElement("div");
  head.innerHTML = `<strong>${esc(data.name)}</strong>${data.save ? `: ${SAVE_NAMES[data.save.type]} DC ${data.save.dc}` : ""}${data.pool != null && game.user.isGM ? ` · ${data.pool} HD` : ""}`;
  box.append(head);
  data.rows.forEach((row, index) => box.append(rowElement(message, data, row, index)));
  // Under the targets and the save button, above the card's info tags
  const footer = html.querySelector(".chat-card .card-footer");
  if (footer) footer.before(box);
  else (html.querySelector(".message-content") ?? html).append(box);
});

function rowElement(message, data, row, index) {
  const div = document.createElement("div");
  div.className = `${MODULE_ID}-spell-row`;
  const actor = actorOf(row.uuid);
  const gm = game.user.isGM;
  const good = row.state === "unaffected" || row.state === "resisted" || row.state === "missed" || row.save?.passed;
  div.style.cssText = `margin: 0.2em 0; padding: 0 4px; border-left: 3px solid ${!row.state || row.state === "save" ? "#888" : good ? "#5a5" : "#b33"};`;
  const parts = [];
  if (row.sr) parts.push(`SR check ${row.sr.total}${gm ? ` vs SR ${row.sr.value}` : ""}: ${row.sr.passed ? "overcome" : "resisted"}`);
  if (row.attack) parts.push(`${data.touchRoll ? (data.touchRoll.ranged ? "ranged touch " : "melee touch ") : ""}${row.attack.total}${row.attack.intoMelee ? " (−4 into melee)" : ""}${gm ? ` vs touch AC ${row.attack.ac}` : ""}: ${row.attack.hit ? "hits" : "misses"}`);
  if (row.hitDamage) parts.push(esc(row.hitDamage));
  if (row.state === "unaffected") parts.push(`unaffected${gm && row.why ? ` (${esc(row.why)})` : ""}`);
  const save = saveOf(data, row);
  if (row.save) parts.push(`${SAVE_NAMES[save.type]} ${row.save.total}: ${row.save.passed ? "saved" : "failed"}`);
  if (row.applied?.length) parts.push(row.applied.map(esc).join(", "));
  if (!row.state) parts.push("…");
  div.innerHTML = `<strong>${esc(row.name)}</strong>${parts.length ? `: ${parts.join(" · ")}` : ""}`;
  if (row.state === "save") {
    if (actor?.isOwner) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${SAVE_NAMES[save.type]} save`;
      button.dataset.tooltip = `Roll ${actor.name}'s ${SAVE_NAMES[save.type]} save (DC ${save.dc}); the result is applied`;
      button.style.cssText = "width: auto; line-height: 1.4; margin: 0 0.25em; padding: 0 6px;";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        button.disabled = true;
        rollSave(message, index);
      });
      div.append(" ", button);
    } else div.append(`: awaiting the ${SAVE_NAMES[save.type]} save`);
  }
  return div;
}

registerFootnote((item) => {
  if (item?.type !== "spell" || !spellDef(item)) return null;
  return ["Automated: the card lists each creature it affects (your targets, or those in the template). Spell resistance is checked for you; each creature's save is rolled from its row, and the result is applied (conditions and buffs with their duration)."];
});

export const _test = { FLAG, spellDef, unaffectedBy, penetration, resolveCard };
