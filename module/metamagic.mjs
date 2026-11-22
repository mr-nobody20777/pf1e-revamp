// Metamagic feats (phase 1): Extend, Empower, Maximize, Enlarge, Widen, Heighten, Quicken, Still, Silent (Core
// Rulebook) and Reach, Intensified, Persistent, Selective, Dazing, Elemental, Merciful (Advanced Player's Guide).
//
// Choosing: a spontaneous caster ticks the feats in PF1's casting window, and the spell uses a slot that many
// levels higher; a prepared caster prepares a metamagic copy of the spell in the higher slot ("Prepare with
// metamagic" on the spell sheet), whose feats apply each time it's cast. The choice travels with the casting:
// roll data (rollData.metamagic) for PF1's own rolls, and the card's flag for the module's engines (durations,
// rows, areas, summons). Rulings: DECISIONS.md, "Metamagic".
//
// Rules (the feats' text; FAQ where noted):
//   - Extend: "An extended spell lasts twice as long ... A spell with a duration of concentration, instantaneous,
//     or permanent is not affected." (+1)
//   - Empower: "All variable, numeric effects of an empowered spell are increased by half, including bonuses to
//     those dice rolls. Saving throws and opposed rolls are not affected" (+2). FAQ: on cure moderate wounds "the
//     +50% ... applies to the 2d8 and to the level-based bonus".
//   - Maximize: "All variable, numeric effects ... are maximized ... An empowered, maximized spell gains the
//     separate benefits of each feat: the maximum result plus half the normally rolled result." (+3)
//   - Enlarge: close, medium or long range "increase its range by 100%" (+1). Reach: touch, close or medium one
//     range category longer per step, "+1 for each increase in range category"; melee touch attacks become
//     ranged touch attacks.
//   - Widen: "a burst, emanation, or spread-shaped spell ... Any numeric measurements of the spell's area
//     increase by 100%" (+3). FAQ: lines don't change.
//   - Heighten: "a higher spell level than normal (up to a maximum of 9th level) ... All effects dependent on
//     spell level (such as saving throw DCs ...) are calculated according to the heightened level." (+1 to +9)
//   - Quicken (+4): a swift action; Still (+1): no somatic components; Silent (+1): no verbal components (not
//     bard spells).
//   - Intensified (+1): "increases the maximum number of damage dice by 5 levels".
//   - Persistent (+2): "Whenever a creature ... succeeds on its saving throw against the spell, it must make
//     another saving throw ... If a creature fails this second saving throw, it suffers the full effects".
//   - Selective (+1): an area spell with instantaneous duration; up to the casting ability's modifier of
//     creatures in the area are excluded.
//   - Dazing (+3): "When a creature takes damage from this spell, they become dazed for a number of rounds equal
//     to the original level of the spell. If the spell allows a saving throw, a successful save negates the daze
//     effect. If the spell does not allow a save, the target can make a Will save to negate the daze effect."
//   - Elemental (+1): "replace a spell's normal damage with that energy type" (acid, cold, electricity or fire;
//     splitting the damage half and half is left to the table).
//   - Merciful (+0): "inflict nonlethal damage instead ... of that same type".
//   - Metamagic rods: "The wielder of this rod can cast up to three spells per day that are [altered] as though
//     using the ... feat"; "Normal metamagic rods can be used with spells of 6th level or lower ... lesser ... 3rd
//     level or lower ... greater ... 9th level or lower"; "Possession of a metamagic rod does not confer the
//     associated feat"; "This does not change the spell slot of the altered spell"; "A caster may only use one
//     metamagic rod on any given spell, but it is permissible to combine a rod with metamagic feats possessed by
//     the rod's wielder ... only the feats possessed by the wielder adjust the spell slot". A sorcerer still takes
//     a full-round action, except with a quicken rod. The rod's three uses a day are PF1's uses on the item.
//   - FAQ: a metamagic spell counts as its slot's level for concentration, spell recall and pearls of power;
//     metamagic feats don't work on spell-like abilities.

import { MODULE_ID } from "./const.mjs";
import { esc, wrapMethod } from "./util.mjs";

