// Effects on a roll: the buffs and conditions PF1 counts on an attack, save or skill check, plus the
// module's situational bonuses (Studied Target, Quarry...), shown in PF1's roll window and changeable
// for that one roll. Design rulings: DECISIONS.md, "Rolls and buffs".
//
//   - Up to a per-player number of effects (setting, default 4) they're listed in the window as chips;
//     above it the window shows their totals and a Manage… button that opens a small window with a row
//     per effect, grouped Attack only / Damage only / Attack and damage (saves and skills: one group),
//     then Not Applied.
//   - Stacking is PF1's own (getHighestChanges). A bonus beaten by a higher one of the same type is
//     Not Applied; it can be ticked only once every bonus beating it is off, and never moves up alone.
//   - Ability-score buffs merge into one row per ability, expanding to their sources.
//   - Conditions are imposed: only the GM can untick them. Everything else anyone can change.
//   - Situational bonuses that don't apply right now (Studied Target with no studied creature
//     targeted) are listed as Not Applied with the reason, and anyone can tick them.
//
// PF1 has already counted its buffs in the roll's totals, so a change is applied as one labeled
// correction ("-2[Buffs: Greater Heroism off, Heroism on]"); situational bonuses are added as their
// own parts. Rolls without a window use the defaults: PF1's totals plus the bonuses that apply.

import { MODULE_ID, ATTACK_ACTIONS } from "./const.mjs";
import { esc } from "./util.mjs";

const KEY = "pf1eRevampRollEffects";
/** rollData key where features that add their own typed bonus to an attack record it: [{ type, value }] */
export const TYPED = "pf1eRevampTypedBonuses";
const SETTING = "rollEffectsInline";
const PART_LABEL = { atk: "Attack", dmg: "Damage", roll: "" };

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING, {
    name: "Buffs listed in roll windows",
    hint: "Up to this many buffs, conditions and situational bonuses are listed right in attack, save, skill and ability-check windows. Above it, the window shows their totals and a Manage… button. 0 always shows the totals.",
    scope: "client",
    config: true,
    type: Number,
    default: 4,
  });
});

/* -------------------------------------------- */
/*  Situational bonuses from other features     */
/* -------------------------------------------- */

const providers = [];

/**
 * Register a situational bonus. `collect(actor, roll)` returns entries for this roll:
 *   { id, label, part, type, atk, dmg, roll, applies, reason, imposed, tooltip }
 * roll is { kind: "attack", action } | { kind: "save", saveId, reference } | { kind: "skill", skillId }
 * | { kind: "ability", abilityId }; `reference` is the UUID of the card the save was rolled from.
 * `part` labels the bonus in the roll formula; atk/dmg (attacks) or roll (other rolls) are its values.
 * Entries that don't apply right now are listed as Not Applied with `reason`. Imposed entries (penalties
 * from gear or rules) can only be turned off by the GM. Values should already allow for the roller's
 * own bonuses of the same type; between providers, only the highest of a type counts.
 */
export function registerRollEffect(provider) {
  providers.push(provider);
}

/* -------------------------------------------- */
/*  Model: what affects this roll               */
/* -------------------------------------------- */

const highest = (changes) => pf1.documents.actor.changes.getHighestChanges(changes, { ignoreTarget: true });
const sum = (changes) => changes.reduce((t, c) => t + (c.value ?? 0), 0);
const signed = (n) => (n < 0 ? `−${-n}` : `+${n}`);

function conditionOf(actor, change) {
  if (change.parent) return null;
  const cond = pf1.registry.conditions.find((c) => c.name === change.flavor);
  return cond && actor.statuses?.has(cond.id) ? cond : null;
}

/** A buff or condition's change (not BAB, ability modifiers, feats or gear). */
function sourceOf(actor, change) {
  if (change.operator !== "add" || !Number.isFinite(change.value) || !change.value) return null;
  if (change.parent?.type === "buff") return { key: change.parent.id, label: change.parent.name, imposed: false };
  const cond = conditionOf(actor, change);
  return cond ? { key: `cond.${cond.id}`, label: cond.name, imposed: true } : null;
}

