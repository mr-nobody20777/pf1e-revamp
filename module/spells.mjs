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
//     misses.
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
import { compendiumBuff, nevelaApplies } from "./buff-grants.mjs";
import { esc, evaluate, isActiveGM, onGmRequest, createQueue } from "./util.mjs";
import { isUndead } from "./channel-energy.mjs";
import { registerFootnote } from "./footnote.mjs";

const FLAG = "spell";
const SAVE_NAMES = { fort: "Fortitude", ref: "Reflex", will: "Will" };
const queue = createQueue("spell results");
// Spells another feature already puts on their targets (buff-grants.mjs)
const HANDLED_ELSEWHERE = new Set(["guidance"]);

/** The spell's entry, or null. */
export function spellDef(item) {
  if (item?.type !== "spell") return null;
  return SPELLS[item.name.toLowerCase().replace(/\s*\((?:mythic|communal)\)$/, "")] ?? null;
}

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
  if (item?.type !== "spell" || HANDLED_ELSEWHERE.has(item.name.toLowerCase())) return;
  const def = spellDef(item);
  const action = item.actions?.get(message.system.action?.id);
  const save = message.system.save?.type ? { type: message.system.save.type, dc: message.system.save.dc } : null;
  const harmless = !!action?.save?.harmless;
  const sr = !!item.system.sr;
  if (!def && !save && !sr) return;
  const caster = ChatMessage.implementation.getSpeakerActor(message.speaker);
  const casterToken = caster?.getActiveTokens()[0]?.document ?? null;
  let targets = [...(message.system.targets ?? [])];
  if (def?.self) targets = [casterToken?.uuid ?? caster?.uuid].filter(Boolean);
  if (def?.affects && casterToken) {
    const ally = (uuid) => tokenOf(uuid)?.disposition === casterToken.disposition;
    targets = targets.filter((uuid) => (def.affects === "allies") === ally(uuid));
  }
  if (!targets.length) return;
  message.updateSource({
    [`flags.${MODULE_ID}.${FLAG}`]: {
      name: item.name,
      save,
      harmless,
      sr,
      attack: ["msak", "rsak"].includes(action?.actionType) && !def?.autoHit,
      damage: !!action?.damage?.parts?.length,
      cl: message.system.config?.cl ?? 0,
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
  if (descriptors.has("mindAffecting") && (ci.has("mindAffecting") || undeadOrConstruct || mindless || types.has("vermin") || types.has("ooze") || types.has("plant"))) return "immune to mind-affecting effects";
  if (descriptors.has("fear") && ci.has("fear")) return "immune to fear";
  if (descriptors.has("death") && ci.has("deathEffects")) return "immune to death effects";
  if (spell.save === "fort" && !spell.harmless && undeadOrConstruct) return "undead and constructs ignore Fortitude effects";
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
  const spell = { name: data.name, descriptors: [...(item?.system.descriptors?.total ?? item?.system.descriptors?.base ?? [])], save: data.save?.type, harmless: data.harmless };
  const attack = message.systemRolls?.attacks?.[0]?.attack ?? null;
  const natural = attack?.dice?.[0]?.total;

  for (const row of data.rows) {
    const actor = actorOf(row.uuid);
    const token = tokenOf(row.uuid);
    if (!actor) {
      row.state = "unaffected";
      continue;
    }
    const willing = data.harmless && (isAlly(data, token) || actor === caster);
    const why = unaffectedBy(def, actor, spell);
    if (why) {
      Object.assign(row, { state: "unaffected", why });
      continue;
    }
    // Spell resistance
    const sr = actor.system.attributes?.sr?.total ?? 0;
    if (data.sr && sr > 0 && !willing) {
      const roll = await new Roll(`1d20 + ${data.cl} + ${penetration(caster)}`).evaluate();
      row.sr = { total: roll.total, value: sr, passed: roll.total >= sr };
      if (!row.sr.passed) {
        row.state = "resisted";
        continue;
      }
    }
    // Touch and ray attacks (an ally accepting a harmless touch needs no roll)
    if (data.attack && attack && !willing) {
      const ac = actor.system.attributes?.ac?.touch?.total ?? 10;
      row.attack = { total: attack.total, ac, hit: natural === 20 || (natural !== 1 && attack.total >= ac) };
      if (!row.attack.hit) {
        row.state = "missed";
        continue;
      }
    }
    row.state = data.save && !willing ? "save" : "apply";
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

  for (const row of data.rows) if (row.state === "apply") await applyRow(row, def, data, caster, { saved: false });
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
    if (!data?.resolved || save.system.subject.save !== data.save?.type) return;
    const { token: tokenId, actor: actorId } = save.speaker;
    const row = data.rows.find((r) => r.state === "save" && ((tokenId && r.uuid.endsWith(`Token.${tokenId}`)) || actorOf(r.uuid)?.id === actorId));
    if (!row) return;
    const roll = save.rolls?.[0];
    const natural = roll?.dice?.[0]?.total;
    const passed = natural === 20 || (natural !== 1 && roll?.total >= data.save.dc);
    row.save = { total: roll?.total, passed };
    const caster = ChatMessage.implementation.getSpeakerActor(card.speaker);
    const item = caster?.items.get(card.system.item?.id) ?? card.itemSource;
    await applyRow(row, spellDef(item), data, caster, { saved: passed });
    await card.setFlag(MODULE_ID, FLAG, data);
  });
});