export const FLAG = "metamagic"; // card flag and prepared copy flag: { feats: [key], heighten, energy, baseName, baseLevel }

export const FEATS = {
  extend: { name: "Extend Spell", adj: 1, prefix: "Extended" },
  empower: { name: "Empower Spell", adj: 2, prefix: "Empowered" },
  maximize: { name: "Maximize Spell", adj: 3, prefix: "Maximized" },
  enlarge: { name: "Enlarge Spell", adj: 1, prefix: "Enlarged" },
  widen: { name: "Widen Spell", adj: 3, prefix: "Widened" },
  quicken: { name: "Quicken Spell", adj: 4, prefix: "Quickened" },
  still: { name: "Still Spell", adj: 1, prefix: "Still" },
  silent: { name: "Silent Spell", adj: 1, prefix: "Silent" },
  reach: { name: "Reach Spell", adj: 1, prefix: "Reach" },
  intensified: { name: "Intensified Spell", adj: 1, prefix: "Intensified" },
  persistent: { name: "Persistent Spell", adj: 2, prefix: "Persistent" },
  selective: { name: "Selective Spell", adj: 1, prefix: "Selective" },
  dazing: { name: "Dazing Spell", adj: 3, prefix: "Dazing" },
  elemental: { name: "Elemental Spell", adj: 1, prefix: "Elemental" },
  merciful: { name: "Merciful Spell", adj: 0, prefix: "Merciful" },
};
const HEIGHTEN = "Heighten Spell";
const ENERGIES = { acid: "acid", cold: "cold", electric: "electricity", fire: "fire" };
const ENERGY_TYPES = new Set(["acid", "cold", "electric", "fire", "sonic"]);

/** The metamagic feats the actor has: { keys: [key], heighten: boolean, energies: [type] }. */
export function knownMetamagic(actor) {
  const feats = actor?.itemTypes?.feat ?? [];
  const has = (name) => feats.filter((f) => f.isActive !== false && f.name.toLowerCase().startsWith(name.toLowerCase()));
  const keys = Object.entries(FEATS).filter(([, f]) => has(f.name).length).map(([k]) => k);
  // Elemental Spell is taken once per energy type: "Elemental Spell (Fire)"
  const energies = has(FEATS.elemental.name).map((f) => Object.keys(ENERGIES).find((k) => new RegExp(`\\b(${k}|${ENERGIES[k]})\\b`, "i").test(f.name))).filter(Boolean);
  return { keys, heighten: has(HEIGHTEN).length > 0, energies: energies.length ? energies : Object.keys(ENERGIES) };
}

// Metamagic rods: "Empower Metamagic Rod, Lesser" (PF1's and Pathfinder 1e Content's items)
const ROD = /^(.+?) Metamagic Rod(?:,\s*(Lesser|Greater))?$/i;
const ROD_CAP = { lesser: 3, normal: 6, greater: 9 };
// A rod's three uses a day: PF1's uses when the item has them set up, else counted here (Pathfinder 1e Content's
// rods have none) and reset when the character rests
const ROD_USED = "rodUsed";
const PF1_USES = (item) => !!item.system.uses?.maxFormula;
export const rodUsesLeft = (item) => (PF1_USES(item) ? item.system.uses.value ?? 0 : 3 - (item.flags?.[MODULE_ID]?.[ROD_USED] ?? 0));
async function spendRod(item) {
  if (PF1_USES(item)) return item.update({ "system.uses.value": Math.max(0, (item.system.uses.value ?? 0) - 1) });
  return item.setFlag(MODULE_ID, ROD_USED, (item.flags?.[MODULE_ID]?.[ROD_USED] ?? 0) + 1);
}
Hooks.on("pf1ActorRest", (actor) => {
  if (!actor?.isOwner) return;
  for (const item of actor.items) if (item.type === "equipment" && ROD.test(item.name) && item.flags?.[MODULE_ID]?.[ROD_USED]) item.unsetFlag(MODULE_ID, ROD_USED);
});