function damageTargets(action) {
  const context = pf1.const?.actionTypeToContext?.[action.actionType] ?? "damage";
  const targets = [context, action.isRanged ? "rdamage" : "mdamage"];
  if (action.item.subType === "natural") targets.push("ndamage");
  return targets;
}

function rollTargets(actor, roll) {
  if (roll.kind === "ability") return { roll: { targets: ["allChecks", `${roll.abilityId}Checks`], ability: roll.abilityId } };
  if (roll.kind === "save") {
    const ability = actor.system.attributes.savingThrows?.[roll.saveId]?.ability ?? { fort: "con", ref: "dex", will: "wis" }[roll.saveId];
    return { roll: { targets: ["allSavingThrows", roll.saveId], ability } };
  }
  const ids = roll.skillId.split(".");
  const [root, sub] = [ids[0], ids.length > 1 ? ids.at(-1) : null];
  const skill = actor.system.skills?.[root];
  const ability = (sub ? skill?.subSkills?.[sub]?.ability : skill?.ability) ?? null;
  return { roll: { targets: ["skills", `skill.${root}`, `skill.${roll.skillId}`, ability && `${ability}Skills`].filter(Boolean), ability } };
}

/**
 * The highest bonus of a type PF1 already counts on this roll (from gear, feats or buffs); 0 for types
 * that stack. Features adding their own typed bonus (Guidance's competence) add only what's above it.
 */
export function highestOfType(actor, roll, type) {
  if (STACKING().has(type ?? "untyped")) return 0;
  const changes = roll.kind === "attack" ? roll.action.attackSources : actor.changes.filter((c) => rollTargets(actor, roll).roll.targets.includes(c.target));
  return Math.max(0, ...changes.filter((c) => c.type === type && c.operator === "add").map((c) => c.value ?? 0));
}

/** Everything that affects this roll, with PF1's stacking worked out. */
function buildModel(actor, roll) {
  const model = { actor, roll, parts: [], changes: {}, losers: new Set(), entries: new Map(), abilities: [] };
  const entry = (src) => {
    if (!model.entries.has(src.key)) model.entries.set(src.key, { ...src, values: {}, types: new Set(), changes: [] });
    return model.entries.get(src.key);
  };
  const addChanges = (part, changes) => {
    model.parts.push(part);
    model.changes[part] = [];
    for (const change of changes) {
      const src = sourceOf(actor, change);
      if (!src) continue;
      model.changes[part].push({ key: src.key, change });
      const e = entry(src);
      e.values[part] = (e.values[part] ?? 0) + change.value;
      e.types.add(change.type);
      e.changes.push({ part, change });
    }
    const winners = new Set(highest(model.changes[part].map((c) => c.change)));
    for (const { change } of model.changes[part]) if (!winners.has(change)) model.losers.add(change);
  };

  let abilityParts; // ability → the parts its modifier feeds
  if (roll.kind === "attack") {
    const action = roll.action;
    addChanges("atk", action.attackSources);
    addChanges("dmg", action.item.getContextChanges(damageTargets(action)));
    abilityParts = {};
    if (action.ability?.attack) (abilityParts[action.ability.attack] ??= []).push("atk");
    if (action.ability?.damage) (abilityParts[action.ability.damage] ??= []).push("dmg");
  } else {
    const { roll: r } = rollTargets(actor, roll);
    addChanges("roll", actor.changes.filter((c) => r.targets.includes(c.target)));
    abilityParts = r.ability ? { [r.ability]: ["roll"] } : {};
  }

  for (const [ability, parts] of Object.entries(abilityParts)) {
    const sources = [];
    for (const change of actor.changes.filter((c) => c.target === ability)) {
      const src = sourceOf(actor, change);
      if (src) sources.push({ ...src, change });
    }
    if (sources.length) model.abilities.push({ ability, parts, sources });
  }

  // Entries whose every change lost to a higher bonus of the same type are Not Applied
  for (const e of model.entries.values()) {
    e.beaten = e.changes.every(({ change }) => model.losers.has(change));
    e.beaters = new Set();
    if (!e.beaten) continue;
    for (const { part, change } of e.changes) {
      for (const w of model.changes[part]) if (!model.losers.has(w.change) && w.change.type === change.type && w.key !== e.key) e.beaters.add(w.key);
    }
  }

  model.provided = collectProvided(actor, roll);
  return model;
}