/** Roll this row's save (its creature's owner or the GM). */
async function rollSave(message, index) {
  const data = message.getFlag(MODULE_ID, FLAG);
  const actor = actorOf(data?.rows?.[index]?.uuid);
  if (!actor?.isOwner || !data.save) return;
  await actor.rollSavingThrow(data.save.type, { dc: data.save.dc, reference: message.uuid });
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
  if (saved && data.damage) applied.push("half damage");
  else if (data.damage) applied.push("full damage");
  if (saved && def && !def.onSave && !data.damage) applied.push("no effect");
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
  for (const [id, formula] of effect.conditions ?? []) {
    if (effect.livingOnly?.includes(id) && !living) continue;
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
    conditions[id] = { duration: { rounds, startTime: game.time.worldTime } };
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
  const item = caster?.items.find((i) => i.type === "spell" && i.name === data.name);
  if (effect.buff && !(item && nevelaApplies(item, item.defaultAction?.id))) {
    const buff = await compendiumBuff(effect.buff);
    buff.system.level = data.cl;
    const duration = spellDuration(item, data.cl);
    if (duration) buff.system.duration = duration;
    const existing = actor.itemTypes.buff.find((b) => b.name === buff.name);
    if (existing) await existing.update({ "system.active": true, "system.level": data.cl, ...(duration ? { "system.duration": duration } : {}) });
    else await actor.createEmbeddedDocuments("Item", [buff]);
    out.push(buff.name);
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
  if (effect.note) out.push(effect.note);
  return out;
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
  if (row.attack) parts.push(`${row.attack.total}${gm ? ` vs touch AC ${row.attack.ac}` : ""}: ${row.attack.hit ? "hits" : "misses"}`);
  if (row.state === "unaffected") parts.push(`unaffected${gm && row.why ? ` (${esc(row.why)})` : ""}`);
  if (row.save) parts.push(`${SAVE_NAMES[data.save.type]} ${row.save.total}: ${row.save.passed ? "saved" : "failed"}`);
  if (row.applied?.length) parts.push(row.applied.map(esc).join(", "));
  if (!row.state) parts.push("…");
  div.innerHTML = `<strong>${esc(row.name)}</strong>${parts.length ? `: ${parts.join(" · ")}` : ""}`;
  if (row.state === "save") {
    if (actor?.isOwner) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${SAVE_NAMES[data.save.type]} save`;
      button.dataset.tooltip = `Roll ${actor.name}'s ${SAVE_NAMES[data.save.type]} save (DC ${data.save.dc}); the result is applied`;
      button.style.cssText = "width: auto; line-height: 1.4; margin: 0 0.25em; padding: 0 6px;";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        button.disabled = true;
        rollSave(message, index);
      });
      div.append(" ", button);
    } else div.append(`: awaiting the ${SAVE_NAMES[data.save.type]} save`);
  }
  return div;
}

registerFootnote((item) => {
  if (!spellDef(item)) return null;
  return ["Automated: the card lists each creature it affects (your targets, or those in the template). Spell resistance is checked for you; each creature's save is rolled from its row, and the result is applied (conditions and buffs with their duration)."];
});

export const _test = { FLAG, spellDef, unaffectedBy, penetration, resolveCard };
