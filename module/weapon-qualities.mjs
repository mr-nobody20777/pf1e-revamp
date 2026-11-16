// Weapon qualities (on-hit riders, phase 4a): the magic weapon special abilities that change a weapon's
// damage, critical range or alignment. PF1 has no field for them (its help says to type a flaming
// weapon's 1d6 into the action's damage), so they're read from the weapon's name ("+1 Flaming Burst
// Longsword", "+1 Undead Bane Longsword") or chosen in the weapon's Qualities window, which wins over the
// name. Rulings: DECISIONS.md, "Weapon qualities".
//
// Rules (Core Rulebook and Ultimate Equipment, verbatim where quoted):
//   - Flaming, frost, shock, corrosive: "an extra 1d6 points of fire [cold, electricity, acid] damage on a
//     successful hit"; on and off "upon command" (a row in the roll window). Extra dice are never
//     multiplied on a critical hit; energy resistance applies to each energy type on its own.
//   - Flaming burst, icy burst, shocking burst, corrosive burst: function as the base quality, and "an
//     extra 1d10 points of fire damage on a successful critical hit. If the weapon's critical multiplier
//     is 3, add an extra 2d10 ... if the multiplier is 4, add an extra 3d10". "Even if the flaming ability
//     is not active, the weapon still deals its extra fire damage on a successful critical hit."
//   - Thundering: "an extra 1d8 points of sonic damage on a successful critical hit" (2d8 at ×3, 3d8 at
//     ×4). Its "DC 14 Fortitude save or be deafened permanently" comes with the hit effects (phase 4b).
//   - Holy, unholy, axiomatic, anarchic: the weapon is good [evil, lawful, chaotic] "and thus bypasses the
//     corresponding damage reduction"; "an extra 2d6 points of damage against all creatures of evil [good,
//     chaotic, lawful] alignment". Untyped: energy resistance doesn't reduce it. The negative level on a
//     wielder of the opposed alignment is left as a note.
//   - Bane: "Against a designated foe, the weapon's enhancement bonus is +2 better than its actual bonus.
//     It also deals an extra 2d6 points of damage against such foes." Humanoid and outsider foes name one
//     subtype.
//   - Keen: "doubles the threat range of a weapon. Only piercing or slashing melee weapons can be keen ...
//     doesn't stack with any other effects that expand the threat range" (an expansion already on the roll,
//     from Roll Bonuses' Improved Critical or keen edge, is left as it is).
//   - Vicious: "an extra 2d6 points of damage to the opponent and 1d6 points of damage to the wielder"
//     whenever it strikes; the wielder's 1d6 is applied once the module can tell the attack hit, else by a
//     button on the card, as for natural-attack riders.
//   - Merciful: "an extra 1d6 points of damage, but all damage it deals is nonlethal damage"; suppressed on
//     command (lethal damage, no extra die): unticking its row.
// The extra dice apply to each arrow of Manyshot (they aren't precision damage). When the action already
// has the die typed in (PF1's suggested setup), the module doesn't add its own.

import { MODULE_ID, MELEE_ATTACKS, ATTACK_ACTIONS } from "./const.mjs";
import { esc, titleFor, addSearch, dealDamage, restoreDamage, rollTotal, isActiveGM, wrapMethod } from "./util.mjs";
import { registerRollEffect, rollPlan } from "./roll-effects.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { parseCreatures, matchesCreatures, typeKey } from "./creature-types.mjs";
import { hitOf } from "./natural-riders.mjs";

const FLAG = "weaponQualities"; // item flag: { list?: [ids], bane?: { types, subtypes } }; card flag: { vicious }
const WEAPONS = new Set(["weapon", "attack"]);
const ENERGY_NAME = { fire: "fire", cold: "cold", electric: "electricity", acid: "acid", sonic: "sonic" };