const STACKING = () => new Set(pf1.config.stackingBonusTypes ?? ["untyped", "dodge", "racial", "circumstance"]);

/** Situational bonuses for this roll; of several with the same type, only the highest counts. */
function collectProvided(actor, roll) {
  const list = providers.flatMap((p) => p.collect(actor, roll) ?? []).filter(Boolean);
  const stacking = STACKING();
  const worth = (p) => Math.max(p.atk ?? 0, p.dmg ?? 0, p.roll ?? 0);
  for (const p of list) {
    if (!p.applies || stacking.has(p.type ?? "untyped") || worth(p) <= 0) continue;
    const better = list.find((o) => o !== p && o.applies && o.type === p.type && (worth(o) > worth(p) || (worth(o) === worth(p) && list.indexOf(o) < list.indexOf(p))));
    if (better) Object.assign(p, { applies: false, reason: `${better.label} is higher`, beatenBy: better.id });
  }
  return list;
}

/* -------------------------------------------- */
/*  Choices and their effect                    */
/* -------------------------------------------- */

const newState = (model) => ({ off: new Set(), on: new Set(), provided: new Map(model.provided.map((p) => [p.id, !!p.applies])) });

const isIncluded = (model, state, key, change) => !state.off.has(key) && (!model.losers.has(change) || state.on.has(key));

/** The bonuses currently in the roll that beat a Not Applied entry (same part and type, at least as high). */
function blockers(model, state, e) {
  const keys = new Set();
  for (const { part, change } of e.changes) {
    for (const c of model.changes[part]) {
      if (c.key !== e.key && c.change.type === change.type && c.change.value >= change.value && isIncluded(model, state, c.key, c.change)) keys.add(c.key);
    }
  }
  return keys;
}

/** How much the listed effects add to each part right now, and the correction PF1's totals need. */
function compute(model, state) {
  const out = { totals: {}, delta: {}, scoreDelta: {}, changed: [], changedIn: Object.fromEntries(model.parts.map((p) => [p, []])) };
  const note = (text, parts) => {
    out.changed.push(text);
    for (const p of parts) out.changedIn[p]?.push(text);
  };
  for (const part of model.parts) {
    const all = model.changes[part];
    const included = all.filter((c) => isIncluded(model, state, c.key, c.change)).map((c) => c.change);
    out.totals[part] = sum(highest(included));
    out.delta[part] = out.totals[part] - sum(highest(all.map((c) => c.change)));
  }
  for (const a of model.abilities) {
    const all = a.sources.map((s) => s.change);
    const included = a.sources.filter((s) => !state.off.has(s.key)).map((s) => s.change);
    const bonus = sum(highest(all));
    out.scoreDelta[a.ability] = sum(highest(included)) - bonus;
    // The modifier the ability's buffs are worth now, for the totals shown
    const total = model.actor.system.abilities[a.ability]?.total ?? 10;
    const mod = (score) => Math.floor((score - 10) / 2);
    const worth = mod(total + out.scoreDelta[a.ability]) - mod(total - bonus);
    for (const part of a.parts) out.totals[part] = (out.totals[part] ?? 0) + worth;
    a.worth = worth;
  }
  for (const p of model.provided) {
    if (!state.provided.get(p.id)) continue;
    for (const part of model.parts) out.totals[part] = (out.totals[part] ?? 0) + (p[part] ?? 0);
  }
  // Turned off first, then switched on
  for (const e of model.entries.values()) if (state.off.has(e.key) && !e.beaten) note(`${e.label} off`, Object.keys(e.values));
  for (const a of model.abilities) for (const s of a.sources) if (state.off.has(s.key) && !model.entries.has(s.key)) note(`${s.label} off`, a.parts);
  for (const e of model.entries.values()) if (state.on.has(e.key) && e.beaten) note(`${e.label} on`, Object.keys(e.values));
  return out;
}

