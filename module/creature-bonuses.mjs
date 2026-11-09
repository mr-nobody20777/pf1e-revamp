// Bonuses against kinds of creatures: "+1 on attack rolls against humanoids of the orc and goblinoid
// subtypes" (dwarf Hatred), "+4 dodge bonus to AC against monsters of the giant subtype" (Defensive
// Training), "+1 trait bonus vs evil creatures". PF1 and Pathfinder 1e Content already write these as
// context notes on the items ("+[[1]] Racial vs Humanoids (Orc, Goblinoid)"); PF1 prints them as
// reminders. Here they're added when the creature they name is involved (DECISIONS.md, Creatures):
//   - Attack rolls, weapon damage and combat maneuver checks: against the attack's targets, in the roll
//     window (roll-effects.mjs). With several targets where only some qualify, the roll goes without the
//     bonus and the card shows each qualifying target's own total; its extra damage is added when the
//     damage is applied to that target.
//   - AC and CMD: against the attacker, shown in the target's AC on the attack card (dodge bonuses not in
//     flat-footed AC: "Any situation that denies you your Dexterity bonus also denies you dodge bonuses").
//   - Skill and ability checks: against the single target.
//   - Saving throws: in save-bonuses.mjs, against the effect's source.
// Creatures are matched with creature-types.mjs (template-aware types, subtypes, alignment). A creature
// whose type is unknown, no target, or a note with a condition this can't check ("on opposed checks",
// "to grapple") leaves the bonus Not Applied with the reason; anyone can tick it.
// Some items say to choose the creatures ("{chosen types/subtypes}"): the player chooses once, when the
// item is added or from its footnote, within what the item allows (CHOICES).
// Stacking is PF1's: dodge, racial, untyped and circumstance bonuses stack; other types count only the
// part above an existing bonus of that type. A race and its racial trait often state the same bonus:
// it's counted once.

import { MODULE_ID, MELEE_ATTACKS, RANGED_ATTACKS } from "./const.mjs";
import { esc, evaluate, titleFor, addSearch } from "./util.mjs";
import { registerRollEffect, rollPlan, highestOfType } from "./roll-effects.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { parseCreatures, matchesCreatures, mentionsCreatures, creatureTypes, typeKey } from "./creature-types.mjs";
import { TYPE_WORDS, noteLines } from "./save-bonuses.mjs";
import { isWard } from "./ward.mjs";
import { registerDamageAddition } from "./resistance.mjs";

const CHOICE = "creatureChoice"; // item flag: { types: [], subtypes: [] }
const CARD = "creatureBonuses"; // attack card flag: per-target bonuses when only some targets qualify
const AC = "creatureAC"; // attack card flag: each target's AC bonus against the attacker
const MANEUVERS = ["mcman", "rcman"];

/* -------------------------------------------- */
/*  Reading the notes                           */
/* -------------------------------------------- */