/** The metamagic rods the actor carries for this spell level, with uses left: [{ item, key, cap, uses }]. */
export function rodsOf(actor, spellLevel) {
  const out = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "equipment") continue;
    const m = item.name.match(ROD);
    if (!m) continue;
    const word = m[1].trim().toLowerCase();
    const key = Object.keys(FEATS).find((k) => FEATS[k].name.toLowerCase().startsWith(word));
    if (!key) continue;
    const cap = ROD_CAP[(m[2] ?? "normal").toLowerCase()];
    const uses = rodUsesLeft(item);
    if (spellLevel <= cap) out.push({ item, key, cap, uses });
  }
  return out;
}

/** The slot levels the choice adds. */
export function slotAdjustment(mm) {
  if (!mm) return 0;
  return (mm.feats ?? []).reduce((s, k) => s + (FEATS[k]?.adj ?? 0) * (k === "reach" ? Math.max(1, mm.reachSteps ?? 1) : 1), 0) + (mm.heighten ?? 0);
}
/** "Empowered, Extended" for a card or a prepared copy's name. */
export function describe(mm) {
  const parts = (mm?.feats ?? []).map((k) => (k === "elemental" && mm.energy ? `Elemental (${ENERGIES[mm.energy] ?? mm.energy})` : FEATS[k]?.prefix)).filter(Boolean);
  if (mm?.heighten) parts.push(`Heightened (+${mm.heighten})`);
  return parts.join(", ");
}
const has = (mm, key) => !!mm?.feats?.includes(key);
export const extendFactor = (mm) => (has(mm, "extend") ? 2 : 1);
export const metamagicOf = (message) => message?.getFlag?.(MODULE_ID, FLAG) ?? message?.flags?.[MODULE_ID]?.[FLAG] ?? null;
export const hasMetamagic = has;

const RANGES = { touch: null, close: (cl) => 25 + 5 * Math.floor(cl / 2), medium: (cl) => 100 + 10 * cl, long: (cl) => 400 + 40 * cl };
const STEPS = ["touch", "close", "medium", "long"];
/** A spell's range in feet with Enlarge (double) and Reach (one category longer per step). */
export function metamagicRange(category, cl, mm) {
  let cat = category;
  if (has(mm, "reach")) cat = STEPS[Math.min(3, STEPS.indexOf(cat) + Math.max(1, mm.reachSteps ?? 1))] ?? cat;
  const feet = RANGES[cat]?.(cl) ?? 5;
  return has(mm, "enlarge") && cat !== "touch" ? feet * 2 : feet;
}

/** A prepared metamagic copy's original name (the module's engines match spells by name). */
export const baseSpellName = (item) => item?.flags?.[MODULE_ID]?.[FLAG]?.baseName ?? item?.name ?? "";

/**
 * A formula with Empower and Maximize applied, for the module's own rolls of a spell's variable numbers (the
 * extra damage of later rounds, Sleep's pool, temporary hit points): "the maximum result plus half the normally
 * rolled result" when both.
 */
export function metamagicFormula(formula, mm, rollData = {}) {
  const f = String(formula);
  if (!has(mm, "empower") && !has(mm, "maximize")) return f;
  if (!/d\d/.test(f)) return f; // no random variable: "nor are spells without random variables"
  if (has(mm, "maximize")) {
    const max = new Roll(f, rollData).evaluateSync({ maximize: true }).total;
    return has(mm, "empower") ? `${max} + floor((${f}) / 2)` : String(max);
  }
  return `floor((${f}) * 1.5)`;
}

/* -------------------------------------------- */
/*  Choosing at the casting                     */
/* -------------------------------------------- */

const STATE = `${MODULE_ID}-metamagic`; // the casting's shared data key

/** The choice for this casting: the dialog's, or a prepared copy's. */
function choiceOf(use) {
  const state = use.shared[STATE];
  const copy = use.item?.flags?.[MODULE_ID]?.[FLAG];
  // A copy: the casting's choices never write back to the spell
  const mm = foundry.utils.deepClone(copy ?? state ?? null) ?? null;
  const rod = state?.rod;
  if (!rod) return mm;
  const out = mm ?? { feats: [], heighten: 0 };
  out.feats = [...new Set([...(out.feats ?? []), rod.key])];
  out.rod = rod;
  return out;
}
// No metamagic on spell-like abilities (FAQ): PF1 keeps them in the "spelllike" spellbook
const isSpell = (item) => item?.type === "spell" && item.system?.spellbook !== "spelllike" && !item.system?.atWill;