/** What the roll needs: corrections to PF1's totals and the situational bonuses ticked. */
function planFor(model, state) {
  const c = compute(model, state);
  const label = Object.fromEntries(model.parts.map((p) => [p, `Buffs: ${[...new Set(c.changedIn[p])].join("; ")}`]));
  const abilities = {};
  if (model.roll.kind === "attack") {
    const a = model.roll.action.ability ?? {};
    if (a.attack) abilities.atk = { ability: a.attack, score: c.scoreDelta[a.attack] ?? 0 };
    if (a.damage) abilities.dmg = { ability: a.damage, score: c.scoreDelta[a.damage] ?? 0 };
  } else {
    const ability = model.abilities[0]?.ability;
    if (ability) abilities.roll = { ability, score: c.scoreDelta[ability] ?? 0 };
  }
  const provided = model.provided.filter((p) => state.provided.get(p.id));
  return { delta: c.delta, abilities, label, provided };
}

/** How much an ability modifier moves when the score moves by `score`. */
const modShift = (total, score) => Math.floor((total + score - 10) / 2) - Math.floor((total - 10) / 2);

/** An ability modifier on this attack, after any ability buffs turned off in its roll window. */
export function attackAbilityMod(rollData, ability) {
  const data = rollData.abilities?.[ability] ?? {};
  const change = Object.values(rollData[KEY]?.abilities ?? {}).find((a) => a.ability === ability && a.score);
  return (data.mod ?? 0) + (change ? modShift(data.total ?? 10, change.score) : 0);
}

/** Formula parts for one part of the roll ("atk", "dmg" or "roll"), given the roller's roll data. */
function partsFor(plan, part, rollData) {
  const out = [];
  const abl = plan.abilities[part];
  let correction = plan.delta[part] ?? 0;
  if (abl?.score) {
    const data = rollData.abilities?.[abl.ability] ?? {};
    const shift = modShift(data.total ?? 10, abl.score);
    if (part === "dmg") {
      // PF1 multiplies a positive ability modifier for damage (1½ two-handed, ½ off-hand)
      const mult = rollData.ablMult ?? 1;
      const ablDamage = (m) => (m >= 0 ? Math.floor(m * mult) : m);
      correction += ablDamage((data.mod ?? 0) + shift) - ablDamage(data.mod ?? 0);
    } else correction += shift;
  }
  if (correction) out.push(`${correction}[${plan.label[part] ?? "Buffs"}]`);
  const stacking = STACKING();
  for (const p of plan.provided) {
    let value = p[part] ?? 0;
    // Another feature's bonus of the same type on this roll (True Strike's +20 insight) wins if higher
    if (value > 0 && !stacking.has(p.type ?? "untyped")) {
      const other = Math.max(0, ...(rollData[TYPED] ?? []).filter((t) => t.type === p.type).map((t) => t.value));
      value = Math.max(0, value - other);
    }
    if (value) out.push(`${value}[${p.part ?? p.label}]`);
  }
  return out;
}

/** The plan for a roll made without a window: PF1's totals plus the situational bonuses that apply. */
const defaultPlan = (actor, roll) => {
  const provided = collectProvided(actor, roll).filter((p) => p.applies);
  return { delta: {}, abilities: {}, label: {}, provided };
};

/* -------------------------------------------- */
/*  Display                                     */
/* -------------------------------------------- */

const typeLabel = (types) => [...types].filter((t) => t !== "untyped" && t !== "untypedPerm").map((t) => (game.i18n.localize(pf1.config.bonusTypes?.[t] ?? t) || t).toLowerCase()).join(", ");

function valueText(values, parts) {
  const shown = parts.filter((p) => values[p]);
  if (shown.length === 1 || new Set(shown.map((p) => values[p])).size === 1) return shown.length ? signed(values[shown[0]]) : "";
  return shown.map((p) => `${signed(values[p])} ${PART_LABEL[p].toLowerCase()}`).join(", ");
}

function sectionOf(parts) {
  if (parts.includes("roll")) return "roll";
  if (parts.includes("atk") && parts.includes("dmg")) return "both";
  return parts[0];
}
const SECTIONS = [
  ["atk", "Attack only"],
  ["dmg", "Damage only"],
  ["both", "Attack and damage"],
  ["roll", ""],
];