// Every quality the Qualities window offers; `later` ones are recorded but not automated yet
const QUALITIES = {
  flaming: { label: "Flaming", re: /\bflaming\b/i, energy: "fire" },
  frost: { label: "Frost", re: /\bfrost\b/i, energy: "cold" },
  shock: { label: "Shock", re: /\bshock\b/i, energy: "electric" },
  corrosive: { label: "Corrosive", re: /\bcorrosive\b/i, energy: "acid" },
  flamingBurst: { label: "Flaming Burst", re: /\bflaming burst\b/i, base: "flaming", crit: "1d10", energy: "fire" },
  icyBurst: { label: "Icy Burst", re: /\bicy burst\b/i, base: "frost", crit: "1d10", energy: "cold" },
  shockingBurst: { label: "Shocking Burst", re: /\bshocking burst\b/i, base: "shock", crit: "1d10", energy: "electric" },
  corrosiveBurst: { label: "Corrosive Burst", re: /\bcorrosive burst\b/i, base: "corrosive", crit: "1d10", energy: "acid" },
  thundering: { label: "Thundering", re: /\bthundering\b/i, crit: "1d8", energy: "sonic" },
  holy: { label: "Holy", re: /\bholy\b/i, against: "evil", aligned: "good" },
  unholy: { label: "Unholy", re: /\bunholy\b/i, against: "good", aligned: "evil" },
  axiomatic: { label: "Axiomatic", re: /\baxiomatic\b/i, against: "chaotic", aligned: "lawful" },
  anarchic: { label: "Anarchic", re: /\banarchic\b/i, against: "lawful", aligned: "chaotic" },
  bane: { label: "Bane", re: /\bbane\b/i },
  keen: { label: "Keen", re: /\bkeen\b/i },
  vicious: { label: "Vicious", re: /\bvicious\b/i },
  merciful: { label: "Merciful", re: /\bmerciful\b/i },
  wounding: { label: "Wounding", re: /\bwounding\b/i, later: true },
  disruption: { label: "Disruption", re: /\bdisruption\b/i, later: true },
  vorpal: { label: "Vorpal", re: /\bvorpal\b/i, later: true },
  brilliantEnergy: { label: "Brilliant Energy", re: /\bbrilliant energy\b/i, later: true },
  ghostTouch: { label: "Ghost Touch", re: /\bghost[\s-]touch\b/i, later: true },
  seeking: { label: "Seeking", re: /\bseeking\b/i, later: true },
  speed: { label: "Speed", re: /\bspeed\b/i, later: true },
  furious: { label: "Furious", re: /\bfurious\b/i, later: true },
  defending: { label: "Defending", re: /\bdefending\b/i, later: true },
};
// A burst functions as its base quality ("Flaming Burst" names flaming too): qualitiesOf adds the base

/* -------------------------------------------- */
/*  Reading the weapon                          */
/* -------------------------------------------- */