// The casting window: a Metamagic section with the caster's feats (spontaneous spells; prepared copies carry
// theirs already)
Hooks.on("renderAttackDialog", (app, html) => {
  const item = app.item;
  if (!isSpell(item)) return;
  const copy = item.flags?.[MODULE_ID]?.[FLAG];
  const spellLevel = copy?.baseLevel ?? item.system.level ?? 0;
  const rods = rodsOf(item.actor, spellLevel);
  // The feats are chosen here by spontaneous casters; a prepared copy already has its own
  const feats = item.spellbook?.spontaneous && !copy;
  const known = feats ? knownMetamagic(item.actor) : { keys: [], heighten: false, energies: Object.keys(ENERGIES) };
  if (!known.keys.length && !known.heighten && !rods.length) return;
  const state = (app.shared[STATE] ??= { feats: [], heighten: 0, energy: known.energies[0], rod: null });
  const root = html[0] ?? html;
  const box = document.createElement("div");
  box.className = `${MODULE_ID}-metamagic form-group stacked`;
  box.innerHTML = `<label>Metamagic</label><div class="flexrow" style="flex-wrap:wrap; gap:2px 10px">${known.keys
    .map((k) => `<label class="checkbox" style="flex:0 0 auto"><input type="checkbox" data-mm="${k}" ${state.feats.includes(k) ? "checked" : ""}> ${FEATS[k].prefix} (+${FEATS[k].adj})</label>`)
    .join("")}${known.heighten ? `<label style="flex:0 0 auto">Heighten +<input type="number" data-mm-heighten min="0" max="9" value="${state.heighten}" style="width:3em"></label>` : ""}${known.keys.includes("elemental") ? `<label style="flex:0 0 auto">Energy <select data-mm-energy>${known.energies.map((e) => `<option value="${e}" ${state.energy === e ? "selected" : ""}>${ENERGIES[e]}</option>`).join("")}</select></label>` : ""}</div>
    ${rods.length ? `<label>Metamagic rod <select data-mm-rod><option value="">none</option>${rods.map((r) => `<option value="${r.item.id}" ${state.rod?.id === r.item.id ? "selected" : ""} ${r.uses < 1 ? "disabled" : ""}>${esc(r.item.name)} (${r.uses}/3 left)</option>`).join("")}</select></label>` : ""}
    <p class="hint" data-mm-slot></p>`;
  const anchor = root.querySelector(".flags") ?? root.querySelector("form") ?? root;
  anchor.parentNode ? anchor.parentNode.insertBefore(box, anchor) : root.append(box);
  const slot = () => {
    const level = (item.system.level ?? 0) + slotAdjustment(state);
    if (!feats) return;
    box.querySelector("[data-mm-slot]").textContent = state.feats.length || state.heighten ? `Uses a level ${level} slot${level > 9 ? ": too high to cast" : ""}; casting time a full-round action${state.feats.includes("quicken") ? " (quickened: a swift action)" : ""}.` : "";
  };
  slot();
  for (const input of box.querySelectorAll("input[data-mm]")) {
    input.addEventListener("change", () => {
      const k = input.dataset.mm;
      state.feats = input.checked ? [...new Set([...state.feats, k])] : state.feats.filter((x) => x !== k);
      slot();
    });
  }
  box.querySelector("[data-mm-heighten]")?.addEventListener("change", (ev) => {
    state.heighten = Math.max(0, Math.min(9, Number(ev.currentTarget.value) || 0));
    slot();
  });
  box.querySelector("[data-mm-energy]")?.addEventListener("change", (ev) => (state.energy = ev.currentTarget.value));
  box.querySelector("[data-mm-rod]")?.addEventListener("change", (ev) => {
    const rod = rods.find((r) => r.item.id === ev.currentTarget.value);
    state.rod = rod ? { id: rod.item.id, key: rod.key, name: rod.item.name } : null;
  });
  app.setPosition?.({ height: "auto" });
});