/** Rows, in display order: { section, key, kind, label, value, type, checked, disabled, note, sub } */
function rows(model, state) {
  const out = [];
  const gm = game.user.isGM;
  const c = compute(model, state);
  for (const e of model.entries.values()) {
    const parts = model.parts.filter((p) => e.values[p]);
    const blocking = e.beaten ? blockers(model, state, e) : new Set();
    const beatersOff = !blocking.size;
    const names = [...(blocking.size ? blocking : e.beaters)].map((k) => model.entries.get(k)?.label).filter(Boolean);
    out.push({
      section: e.beaten && !state.on.has(e.key) ? "na" : sectionOf(parts),
      key: e.key,
      kind: "entry",
      label: e.label,
      value: valueText(e.values, model.parts),
      raw: Math.max(...parts.map((p) => Math.abs(e.values[p]))),
      negative: parts.some((p) => e.values[p] < 0),
      type: typeLabel(e.types),
      checked: e.beaten ? state.on.has(e.key) : !state.off.has(e.key),
      disabled: (e.imposed && !gm) || (e.beaten && !beatersOff),
      imposed: e.imposed,
      note: e.beaten ? (state.on.has(e.key) ? "ticked for this roll" : `${names.join(", ")} ${names.length > 1 ? "are" : "is"} higher`) : "",
      tooltip: e.imposed && !gm ? "A condition: only the GM can turn it off for this roll" : e.beaten && !beatersOff ? `Turn off ${names.join(", ")} first` : "",
    });
  }
  for (const a of model.abilities) {
    const name = pf1.config.abilities[a.ability] ?? a.ability;
    const values = Object.fromEntries(a.parts.map((p) => [p, a.worth]));
    out.push({
      section: sectionOf(a.parts),
      key: `abl.${a.ability}`,
      kind: "ability",
      label: `${name} ${signed(sum(highest(a.sources.filter((s) => !state.off.has(s.key)).map((s) => s.change))))}`,
      value: valueText(values, model.parts) || "+0",
      raw: Math.abs(a.worth) + 0.5,
      negative: a.worth < 0,
      type: "",
      sub: a.sources.map((s) => ({ key: s.key, label: `${s.label} ${signed(s.change.value)} ${typeLabel([s.change.type])}`.trim(), checked: !state.off.has(s.key), disabled: s.imposed && !gm, imposed: s.imposed })),
    });
  }
  for (const p of model.provided) {
    const values = Object.fromEntries(model.parts.map((part) => [part, p[part] ?? 0]));
    const parts = model.parts.filter((part) => p[part]);
    const negative = parts.some((part) => p[part] < 0);
    out.push({
      section: p.applies || state.provided.get(p.id) ? sectionOf(parts) : "na",
      key: p.id,
      kind: "provided",
      label: p.label,
      value: valueText(values, model.parts),
      raw: Math.max(...parts.map((part) => Math.abs(p[part]))),
      negative,
      imposed: !!p.imposed,
      type: p.type && p.type !== "untyped" ? p.type : "",
      checked: !!state.provided.get(p.id),
      disabled: (p.imposed && !gm) || (!!p.beatenBy && !!state.provided.get(p.beatenBy) && !state.provided.get(p.id)),
      note: p.applies ? "" : state.provided.get(p.id) ? "ticked for this roll" : p.reason ?? "",
      tooltip: p.imposed && !gm ? "Only the GM can turn this off for this roll" : p.tooltip ?? "",
    });
  }
  // Bonuses biggest first, then ability rows, then chosen penalties, then imposed ones; Not Applied last
  const rank = (r) => (r.section === "na" ? 4 : r.kind === "ability" ? 1 : r.negative ? (r.imposed ? 3 : 2) : 0);
  out.sort((a, b) => rank(a) - rank(b) || b.raw - a.raw);
  out.totals = c.totals;
  out.changed = c.changed.length > 0;
  return out;
}

function checkbox(r, sub = false) {
  return `<input type="checkbox" data-key="${esc(r.key)}" data-kind="${sub ? "source" : r.kind}" ${r.checked ? "checked" : ""} ${r.disabled ? "disabled" : ""}>`;
}