/** The designated foe in a name ("+1 Undead Bane Longsword", "Orc-Bane Greataxe"), or null. */
function baneFromName(name) {
  const before = name.toLowerCase().match(/([a-z' -]+?)[\s-]+bane\b/)?.[1];
  if (!before) return null;
  const words = before.split(/[\s-]+/).filter(Boolean);
  for (const n of [2, 1]) {
    if (words.length < n) continue;
    const spec = parseCreatures(words.slice(-n).join(" "));
    if (spec && !spec.alignments.length) return { types: spec.types, subtypes: spec.subtypes };
  }
  return null;
}

/** The weapon's qualities: { ids: Set, fromName, bane: { types, subtypes } | null }, or null for other items. */
export function qualitiesOf(item) {
  if (!item || !WEAPONS.has(item.type)) return null;
  const flag = item.getFlag?.(MODULE_ID, FLAG) ?? null;
  const fromName = !Array.isArray(flag?.list);
  const ids = new Set(fromName ? Object.keys(QUALITIES).filter((id) => QUALITIES[id].re.test(item.name ?? "")) : flag.list.filter((id) => QUALITIES[id]));
  for (const id of [...ids]) if (QUALITIES[id].base) ids.add(QUALITIES[id].base);
  const bane = ids.has("bane") ? flag?.bane ?? (fromName ? baneFromName(item.name ?? "") : null) : null;
  return { ids, fromName, bane };
}

const labelOf = (v) => game.i18n.localize(typeof v === "string" ? v : v?.label ?? "");
const typeName = (key) => labelOf(Object.entries(pf1.config.creatureTypes ?? {}).find(([k]) => typeKey(k) === key)?.[1]) || key;
const subtypeName = (key) => labelOf(Object.entries(pf1.config.creatureSubtypes ?? {}).find(([k]) => typeKey(k) === key)?.[1]) || key;
/** "undead", "humanoid (orc)", "orc" */
export const foeText = (spec) => {
  if (!spec) return "";
  const types = spec.types.map(typeName).join(" or ");
  const subs = spec.subtypes.map(subtypeName).join(" or ");
  return (types && subs ? `${types} (${subs})` : types || subs).toLowerCase();
};

const typesOf = (part) => [...(part?.types ?? [])];
/** Is this die already typed into the action (PF1's suggested setup for a flaming weapon)? */
const typedIn = (action, prop, formula, type) => (action?.damage?.[prop] ?? []).some((p) => String(p.formula ?? "").replace(/\s+/g, "") === formula && typesOf(p).includes(type));
/** Keen works only on piercing or slashing melee weapons. */
const keenWorks = (action) => MELEE_ATTACKS.includes(action?.actionType) && (action.damage?.parts ?? []).some((p) => typesOf(p).some((t) => t === "piercing" || t === "slashing"));

/* -------------------------------------------- */
/*  The roll window                             */
/* -------------------------------------------- */

/** Applies when every target is of the kind: { applies, reason }. */
function against(spec, what) {
  const targets = [...game.user.targets].map((t) => t.actor).filter(Boolean);
  if (!targets.length) return { applies: false, reason: "no target selected" };
  const results = targets.map((a) => matchesCreatures(a, spec));
  if (results.every((r) => r === true)) return { applies: true };
  if (results.includes(null)) return { applies: false, reason: `a target's ${spec.alignments.length ? "alignment" : "creature type"} isn't known` };
  return { applies: false, reason: targets.length > 1 && results.some(Boolean) ? `only some targets are ${what}` : `the target isn't ${what}` };
}

registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "attack") return [];
    const { action } = roll;
    const q = qualitiesOf(action.item);
    if (!q?.ids.size || !action.damage?.parts?.length) return [];
    const out = [];
    const entry = (id, fields) => out.push({ id: `wq-${id}`, label: QUALITIES[id].label, type: "untyped", showIn: ["dmg"], applies: true, perArrow: true, ...fields });
    for (const id of ["flaming", "frost", "shock", "corrosive"]) {
      const type = QUALITIES[id].energy;
      if (q.ids.has(id) && !typedIn(action, "nonCritParts", "1d6", type)) entry(id, { dice: { dmg: "1d6" }, damageTypes: [type], tooltip: `+1d6 ${ENERGY_NAME[type]} on a hit. It works on command: untick it while it's off.` });
    }
    for (const id of ["flamingBurst", "icyBurst", "shockingBurst", "corrosiveBurst", "thundering"]) {
      const { crit, energy, label } = QUALITIES[id];
      if (!q.ids.has(id) || typedIn(action, "critParts", crit, energy)) continue;
      const die = crit.slice(1);
      entry(id, { critDamage: [{ formula: crit, types: [energy], label }], valueText: `+${crit} ${ENERGY_NAME[energy]} on a critical hit`, tooltip: `On a critical hit: ${crit} ${ENERGY_NAME[energy]} at ×2, 2${die} at ×3, 3${die} at ×4.` });
    }
    for (const id of ["holy", "unholy", "axiomatic", "anarchic"]) {
      if (!q.ids.has(id)) continue;
      const foe = QUALITIES[id].against;
      entry(id, { dice: { dmg: "2d6" }, tooltip: `+2d6 against ${foe} creatures`, ...against({ types: [], subtypes: [], alignments: [foe] }, foe) });
    }
    if (q.ids.has("bane")) {
      const label = q.bane ? `Bane (${foeText(q.bane)})` : "Bane";
      const applies = q.bane ? against({ ...q.bane, alignments: [] }, foeText(q.bane)) : { applies: false, reason: "choose the designated foe in the weapon's Qualities window" };
      entry("bane", { label, type: "enh", atk: 2, dmg: 2, dice: { dmg: "2d6" }, showIn: ["atk", "dmg"], partLabel: { atk: label, dmg: label }, valueText: "+2, +2d6 damage", tooltip: "Against the designated foe: the enhancement bonus is +2 better, and +2d6 damage", ...applies });
    }
    if (q.ids.has("vicious")) entry("vicious", { dice: { dmg: "2d6" }, tooltip: "+2d6 to the opponent, and 1d6 to the wielder on each hit" });
    if (q.ids.has("merciful")) entry("merciful", { dice: { dmg: "1d6" }, valueText: "+1d6, nonlethal", tooltip: "+1d6, and all the weapon's damage is nonlethal. Untick it to suppress it (lethal damage, no extra die)." });
    return out;
  },
});