Hooks.once("init", () => {
  // After the dialog: the choice into the roll data; Heighten raises the spell level (DCs) of a spontaneous casting
  wrapMethod("pf1.actionUse.ActionUse.prototype.alterRollData", async function (wrapped, ...args) {
    const result = await wrapped(...args);
    const mm = isSpell(this.item) ? choiceOf(this) : null;
    if (mm && (mm.feats?.length || mm.heighten)) {
      this.shared.rollData.metamagic = mm;
      // A prepared copy's heightened level is already its spell level
      if (mm.heighten && !this.item.flags?.[MODULE_ID]?.[FLAG]) this.shared.rollData.sl = (this.shared.rollData.sl ?? 0) + mm.heighten;
    }
    return result;
  });
  // Selective: once the targets are known, the caster picks the ones the spell leaves out
  wrapMethod("pf1.actionUse.ActionUse.prototype.getTargets", async function (wrapped, ...args) {
    const result = await wrapped(...args);
    const mm = this.shared.rollData?.metamagic;
    if (has(mm, "selective")) mm.excluded = await chooseExcluded(this);
    return result;
  });
  // Widen: a burst, emanation, spread or cone twice as large (not a line)
  wrapMethod("pf1.actionUse.ActionUse.prototype.promptMeasureTemplate", async function (wrapped, ...args) {
    const mm = this.shared.rollData?.metamagic;
    const mt = this.shared.action?.measureTemplate;
    if (!has(mm, "widen") || !mt?.size || mt.type === "ray") return wrapped(...args);
    const size = mt.size;
    mt.size = `(${size}) * 2`;
    try {
      return await wrapped(...args);
    } finally {
      mt.size = size;
    }
  });
});

/**
 * Selective Spell: "a number of targets in the area equal to the ability score modifier used to determine bonus
 * spells ... are excluded from the effects of your spell" (an area spell of instantaneous duration).
 */
async function chooseExcluded(use) {
  const item = use.item;
  const action = use.shared.action;
  if (!action?.measureTemplate?.type || action.duration?.units !== "inst") {
    ui.notifications.info(`${item.name}: Selective Spell needs an area spell with an instantaneous duration.`);
    return [];
  }
  const ability = item.spellbook?.ability ?? "int";
  const limit = Math.max(0, item.actor?.system.abilities?.[ability]?.mod ?? 0);
  const targets = (use.shared.targets ?? []).map((t) => t.document ?? t).filter((t) => t?.actor);
  if (!limit || !targets.length) return [];
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: `Selective Spell: ${item.name}` },
    content: `<p>Exclude up to ${limit} creature${limit === 1 ? "" : "s"} from the spell.</p>${targets.map((t) => `<label class="checkbox" style="display:block"><input type="checkbox" name="ex" value="${t.uuid}"> ${esc(t.name)}</label>`).join("")}`,
    buttons: [{ action: "ok", label: "Cast", default: true, callback: (e, b) => [...b.form.querySelectorAll("input[name=ex]:checked")].map((i) => i.value) }],
    rejectClose: false,
  });
  if ((picked?.length ?? 0) > limit) ui.notifications.warn(`Selective Spell: only the first ${limit} are excluded.`);
  return (picked ?? []).slice(0, limit);
}

/** Intensified Spell: +5 on a caster-level cap that sets a number of dice. */
export const intensify = (formula) =>
  String(formula).replace(/min\(\s*(?:(\d+)\s*,\s*@cl|@cl\s*,\s*(\d+))\s*\)(?=\)?\s*d\d)/g, (m, a, b) => `min(${Number(a ?? b) + 5}, @cl)`);