function summaryText(model, list) {
  const t = list.totals;
  const na = list.filter((r) => r.section === "na").length;
  const parts = model.parts.map((p) => `<strong>${PART_LABEL[p] ? `${PART_LABEL[p]} ` : ""}${signed(t[p] ?? 0)}</strong>`);
  const counts = [`${list.length - na} effect${list.length - na === 1 ? "" : "s"}`, na ? `${na} not applied` : null].filter(Boolean).join(" · ");
  return `${parts.join(" · ")} <span class="${MODULE_ID}-muted">from ${counts}${list.changed ? " · changed for this roll" : ""}</span>`;
}

/** The block inside the roll window: chips up to the threshold, otherwise totals and Manage…. */
function windowBlock(ctx) {
  const list = rows(ctx.model, ctx.state);
  const limit = game.settings.get(MODULE_ID, SETTING);
  const div = document.createElement("div");
  div.className = `form-group ${MODULE_ID}-effects`;
  const label = `<label>Buffs</label>`;
  if (list.length <= limit) {
    div.innerHTML = `${label}<div class="${MODULE_ID}-chips">${list
      .map((r) => {
        const cls = [r.section === "na" ? "na" : "", r.negative ? "neg" : "", r.kind === "ability" ? "abl" : ""].join(" ");
        const tip = [r.type, r.note, r.tooltip].filter(Boolean).join(" · ");
        if (r.kind === "ability") return `<a class="${MODULE_ID}-chip ${cls}" data-action="manage" data-tooltip="${esc(r.sub.map((s) => s.label).join(" · "))}">${esc(r.label)} ▾</a>`;
        return `<label class="${MODULE_ID}-chip ${cls}" data-tooltip="${esc(tip)}">${checkbox(r)}${r.imposed ? "🔒 " : ""}${esc(r.label)} ${esc(r.value)}</label>`;
      })
      .join("")}</div>`;
  } else {
    div.innerHTML = `${label}<div class="${MODULE_ID}-summary"><span>${summaryText(ctx.model, list)}</span><a class="${MODULE_ID}-manage" data-action="manage">Manage…</a></div>`;
  }
  bind(div, ctx);
  return div;
}

class EffectsManager extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: [`${MODULE_ID}-effects-manager`], position: { width: 380, height: "auto" }, window: { resizable: false } };

  constructor(ctx, options = {}) {
    super(foundry.utils.mergeObject(options, { window: { title: `Buffs on this roll: ${ctx.actor.name}` } }));
    this.ctx = ctx;
  }

  async _renderHTML() {
    const { model, state } = this.ctx;
    const list = rows(model, state);
    const row = (r) => {
      const name = `${r.imposed ? "🔒 " : ""}${esc(r.label)}${r.note ? ` <span class="${MODULE_ID}-muted">· ${esc(r.note)}</span>` : ""}`;
      const head = `<tr class="${r.section === "na" ? "na" : ""}" ${r.tooltip ? `data-tooltip="${esc(r.tooltip)}"` : ""}><td>${r.kind === "ability" ? `<a data-action="expand" data-key="${esc(r.key)}">${this.ctx.expanded?.has(r.key) ? "▾" : "▸"}</a>` : checkbox(r)}</td><td>${name}</td><td class="num">${esc(r.value)}</td><td class="${MODULE_ID}-muted">${esc(r.type)}</td></tr>`;
      if (r.kind !== "ability" || !this.ctx.expanded?.has(r.key)) return head;
      return head + r.sub.map((s) => `<tr class="sub" ${s.disabled ? `data-tooltip="A condition: only the GM can turn it off for this roll"` : ""}><td></td><td colspan="3"><label>${checkbox(s, true)} ${s.imposed ? "🔒 " : ""}${esc(s.label)}</label></td></tr>`).join("");
    };
    const sections = [...SECTIONS, ["na", "Not Applied"]]
      .map(([id, title]) => {
        const items = list.filter((r) => r.section === id);
        if (!items.length) return "";
        const total = id !== "na" && model.parts.length > 1 ? ` <span class="${MODULE_ID}-muted">${model.parts.filter((p) => id === "both" || id === p).map((p) => `${PART_LABEL[p].toLowerCase()} ${signed(items.reduce((t, r) => t + (r.checked || r.kind === "ability" ? valueOf(model, r, p) : 0), 0))}`).join(" · ")}</span>` : "";
        return `${title ? `<tr class="head"><th colspan="4">${title}${total}</th></tr>` : ""}${items.map(row).join("")}`;
      })
      .join("");
    return `<p class="${MODULE_ID}-totals">${summaryText(model, list)}</p><table class="${MODULE_ID}-effects-table">${sections}</table>
      <p class="${MODULE_ID}-muted">Changes apply to this roll only.${list.some((r) => r.imposed || r.sub?.some((s) => s.imposed)) ? " 🔒 Conditions: only the GM can turn them off." : ""}</p>`;
  }

  _replaceHTML(html, content) {
    content.innerHTML = html;
    bind(content, this.ctx);
  }
}