/* -------------------------------------------- */
/*  Keen, merciful, vicious                     */
/* -------------------------------------------- */

const planned = (rollData, id) => !!rollPlan(rollData)?.provided?.some((p) => p.id === `wq-${id}`);

// Keen: the threat range doubles (19–20 → 17–20, 18–20 → 15–20), unless something already expanded it
Hooks.on("pf1PreAttackRoll", (action, config, rollData, rollOptions) => {
  if (!ATTACK_ACTIONS.includes(action.actionType) || action.item?.isBroken || !qualitiesOf(action.item)?.ids.has("keen") || !keenWorks(action)) return;
  const base = action.ability?.critRange || 20;
  if (!rollOptions.critical || rollOptions.critical < base) return;
  rollOptions.critical = 21 - 2 * (21 - rollOptions.critical);
});

Hooks.on("pf1PreDisplayActionUse", (use) => {
  const rollData = use.shared?.rollData;
  if (!rollData || !use.shared.chatAttacks?.length) return;
  // Merciful: all its damage is nonlethal (the card's apply buttons read this)
  if (planned(rollData, "merciful")) foundry.utils.setProperty(use.shared.chatData, "system.config.nonlethal", true);
  if (planned(rollData, "vicious")) {
    use.shared.chatData[`flags.${MODULE_ID}.${FLAG}`] = {
      vicious: { attacker: use.actor.uuid, target: use.shared.targets?.length === 1 ? use.shared.targets[0].document.uuid : null, applied: {} },
    };
  }
});

/** Vicious's 1d6 to the wielder for attack `index` (or "undo"). Returns the line for the card. */
export async function viciousDamage(message, index, undo = false) {
  const data = message.getFlag(MODULE_ID, FLAG)?.vicious;
  const wielder = fromUuidSync(data?.attacker);
  if (!wielder) return null;
  const current = data.applied?.[index];
  let entry;
  if (undo) {
    if (!current || current.undone) return null;
    await restoreDamage(wielder, current.lost);
    entry = { ...current, undone: true };
  } else {
    if (current) return null;
    const total = await rollTotal("1d6");
    entry = { total, lost: await dealDamage(wielder, total, []) };
  }
  if (message.isOwner) await message.update({ [`flags.${MODULE_ID}.${FLAG}.vicious.applied.${index}`]: entry });
  return entry;
}