// PF1's damage rolls: Intensified, Maximize, Empower, Elemental, Merciful. Registered once everything is loaded, so
// it runs after the module's own corrections of a spell's damage (Magic Missile's missiles)
Hooks.once("ready", () => Hooks.on("pf1PreDamageRoll", metamagicDamage));
function metamagicDamage(action, rollData, parts) {
  const mm = rollData?.metamagic;
  if (!mm || action?.item?.type !== "spell" || !parts?.length) return;
  for (const part of parts) {
    let base = String(part.base ?? "");
    if (!base) continue;
    // "the maximum number of damage dice by 5 levels": a cap on the number of dice only (min(10, @cl)d6 or
    // (min(@cl, 10))d6 becomes 15), never a cap on a flat bonus (Cure Light Wounds' + min(5, @cl))
    if (has(mm, "intensified")) base = intensify(base);
    base = metamagicFormula(base, mm, rollData);
    part.base = base;
    const types = part.damageType instanceof Set ? part.damageType : new Set(Array.isArray(part.damageType) ? part.damageType : []);
    if (has(mm, "elemental") && mm.energy && [...types].some((t) => ENERGY_TYPES.has(t))) {
      for (const t of [...types]) if (ENERGY_TYPES.has(t)) types.delete(t);
      types.add(mm.energy);
    }
    if (has(mm, "merciful")) types.add("nonlethal");
    if (part.damageType instanceof Set || types.size) part.damageType = types;
  }
}

// A spontaneous metamagic casting spends the higher slot instead of the spell's own
Hooks.on("pf1PreActionUse", (use) => {
  const mm = use.shared[STATE];
  if (!mm || !isSpell(use.item)) return;
  // A rod must have a use left
  if (mm.rod) {
    const rod = use.item.actor.items.get(mm.rod.id);
    if (!rod || rodUsesLeft(rod) < 1) {
      ui.notifications.warn(`${mm.rod.name} has no uses left today.`);
      return false;
    }
  }
  // Only the caster's own feats raise the slot ("This does not change the spell slot")
  if (use.item.flags?.[MODULE_ID]?.[FLAG]) return;
  const adj = slotAdjustment({ ...mm, feats: mm.feats ?? [] });
  if (!adj) return;
  const item = use.item;
  const book = item.spellbook;
  const level = (item.system.level ?? 0) + adj;
  if (level > 9) {
    ui.notifications.warn(`${item.name}: with metamagic it needs a level ${level} slot, above 9th.`);
    return false;
  }
  const path = `system.attributes.spells.spellbooks.${item.system.spellbook}.spells.spell${level}.value`;
  const left = foundry.utils.getProperty(item.actor, path) ?? 0;
  if (left < 1) {
    ui.notifications.warn(`${item.name}: no level ${level} slot left for the metamagic version.`);
    return false;
  }
  use.shared.rollData.chargeCost = 0; // PF1 would spend the spell's own level
  use.shared[`${STATE}-slot`] = { path, left };
  return true;
});
Hooks.on("pf1PostActionUse", async (use) => {
  const slot = use.shared?.[`${STATE}-slot`];
  if (slot) await use.item.actor.update({ [slot.path]: Math.max(0, slot.left - 1) });
  // One of the rod's three uses today
  const rod = use.shared?.[STATE]?.rod ? use.item.actor.items.get(use.shared[STATE].rod.id) : null;
  if (rod) await spendRod(rod);
});

// The card: the choice in its flags (the module's engines read it) and shown under the spell's name
Hooks.on("pf1PreDisplayActionUse", (use) => {
  const mm = use.shared.rollData?.metamagic;
  if (!mm || !use.shared.chatData) return;
  const original = use.item.flags?.[MODULE_ID]?.[FLAG]?.baseLevel ?? use.item.system.level ?? 0;
  const ownFeats = (mm.feats ?? []).filter((k) => k !== mm.rod?.key || (use.item.flags?.[MODULE_ID]?.[FLAG]?.feats ?? use.shared[STATE]?.feats ?? []).includes(k));
  const data = { ...mm, slot: original + slotAdjustment({ ...mm, feats: ownFeats }), originalLevel: original };
  foundry.utils.setProperty(use.shared.chatData, `flags.${MODULE_ID}.${FLAG}`, data);
});
Hooks.on("renderChatMessageHTML", (message, html) => {
  const mm = metamagicOf(message);
  if (!mm || message.type !== "action") return;
  const header = html.querySelector(".card-header, .item-name, header") ?? html.querySelector(".message-content");
  if (!header || html.querySelector(`.${MODULE_ID}-mm`)) return;
  const tag = document.createElement("div");
  tag.className = `${MODULE_ID}-mm`;
  tag.style.cssText = "font-size:var(--font-size-12, 12px); opacity:0.85";
  const notes = [];
  if (has(mm, "quicken")) notes.push("a swift action");
  if (has(mm, "still")) notes.push("no somatic components");
  if (has(mm, "silent")) notes.push("no verbal components");
  if (has(mm, "reach")) notes.push("one range category longer; melee touch becomes ranged touch");
  if (has(mm, "enlarge")) notes.push("double range");
  tag.innerHTML = `<em>${esc(describe(mm))}</em> (level ${mm.slot} slot${mm.rod ? `; ${esc(mm.rod.name)}` : ""})${notes.length ? `: ${esc(notes.join("; "))}` : ""}`;
  header.after(tag);
});