/** A row's current worth in one part, for section subtotals. */
function valueOf(model, r, part) {
  if (r.kind === "ability") {
    const a = model.abilities.find((x) => `abl.${x.ability}` === r.key);
    return a?.parts.includes(part) ? a.worth : 0;
  }
  if (r.kind === "provided") return model.provided.find((p) => p.id === r.key)?.[part] ?? 0;
  return model.entries.get(r.key)?.values[part] ?? 0;
}

function bind(root, ctx) {
  root.querySelectorAll("input[data-key]").forEach((box) =>
    box.addEventListener("change", (event) => {
      const { key, kind } = box.dataset;
      const on = box.checked;
      const entry = ctx.model.entries.get(key);
      if (kind === "provided") ctx.state.provided.set(key, on);
      else if (entry?.beaten) on ? ctx.state.on.add(key) : ctx.state.on.delete(key);
      else on ? ctx.state.off.delete(key) : ctx.state.off.add(key);
      // A beaten bonus switched on stays on only while nothing in the roll beats it
      for (const e of ctx.model.entries.values()) if (e.beaten && ctx.state.on.has(e.key) && blockers(ctx.model, ctx.state, e).size) ctx.state.on.delete(e.key);
      event.stopPropagation();
      ctx.update();
    })
  );
  root.querySelectorAll("[data-action=manage]").forEach((a) => a.addEventListener("click", () => ctx.openManager()));
  root.querySelectorAll("[data-action=expand]").forEach((a) =>
    a.addEventListener("click", () => {
      ctx.expanded ??= new Set();
      ctx.expanded.has(a.dataset.key) ? ctx.expanded.delete(a.dataset.key) : ctx.expanded.add(a.dataset.key);
      ctx.manager?.render();
    })
  );
}

/** Context for one roll window: the model, the player's choices, and how to show and apply them. */
function makeContext(actor, roll, { place, apply, owner }) {
  const model = buildModel(actor, roll);
  const ctx = { actor, model, state: newState(model), manager: null };
  ctx.update = () => {
    if (!owner.rendered) return ctx.close();
    apply(planFor(model, ctx.state));
    ctx.redraw();
    ctx.manager?.render();
  };
  ctx.redraw = () => {
    const root = place.root();
    if (!(root instanceof HTMLElement)) return; // the roll window has closed
    const old = root.querySelector(`.${MODULE_ID}-effects`);
    const block = windowBlock(ctx);
    if (old) old.replaceWith(block);
    else place.insert(block);
    owner.setPosition?.({ height: "auto" });
  };
  ctx.openManager = () => {
    ctx.manager ??= new EffectsManager(ctx);
    const pos = owner.position ?? {};
    ctx.manager.render({ force: true, position: { left: (pos.left ?? 100) + (pos.width ?? 400) + 6, top: pos.top ?? 100 } });
  };
  ctx.close = () => ctx.manager?.close();
  return ctx;
}

const isEmpty = (model) => !model.entries.size && !model.abilities.length && !model.provided.length;

/* -------------------------------------------- */
/*  Attacks                                     */
/* -------------------------------------------- */

const attackContexts = new WeakMap(); // AttackDialog → context

Hooks.on("renderAttackDialog", (app, html) => {
  const root = html[0] ?? html;
  const action = app.action;
  const actor = action?.actor;
  if (!actor || !ATTACK_ACTIONS.includes(action.actionType) || !app.rollData) return;
  let ctx = attackContexts.get(app);
  if (!ctx) {
    ctx = makeContext(actor, { kind: "attack", action }, {
      owner: app,
      place: {
        root: () => app.element[0] ?? app.element,
        insert: (block) => {
          const r = app.element[0] ?? app.element;
          (r.querySelector(".form-group.flags") ?? r.querySelector("form")?.lastElementChild)?.before(block);
        },
      },
      apply: (plan) => (app.rollData[KEY] = plan),
    });
    if (isEmpty(ctx.model)) return;
    attackContexts.set(app, ctx);
    app.rollData[KEY] = planFor(ctx.model, ctx.state);
  }
  if (!root.querySelector(`.${MODULE_ID}-effects`)) ctx.redraw();
});