// The wielder's 1d6 on each hit the module can see (the active GM's client)
Hooks.on("createChatMessage", async (message) => {
  if (!isActiveGM()) return;
  const data = message.getFlag(MODULE_ID, FLAG)?.vicious;
  if (!data?.target) return;
  const attacks = message.systemRolls?.attacks ?? [];
  for (let i = 0; i < attacks.length; i++) {
    const hit = hitOf(message, i, data.target);
    if (hit.known && hit.hit) await viciousDamage(message, i);
  }
});

function cardButton(label, tooltip, onClick) {
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

Hooks.on("renderChatMessagePF", (message, html) => {
  const data = message.getFlag(MODULE_ID, FLAG)?.vicious;
  if (!data) return;
  const wielder = fromUuidSync(data.attacker);
  const canAct = (game.user.isGM || !!wielder?.isOwner) && message.isOwner;
  (message.systemRolls?.attacks ?? []).forEach((attack, i) => {
    const el = html.querySelector(`.chat-attack[data-index="${i}"]`);
    if (!el || !attack?.attack) return;
    const done = data.applied?.[i];
    const div = document.createElement("div");
    div.className = `${MODULE_ID}-vicious`;
    div.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #a85;";
    div.innerHTML = `<strong>Vicious:</strong> ${done ? `${esc(wielder?.name ?? "the wielder")} took ${done.total}${done.undone ? " — undone" : ""}` : "1d6 to the wielder if it hits"}`;
    if (canAct && !done) div.append(cardButton("Apply", "The attack hit: 1d6 damage to the wielder", () => viciousDamage(message, i)));
    if (canAct && done && !done.undone) div.append(cardButton("Undo", "Give the wielder back the damage", () => viciousDamage(message, i, true)));
    const table = el.querySelector("table");
    table ? table.after(div) : el.append(div);
  });
});

// Holy, unholy, axiomatic and anarchic weapons count as that alignment against DR, in PF1's damage math
Hooks.once("setup", () => {
  wrapMethod("pf1.applications.ApplyDamage.prototype._evaluateAttack", function (wrapped, ...args) {
    const result = wrapped(...args);
    for (const id of qualitiesOf(this.options?.action?.item)?.ids ?? []) if (QUALITIES[id].aligned) this.materials?.add(QUALITIES[id].aligned);
    return result;
  });
});

/* -------------------------------------------- */
/*  The Qualities window                        */
/* -------------------------------------------- */

const OUTSIDER_OR_HUMANOID = new Set(["humanoid", "outsider"]);

/** Choose the weapon's qualities (and a bane weapon's designated foe). */
export async function chooseQualities(item) {
  const q = qualitiesOf(item);
  if (!q) return;
  const named = Object.keys(QUALITIES).filter((id) => QUALITIES[id].re.test(item.name));
  const types = Object.keys(pf1.config.creatureTypes ?? {}).map((k) => [typeKey(k), typeName(typeKey(k))]).sort((a, b) => a[1].localeCompare(b[1]));
  const subtypes = Object.keys(pf1.config.creatureSubtypes ?? {}).map((k) => [typeKey(k), subtypeName(typeKey(k))]).sort((a, b) => a[1].localeCompare(b[1]));
  const foeType = q.bane?.types?.[0] ?? "";
  const foeSub = q.bane?.subtypes?.[0] ?? "";
  const boxes = Object.entries(QUALITIES)
    .map(([id, d]) => `<label data-label="${esc(d.label.toLowerCase())}" style="display:block"><input type="checkbox" name="q" value="${id}" ${q.ids.has(id) ? "checked" : ""}> ${esc(d.label)}${d.later ? ' <span style="opacity:0.6">(not automated yet)</span>' : ""}</label>`)
    .join("");
  const content = `
    <p>${named.length ? `Read from the name: ${esc(named.map((id) => QUALITIES[id].label).join(", "))}.` : "The name names no qualities."} What's ticked here is used instead of the name.</p>
    <input type="search" name="filter" placeholder="Search…" style="width:100%">
    <div style="max-height:260px; overflow-y:auto; columns:2; margin:0.5em 0">${boxes}</div>
    <fieldset><legend>Bane: designated foe</legend>
      <select name="baneType"><option value="">Type…</option>${types.map(([k, l]) => `<option value="${k}" ${k === foeType ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      <select name="baneSubtype"><option value="">(no subtype)</option>${subtypes.map(([k, l]) => `<option value="${k}" ${k === foeSub ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      <p style="opacity:0.8; margin:0.25em 0 0">Humanoids and outsiders: pick one subtype.</p>
    </fieldset>`;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: titleFor(`${item.name}: weapon qualities`, item.actor) },
    position: { width: 460 },
    content,
    render: (event, dialog) => {
      const root = dialog.element;
      root.querySelectorAll("select").forEach(addSearch);
      root.querySelector("input[name=filter]")?.addEventListener("input", (e) => {
        const text = e.target.value.trim().toLowerCase();
        root.querySelectorAll("label[data-label]").forEach((l) => (l.style.display = !text || l.dataset.label.includes(text) ? "block" : "none"));
      });
    },
    buttons: [
      {
        action: "save",
        label: "Save",
        default: true,
        callback: (event, button) => {
          const form = button.form;
          return { list: [...form.querySelectorAll("input[name=q]:checked")].map((i) => i.value), type: form.elements.baneType.value, subtype: form.elements.baneSubtype.value };
        },
      },
      { action: "name", label: "Use the name" },
      { action: "cancel", label: "Cancel" },
    ],
    rejectClose: false,
  });
  if (result === "name") {
    await item.unsetFlag(MODULE_ID, FLAG);
    return refreshFootnotes(item);
  }
  if (!result || typeof result !== "object") return;
  if (result.list.includes("bane") && OUTSIDER_OR_HUMANOID.has(result.type) && !result.subtype) {
    ui.notifications.warn("A humanoid or outsider bane names one subtype.");
    return chooseQualities(item);
  }
  const bane = result.type || result.subtype ? { types: result.type ? [result.type] : [], subtypes: result.subtype ? [result.subtype] : [] } : null;
  await item.setFlag(MODULE_ID, FLAG, { list: result.list, bane });
  refreshFootnotes(item);
}

// A Qualities button in the weapon sheet's header
Hooks.on("getItemSheetPFHeaderButtons", (app, buttons) => {
  if (!WEAPONS.has(app.item?.type) || !app.item.isOwner) return;
  buttons.unshift({ label: "Qualities", class: `${MODULE_ID}-weapon-qualities`, icon: "fa-solid fa-wand-sparkles", onclick: () => chooseQualities(app.item) });
});

registerFootnote((item) => {
  const q = qualitiesOf(item);
  if (!q?.ids.size) return null;
  const shown = [...q.ids].filter((id) => ![...q.ids].some((o) => QUALITIES[o].base === id)); // "Flaming Burst", not also "Flaming"
  const names = shown.map((id) => (id === "bane" && q.bane ? `Bane (${foeText(q.bane)})` : QUALITIES[id].label));
  const notes = [];
  const later = shown.filter((id) => QUALITIES[id].later);
  if (later.length) notes.push(`${later.map((id) => QUALITIES[id].label).join(", ")}: not automated yet.`);
  if (q.ids.has("bane") && !q.bane) notes.push("Bane: choose the designated foe.");
  if (q.ids.has("keen") && item.defaultAction && !keenWorks(item.defaultAction)) notes.push("Keen works only on piercing or slashing melee weapons.");
  const text = `Weapon qualities (${q.fromName ? "from the name" : "chosen"}): ${names.join(", ")}. Their damage is added in the roll window.${notes.length ? ` ${notes.join(" ")}` : ""}`;
  return item.isOwner ? [text, footnoteButton("Qualities…", "Choose the weapon's qualities", () => chooseQualities(item))] : [text];
});

export const _test = { QUALITIES, qualitiesOf, baneFromName, keenWorks, FLAG };