const NOTE = /([+-])?\s*\[\[\s*(.+?)\s*\]\]\s*([A-Za-z]+)?\s*([^\n]*?)\b(?:vs\.?|against)\s+([^\n]+)/i;
// Words allowed between the bonus and "vs": anything else ("slashing weapon damage", "to grapple",
// "on opposed checks") is a condition this can't check
const FRAME = /^(bonus(es)?|penalty|penalties|on|to|all|the|your|any|melee|ranged|weapon|attack|attacks|rolls?|checks?|ac|armor|class|combat|maneuver|cmb|cmd|and|damage|made|skill|it)$/;
const CHOSEN = /\{?\bchosen\b/i;

const parsed = new Map(); // note line → its reading (or null), as notes are read on every roll

/** "+[[1]] Racial vs Humanoids (Orc, Goblinoid)" → { formula, type, part, against, spec, conditional, choice } */
function parseLine(line) {
  if (parsed.has(line)) return parsed.get(line);
  let out = null;
  const m = line.match(NOTE);
  if (m) {
    const typeWord = (m[3] ?? "").toLowerCase();
    const type = TYPE_WORDS[typeWord] ?? "untyped";
    const middle = `${TYPE_WORDS[typeWord] ? "" : typeWord} ${m[4]}`.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
    const against = m[5].replace(/\[\[|\]\]/g, "").split(/[.;](?:\s|$)/)[0].trim();
    const choice = CHOSEN.test(against);
    if (choice || mentionsCreatures(against)) {
      const spec = choice ? null : parseCreatures(against);
      const part = middle.includes("damage") ? "dmg" : "atk";
      out = {
        formula: `${m[1] === "-" ? "-" : ""}(${m[2]})`,
        type,
        part,
        against,
        spec,
        choice,
        conditional: !choice && (!spec || middle.some((w) => !FRAME.test(w))),
      };
    }
  }
  parsed.set(line, out);
  return out;
}

const describe = (spec) => [...spec.types.map(typeLabel), ...spec.subtypes.map(subtypeLabel)].join(" or ");
const typeLabel = (key) => labelFrom(pf1.config.creatureTypes, key);
const subtypeLabel = (key) => labelFrom(pf1.config.creatureSubtypes, key);
function labelFrom(list, key) {
  const entry = Object.entries(list ?? {}).find(([k]) => typeKey(k) === key);
  return entry ? game.i18n.localize(String(entry[1]?.label ?? entry[1])).toLowerCase() : key;
}

/**
 * The actor's bonuses against creatures from notes on these note targets ("attack", "ac", "skill.int"…).
 * Each: { item, value, type, part, against, spec, conditional, needsChoice }.
 */
export function creatureBonuses(actor, noteTargets) {
  const out = [];
  const racialSeen = new Set();
  for (const item of actor?.items ?? []) {
    if (item.isActive === false || !item.system.contextNotes?.length || isWard(item)) continue;
    const racialSource = item.type === "race" || item.system.subType === "racial";
    for (const note of item.system.contextNotes) {
      if (!noteTargets.includes(note.target)) continue;
      for (const line of noteLines(note.text ?? "")) {
        const p = parseLine(line);
        if (!p) continue;
        let spec = p.spec;
        let against = p.against;
        if (p.choice) {
          const chosen = item.getFlag(MODULE_ID, CHOICE);
          spec = chosen ? { types: chosen.types ?? [], subtypes: chosen.subtypes ?? [], alignments: [] } : null;
          if (spec) against = describe(spec);
        }
        const value = evaluate(p.formula, item);
        if (!value) continue;
        const key = `${value}|${p.type}|${p.part}|${spec ? describe(spec) : against}`;
        if (racialSource && racialSeen.has(key)) continue;
        if (racialSource) racialSeen.add(key);
        out.push({ item, value, type: p.type, part: p.part, against, spec, conditional: p.conditional, needsChoice: p.choice && !spec, noteTarget: note.target });
      }
    }
  }
  return out;
}

/* -------------------------------------------- */
/*  Rolls: attacks, checks                      */
/* -------------------------------------------- */

function attackNoteTargets(action) {
  const t = action.actionType;
  if (MANEUVERS.includes(t)) return ["cmb"];
  const out = ["attack"];
  if (MELEE_ATTACKS.includes(t)) out.push("melee");
  if (t === "mwak") out.push("meleeWeapon");
  if (RANGED_ATTACKS.includes(t)) out.push("ranged");
  if (t === "rwak" || t === "twak") out.push("rangedWeapon");
  return out;
}

function checkNoteTargets(actor, roll) {
  if (roll.kind === "ability") return ["allChecks", `${roll.abilityId}Checks`];
  const ids = roll.skillId.split(".");
  const skill = actor.system.skills?.[ids[0]];
  const ability = (ids.length > 1 ? skill?.subSkills?.[ids.at(-1)]?.ability : skill?.ability) ?? null;
  return ["skills", `skill.${ids[0]}`, `skill.${roll.skillId}`, ability && `${ability}Skills`].filter(Boolean);
}

const targeted = () => Array.from(game.user.targets, (t) => ({ name: t.name, uuid: t.document.uuid, actor: t.actor })).filter((t) => t.actor);
const names = (list) => list.map((t) => t.name).join(", ");
const entryId = (b) => `creature-vs.${b.item.id}.${b.part}.${b.noteTarget}.${b.against}`;

/** A roll-window entry for one bonus against these targets. */
function entryFor(actor, roll, b, valueKey, targets) {
  const value = b.value - highestOfType(actor, roll, b.type);
  const base = { id: entryId(b), label: b.item.name, part: b.item.name, type: b.type, [valueKey]: Math.max(value, 0) || b.value, tooltip: `vs ${b.against}` };
  if (b.needsChoice) return { ...base, applies: false, reason: `choose its creatures first (${b.item.name}'s note)` };
  if (b.conditional) return { ...base, applies: false, reason: `only vs ${b.against}: tick it if that applies` };
  if (value <= 0) return { ...base, applies: false, reason: `a higher ${b.type} bonus already applies` };
  if (!targets.length) return { ...base, applies: false, reason: `only vs ${b.against}; no target selected` };
  const results = targets.map((t) => matchesCreatures(t.actor, b.spec));
  if (results.every((r) => r === true)) return { ...base, applies: true };
  const yes = targets.filter((_, i) => results[i] === true);
  if (yes.length && roll.kind === "attack") {
    return { ...base, applies: false, perTarget: true, reason: `added on the card for ${names(yes)} only (not ${names(targets.filter((_, i) => results[i] !== true))})` };
  }
  const unknown = targets.filter((_, i) => results[i] === null);
  if (unknown.length) return { ...base, applies: false, reason: `${names(unknown)}: creature type or alignment unknown` };
  const no = targets.filter((_, i) => results[i] === false);
  return { ...base, applies: false, reason: `${names(no)} ${no.length > 1 ? "aren't" : "isn't"} ${b.against}` };
}

registerRollEffect({
  collect(actor, roll) {
    if (roll.kind === "attack") {
      const action = roll.action;
      const hasDamage = !!action.damage?.parts?.length;
      const targets = targeted();
      return creatureBonuses(actor, attackNoteTargets(action))
        .filter((b) => b.part === "atk" || hasDamage)
        .map((b) => entryFor(actor, roll, b, b.part, targets));
    }
    if (roll.kind === "skill" || roll.kind === "ability") {
      const targets = targeted();
      return creatureBonuses(actor, checkNoteTargets(actor, roll)).map((b) => entryFor(actor, roll, b, "roll", targets));
    }
    return [];
  },
});

/* -------------------------------------------- */
/*  The attack card: several targets            */
/* -------------------------------------------- */

// Only some targets qualify: each one's own total on the card, and its damage added when applied
Hooks.on("pf1PreDisplayActionUse", (use) => {
  const action = use.action;
  if (!action || !use.actor) return;
  const targets = (use.shared.targets ?? []).map((t) => t.document ?? t).filter((t) => t?.actor);
  if (targets.length < 2) return;
  const included = new Set((rollPlan(use.shared.rollData)?.provided ?? []).map((p) => p.id));
  const hasDamage = !!action.damage?.parts?.length;
  const bonuses = creatureBonuses(use.actor, attackNoteTargets(action)).filter((b) => b.spec && !b.conditional && !b.needsChoice && !included.has(entryId(b)) && (b.part === "atk" || hasDamage));
  if (!bonuses.length) return;
  const roll = { kind: "attack", action };
  const out = [];
  for (const token of targets) {
    const t = { uuid: token.uuid, actorUuid: token.actor.uuid, name: token.name, atk: 0, dmg: 0, labels: [] };
    for (const b of bonuses) {
      const results = targets.map((o) => matchesCreatures(o.actor, b.spec));
      if (results.every((r) => r === true) || matchesCreatures(token.actor, b.spec) !== true) continue; // all qualify: the roll window's call
      const value = b.value - highestOfType(use.actor, roll, b.type);
      if (value <= 0) continue;
      t[b.part] += value;
      t.labels.push(`${value > 0 ? "+" : ""}${value} ${b.part === "dmg" ? "damage " : ""}${b.item.name}`);
    }
    if (t.atk || t.dmg) out.push(t);
  }
  if (!out.length) return;
  const totals = use.shared.chatAttacks.map((a) => ({ total: a.attack?.total ?? null }));
  use.shared.chatData[`flags.${MODULE_ID}.${CARD}`] = { targets: out, totals };
});

Hooks.on("renderChatMessagePF", (message, html) => {
  const data = message.getFlag(MODULE_ID, CARD);
  if (!data) return;
  html.querySelectorAll(".chat-attack[data-index]").forEach((el) => {
    const total = data.totals?.[Number(el.dataset.index)]?.total;
    const lines = data.targets.map((t) => {
      const div = document.createElement("div");
      div.className = `${MODULE_ID}-creature-bonus`;
      div.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #5a5;";
      const atk = t.atk && total != null ? `attack ${total + t.atk}` : null;
      const dmg = t.dmg ? `+${t.dmg} damage, added when the damage is applied to ${esc(t.name)}` : null;
      div.innerHTML = `<strong>${esc(t.name)}</strong> (${esc(t.labels.join(", "))}): ${[atk, dmg].filter(Boolean).join("; ")}`;
      return div;
    });
    const table = el.querySelector("table");
    if (lines.length) table ? table.after(...lines) : el.append(...lines);
  });
});

// Added before quick-apply resistance works from the damage's value (resistance.mjs runs additions
// first): the bonus is part of the weapon's damage, multiplied on a critical hit
registerDamageAddition((actor, options) => {
  const data = options.message?.getFlag?.(MODULE_ID, CARD);
  if (!data || !(options.value > 0) || options[`${MODULE_ID}CreatureDamage`]) return;
  const t = data.targets.find((x) => x.actorUuid === actor.uuid || (actor.token && x.uuid === actor.token.uuid));
  if (!t?.dmg) return;
  options[`${MODULE_ID}CreatureDamage`] = true;
  options.value += t.dmg * (options.critMult > 1 ? options.critMult : 1);
});

/* -------------------------------------------- */
/*  The attack card: AC and CMD                 */
/* -------------------------------------------- */

const DODGE = "dodge";

/** A defender's AC (or CMD) bonus against this attacker: { all, dodge, label } or null. */
function defenseBonus(defender, attacker, kind) {
  if (!defender || !attacker) return null;
  let all = 0;
  let dodge = 0;
  const labels = [];
  const best = new Map(); // non-stacking type → highest value
  for (const b of creatureBonuses(defender, [kind])) {
    if (!b.spec || b.conditional || b.needsChoice || matchesCreatures(attacker, b.spec) !== true) continue;
    if (b.type === DODGE) {
      dodge += b.value;
      labels.push(`+${b.value} dodge (${b.item.name})`);
    } else if (STACKING().has(b.type)) {
      all += b.value;
      labels.push(`+${b.value} ${b.type} (${b.item.name})`);
    } else if (b.value > (best.get(b.type)?.value ?? 0)) best.set(b.type, b);
  }
  for (const b of best.values()) {
    const existing = Math.max(0, ...(defender.changes ?? []).filter((c) => c.type === b.type && c.target === kind).map((c) => c.value ?? 0));
    if (b.value > existing) {
      all += b.value - existing;
      labels.push(`+${b.value - existing} ${b.type} (${b.item.name})`);
    }
  }
  return all || dodge ? { all, dodge, label: labels.join(", ") } : null;
}
const STACKING = () => new Set(pf1.config.stackingBonusTypes ?? ["untyped", "dodge", "racial", "circumstance"]);

// Snapshot when the attack card is created, so the card keeps what applied at the time
Hooks.on("preCreateChatMessage", (message) => {
  if (message.type !== "action") return;
  const targets = message.system.targets ?? [];
  if (!targets.length) return;
  const attacker = ChatMessage.implementation.getSpeakerActor(message.speaker);
  if (!attacker) return;
  const actionType = message.itemSource?.actions?.get?.(message.system.action?.id)?.actionType;
  const kind = MANEUVERS.includes(actionType) ? "cmd" : "ac";
  const bonuses = {};
  for (const uuid of targets) {
    const bonus = defenseBonus(fromUuidSync(uuid)?.actor, attacker, kind);
    if (bonus) bonuses[uuid.replaceAll(".", "_")] = { ...bonus, kind };
  }
  if (Object.keys(bonuses).length) message.updateSource({ [`flags.${MODULE_ID}.${AC}`]: bonuses });
});

Hooks.on("renderChatMessagePF", (message, html) => {
  const bonuses = message.getFlag(MODULE_ID, AC);
  if (!bonuses) return;
  for (const targetEl of html.querySelectorAll(".attack-targets .target[data-uuid]")) {
    const bonus = bonuses[targetEl.dataset.uuid.replaceAll(".", "_")];
    if (!bonus) continue;
    // PF1 shows these values only to the GM and the target's owner (data-gm-sensitive-uuid)
    for (const valueEl of targetEl.querySelectorAll(`.${bonus.kind} .value`)) {
      const flatFooted = !!valueEl.closest(".flatFooted");
      const add = bonus.all + (flatFooted ? 0 : bonus.dodge);
      const base = parseInt(valueEl.textContent);
      if (!add || !Number.isFinite(base)) continue;
      valueEl.textContent = base + add;
      valueEl.dataset.tooltip = `${valueEl.dataset.tooltip ? `${valueEl.dataset.tooltip} · ` : ""}${base} ${bonus.label}${flatFooted && bonus.dodge ? " (no dodge bonus when flat-footed)" : ""}`;
    }
  }
});

/* -------------------------------------------- */
/*  Reminder notes already added                */
/* -------------------------------------------- */

// PF1 still prints the notes on the attack card; mark the ones whose bonus is in the roll
Hooks.on("pf1PreDisplayActionUse", (use) => {
  const plan = rollPlan(use.shared.rollData);
  const labels = (plan?.provided ?? []).filter((p) => String(p.id).startsWith("creature-vs.")).map((p) => p.label);
  if (labels.length) use.shared.chatData[`flags.${MODULE_ID}.creatureApplied`] = [...new Set(labels)];
});

Hooks.on("renderChatMessagePF", (message, html) => {
  const labels = message.getFlag(MODULE_ID, "creatureApplied");
  if (!labels?.length) return;
  for (const tag of html.querySelectorAll(".chat-attack .tag")) {
    const source = (tag.dataset.tooltip ?? "").replace(/^[^:]*:\s*/, "");
    if (!labels.includes(source) || !mentionsCreatures(tag.textContent)) continue;
    tag.classList.add(`${MODULE_ID}-applied`);
    tag.dataset.tooltip = `${tag.dataset.tooltip ?? ""} · already added to this roll`;
    tag.prepend("✓ ");
  }
});

/* -------------------------------------------- */
/*  Choosing the creatures                      */
/* -------------------------------------------- */

const OUTSIDER_OR_HUMANOID = ["humanoid", "outsider"];
// What each item lets the player choose, from its text
const CHOICES = {
  // "Choose two subtypes of humanoids or outsiders or one creature type other than humanoid or outsider."
  hatred: {
    text: "Choose two subtypes of humanoids or outsiders, or one creature type other than humanoid or outsider.",
    slots: 2,
    options: () => [...typeOptions().filter((o) => !OUTSIDER_OR_HUMANOID.includes(o.key)), ...subtypeOptions()],
    validate: (picked) => {
      const types = picked.filter((o) => o.kind === "type");
      if (types.length === 1 && picked.length === 1) return null;
      if (!types.length && picked.length === 2) return null;
      return "Choose two subtypes, or one type on its own.";
    },
  },
  // "Choose one subtype of humanoid."
  "defensive training, lesser": { text: "Choose one subtype of humanoid.", slots: 1, options: () => subtypeOptions(), validate: (p) => (p.length === 1 ? null : "Choose one subtype.") },
  // "Choose a humanoid subtype that is not your own from the following list: dwarf, elf, gnome, halfling, or human."
  "vengeful (ah)": {
    text: "Choose a humanoid subtype that is not your own: dwarf, elf, gnome, halfling or human.",
    slots: 1,
    options: (actor) => {
      const own = creatureTypes(actor).subtypes;
      return subtypeOptions().filter((o) => ["dwarf", "elf", "gnome", "halfling", "human"].includes(o.key) && !own.has(o.key));
    },
    validate: (p) => (p.length === 1 ? null : "Choose one subtype."),
  },
};

const typeOptions = () => Object.keys(pf1.config.creatureTypes ?? {}).map((k) => ({ kind: "type", key: typeKey(k), label: typeLabel(typeKey(k)) }));
const subtypeOptions = () => Object.keys(pf1.config.creatureSubtypes ?? {}).map((k) => ({ kind: "subtype", key: typeKey(k), label: subtypeLabel(typeKey(k)) })).sort((a, b) => a.label.localeCompare(b.label));
const hasChoiceNote = (item) => (item.system?.contextNotes ?? []).some((n) => CHOSEN.test(n.text ?? ""));
const choiceRule = (item) => (hasChoiceNote(item) ? CHOICES[item.name.toLowerCase()] ?? null : null);

/** Ask which creatures the item is against. */
export async function promptChoice(item) {
  const rule = choiceRule(item);
  if (!rule) return;
  const options = rule.options(item.actor);
  const current = item.getFlag(MODULE_ID, CHOICE);
  const chosenKeys = [...(current?.types ?? []).map((k) => `type:${k}`), ...(current?.subtypes ?? []).map((k) => `subtype:${k}`)];
  const select = (i) => `<select name="pick${i}"><option value="">${i ? "(none)" : "Choose…"}</option>${["type", "subtype"].map((kind) => {
    const list = options.filter((o) => o.kind === kind);
    return list.length ? `<optgroup label="${kind === "type" ? "Types" : "Subtypes"}">${list.map((o) => `<option value="${kind}:${o.key}" ${chosenKeys[i] === `${kind}:${o.key}` ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</optgroup>` : "";
  }).join("")}</select>`;
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: titleFor(`${item.name}: creatures`, item.actor) },
    content: `<p>${esc(rule.text)}</p>${Array.from({ length: rule.slots }, (_, i) => select(i)).join("")}`,
    render: (event, dialog) => dialog.element.querySelectorAll("select").forEach(addSearch),
    buttons: [
      { action: "ok", label: "Choose", default: true, callback: (event, button) => [...button.form.querySelectorAll("select")].map((s) => s.value).filter(Boolean) },
      { action: "cancel", label: "Later" },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(picked)) return;
  const list = [...new Set(picked)].map((v) => options.find((o) => `${o.kind}:${o.key}` === v)).filter(Boolean);
  const problem = rule.validate(list);
  if (problem) return ui.notifications.warn(problem), promptChoice(item);
  await item.setFlag(MODULE_ID, CHOICE, { types: list.filter((o) => o.kind === "type").map((o) => o.key), subtypes: list.filter((o) => o.kind === "subtype").map((o) => o.key) });
  refreshFootnotes(item);
}

Hooks.on("createItem", (item, options, userId) => {
  if (userId === game.user.id && item.actor && !options.pf1eRevampNoPrompt && choiceRule(item) && !item.getFlag(MODULE_ID, CHOICE)) promptChoice(item);
});

/* -------------------------------------------- */
/*  Footnote                                    */
/* -------------------------------------------- */

const ROLL_WORDS = { attack: "attack rolls", melee: "melee attack rolls", meleeWeapon: "melee weapon attacks", ranged: "ranged attack rolls", rangedWeapon: "ranged weapon attacks", cmb: "combat maneuver checks", ac: "AC", cmd: "CMD" };

registerFootnote((item) => {
  if (!item.actor || !item.system?.contextNotes?.length) return null;
  const rule = choiceRule(item);
  const notes = item.system.contextNotes.flatMap((n) => noteLines(n.text ?? "").map((line) => ({ target: n.target, p: parseLine(line) }))).filter((x) => x.p);
  if (!notes.length && !rule) return null;
  const content = [];
  const auto = notes.filter((x) => !x.p.conditional || x.p.choice);
  if (auto.length) {
    const where = [...new Set(auto.map((x) => (x.p.part === "dmg" ? "damage" : ROLL_WORDS[x.target] ?? (x.target.startsWith("skill") || x.target.endsWith("Skills") ? "skill checks" : x.target.endsWith("Checks") ? "ability checks" : null))).filter(Boolean))];
    if (where.length) content.push(`Added automatically to ${where.join(", ")} against the creatures it names (the target, or the attacker for AC).`);
  }
  if (rule) {
    const chosen = item.getFlag(MODULE_ID, CHOICE);
    content.push(chosen ? ` Chosen: ${esc(describe({ types: chosen.types ?? [], subtypes: chosen.subtypes ?? [] }))}.` : " Its creatures haven't been chosen yet.");
    if (item.isOwner) content.push(footnoteButton(chosen ? "Change…" : "Choose…", "Choose the creatures this applies against", () => promptChoice(item)));
  }
  return content.length ? content : null;
});

export const _test = { parseLine, defenseBonus, entryId };