/* -------------------------------------------- */
/*  Prepared casters: a metamagic copy          */
/* -------------------------------------------- */

/** Prepare a metamagic copy of a spell in the higher slot (a prepared caster's spellbook). */
export async function prepareMetamagic(item, mm) {
  const adj = slotAdjustment(mm);
  const base = item.system.level ?? 0;
  const level = base + adj;
  if (level > 9) return ui.notifications.warn(`${item.name}: with that metamagic it needs a level ${level} slot.`);
  const data = item.toObject();
  delete data._id;
  data.name = `${describe(mm)} ${item.name}`;
  data.system.level = level;
  // PF1's spell level (save DCs) stays the spell's own, raised only by Heighten
  data.system.slOffset = (item.system.slOffset ?? 0) + (mm.heighten ?? 0) - adj;
  data.system.preparation = { ...(data.system.preparation ?? {}), value: 1, max: 1 };
  foundry.utils.setProperty(data, `flags.${MODULE_ID}.${FLAG}`, { ...mm, baseName: baseSpellName(item), baseLevel: base });
  const [copy] = await item.actor.createEmbeddedDocuments("Item", [data]);
  ui.notifications.info(`${copy.name} prepared as a level ${level} spell.`);
  return copy;
}

async function metamagicDialog(item) {
  const known = knownMetamagic(item.actor);
  if (!known.keys.length && !known.heighten) return ui.notifications.warn(`${item.actor.name} has no metamagic feats.`);
  const base = item.system.level ?? 0;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: `Prepare with metamagic: ${item.name}` },
    content: `<p>Level ${base} spell. Each feat uses a higher slot.</p>${known.keys.map((k) => `<label class="checkbox" style="display:block"><input type="checkbox" name="mm" value="${k}"> ${FEATS[k].name} (+${FEATS[k].adj})</label>`).join("")}${known.heighten ? `<label style="display:block">Heighten Spell: + <input type="number" name="heighten" min="0" max="9" value="0" style="width:3em"></label>` : ""}${known.keys.includes("elemental") ? `<label style="display:block">Elemental energy: <select name="energy">${known.energies.map((e) => `<option value="${e}">${ENERGIES[e]}</option>`).join("")}</select></label>` : ""}`,
    buttons: [{ action: "ok", label: "Prepare", default: true, callback: (e, b) => ({ feats: [...b.form.querySelectorAll("input[name=mm]:checked")].map((i) => i.value), heighten: Number(b.form.elements.heighten?.value) || 0, energy: b.form.elements.energy?.value ?? null }) }],
    rejectClose: false,
  });
  if (!result || (!result.feats.length && !result.heighten)) return null;
  return prepareMetamagic(item, result);
}

// The spell sheet's header: "Metamagic" for a spell of a prepared spellbook
Hooks.on("getItemSheetPFHeaderButtons", (sheet, buttons) => {
  const item = sheet.item ?? sheet.document;
  if (!isSpell(item) || !item.actor?.isOwner || item.spellbook?.spontaneous || item.flags?.[MODULE_ID]?.[FLAG]) return;
  buttons.unshift({ label: "Metamagic", class: `${MODULE_ID}-metamagic`, icon: "fas fa-wand-magic-sparkles", onclick: () => metamagicDialog(item) });
});

export const _test = { intensify, FEATS, knownMetamagic, slotAdjustment, describe, metamagicFormula, prepareMetamagic, STATE, rodsOf, rodUsesLeft, choiceOf };