Hooks.on("closeAttackDialog", (app) => attackContexts.get(app)?.close());

// Registered at init, after every module script has loaded, so other features' attack hooks (True
// Strike's +20 insight) run first and their typed bonuses are known
Hooks.once("init", () => {
  Hooks.on("pf1PreAttackRoll", (action, config, rollData, rollOptions, parts) => {
    if (!ATTACK_ACTIONS.includes(action.actionType)) return;
    rollData[KEY] ??= defaultPlan(action.actor, { kind: "attack", action });
    parts.push(...partsFor(rollData[KEY], "atk", rollData));
    delete rollData[TYPED]; // per attack roll: a full attack's next attack starts fresh (no typed damage bonuses yet)
  });

  Hooks.on("pf1PreDamageRoll", (action, rollData, parts) => {
    if (!ATTACK_ACTIONS.includes(action.actionType) || !parts[0]) return;
    const plan = (rollData[KEY] ??= defaultPlan(action.actor, { kind: "attack", action }));
    parts[0].extra.push(...partsFor(plan, "dmg", rollData));
  });
});

/* -------------------------------------------- */
/*  Saves and skill checks                      */
/* -------------------------------------------- */

const pending = new Map(); // actor id → { roll, ctx? } waiting for its roll window
const splitBonus = (text) => (text ?? "").split(/\s*\+\s*/).map((t) => t.trim()).filter(Boolean);

function preActorRoll(kind, idKey) {
  return (actor, rollOptions, id) => {
    const roll = { kind, [idKey]: id, reference: rollOptions.reference ?? null };
    const windowed = !(rollOptions.skipDialog ?? pf1.documents.settings.getSkipActionPrompt());
    if (!windowed) {
      // The default plan has no ability-score changes, so the roll data (costly to build) isn't needed
      (rollOptions.parts ??= []).push(...partsFor(defaultPlan(actor, roll), "roll", {}));
      return;
    }
    pending.set(actor.id, { roll, name: actor.name, actor });
  };
}

Hooks.on("pf1PreActorRollSave", preActorRoll("save", "saveId"));
Hooks.on("pf1PreActorRollSkill", preActorRoll("skill", "skillId"));
Hooks.on("pf1PreActorRollAbility", preActorRoll("ability", "abilityId"));
for (const kind of ["Save", "Skill", "Ability"]) {
  Hooks.on(`pf1ActorRoll${kind}`, (actor) => {
    pending.get(actor.id)?.ctx?.manager?.close();
    pending.delete(actor.id);
  });
}

Hooks.on("renderDialogV2", (app, element) => {
  const input = element.querySelector('input[name="bonus"]');
  if (!input) return;
  const [id, entry] = [...pending.entries()].find(([, e]) => !e.ctx && (app.title ?? "").startsWith(`${e.name}:`)) ?? [];
  if (!entry) return;
  let mine = []; // our parts currently in the Situational Bonus field
  const rollData = entry.actor.getRollData();
  const ctx = makeContext(entry.actor, entry.roll, {
    owner: app,
    place: { root: () => app.element, insert: (block) => input.closest(".form-group").before(block) },
    apply: (plan) => {
      const others = splitBonus(input.value).filter((p) => !mine.includes(p));
      mine = partsFor(plan, "roll", rollData);
      input.value = [...others, ...mine].join(" + ");
    },
  });
  if (isEmpty(ctx.model)) return pending.delete(id);
  entry.ctx = ctx;
  ctx.close = () => {
    pending.delete(id);
    ctx.manager?.close();
  };
  app.addEventListener?.("close", () => ctx.close(), { once: true });
  ctx.update();
});

// Exposed for tests
export const _test = { buildModel, newState, compute, planFor, partsFor, rows };
