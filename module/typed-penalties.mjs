// Typed penalties stack as the rules say. Rules map: fundamentals > penalty, stacking. "Bonuses and
// penalties stack with each other, so a penalty can cancel a bonus"; of two penalties of the same type, only
// the worst applies. PF1 keeps the single highest change of each type: a −1 morale penalty is dropped next
// to a +4 morale bonus, and of −1 and −2 morale it keeps −1 (on sheet totals the result even depends on the
// order the changes are applied). Untyped penalties and stacking types (dodge, circumstance, racial) are
// unaffected. Ruling 2026-11-17: corrected by default, with a world setting to leave PF1's math alone.
//
// Sheet totals (saves, skills, AC, ability scores: everything PF1 adds into the actor) are corrected in
// ItemChange.applyChange; attack and damage rolls in roll-effects.mjs (PF1 calls its own getHighestChanges
// there, which can't be wrapped), using pullPenalties below.

import { MODULE_ID } from "./const.mjs";
import { wrapMethod } from "./util.mjs";

const SETTING = "typedPenalties";
let on = true;
export const typedPenaltiesOn = () => on;

let stackingSet = null; // PF1's stacking types (read once: applyChange runs for every change of every actor)
const stackingTypes = () => (stackingSet ??= new Set(pf1.config.stackingBonusTypes ?? ["untyped", "dodge", "racial", "circumstance"]));
/** A penalty whose type doesn't stack with itself (morale, luck, enhancement...). */
const typedPenalty = (c, stacking = stackingTypes()) => c?.operator !== "set" && Number.isFinite(c?.value) && c.value < 0 && !stacking.has(c.type ?? "untyped");

/** The worst penalty of each type among these. */
function worstPerType(penalties) {
  const worst = new Map();
  for (const c of penalties) if (!worst.has(c.type) || c.value < worst.get(c.type).value) worst.set(c.type, c);
  return [...worst.values()];
}

/** PF1's highest-of-each-type, with typed penalties counted as the rules say (when the setting is on). */
export function stackHighest(changes) {
  const highest = pf1.documents.actor.changes.getHighestChanges;
  if (!on) return highest(changes, { ignoreTarget: true });
  const stacking = stackingTypes();
  const penalties = changes.filter((c) => typedPenalty(c, stacking));
  return [...highest(changes.filter((c) => !penalties.includes(c)), { ignoreTarget: true }), ...worstPerType(penalties)];
}

/**
 * For an attack or damage roll: take the typed penalties out of PF1's change list (before PF1 keeps the highest
 * of each type) and return the worst of each type among `all`, to add as their own parts.
 */
export function pullPenalties(changes, all = changes, actor = null) {
  if (!on || !Array.isArray(changes)) return [];
  // Attack and damage changes get their value only when PF1 applies them, just after this hook: evaluate now
  for (const c of new Set([...changes, ...all])) if (!Number.isFinite(c.value) && actor && c.operator !== "set") c.applyChange?.(actor);
  const stacking = stackingTypes();
  const worst = worstPerType(all.filter((c) => typedPenalty(c, stacking))); // before splicing: `all` can be `changes`
  for (let i = changes.length - 1; i >= 0; i--) if (typedPenalty(changes[i], stacking)) changes.splice(i, 1);
  return worst;
}
/** A formula part for a penalty pulled above: "-2[Bane]". */
export const penaltyPart = (c) => `${c.value}[${String(c.flavor ?? c.parent?.name ?? "Penalty").replace(/[[\]]/g, "")}]`;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING, {
    name: "Typed penalties stack as the rules say",
    hint: "PF1 keeps only the highest change of each type, so a typed penalty (a −1 morale penalty) is lost next to a bonus of the same type, and of two such penalties the milder one counts. On: a penalty applies alongside bonuses, and of two penalties of the same type the worst applies. Off: PF1's own math.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });
  // Items are prepared before setup: wrap now (the setting's value is read on ready, below, and at init it's
  // already stored for the world)
  try {
    on = game.settings.get(MODULE_ID, SETTING);
  } catch {
    on = true;
  }
  if (!on) return;

  // Sheet totals: a typed penalty bypasses PF1's highest-bonus tracking; the worst one of each type applies
  const worst = new WeakMap(); // the actor's changeOverrides (new each preparation) → Map("target|type" → worst so far)
  wrapMethod("pf1.components.ItemChange.prototype.applyChange", function (wrapped, actor, targets = null, ...rest) {
    const result = wrapped(actor, targets, ...rest);
    // Only a typed penalty needs anything (checked after PF1 has worked out the value: most changes stop here)
    if (!(this.value < 0) || this.operator !== "add" || !actor?.changeOverrides || stackingTypes().has(this.type ?? "untyped")) return result;
    let map = worst.get(actor.changeOverrides);
    if (!map) worst.set(actor.changeOverrides, (map = new Map()));
    for (const t of targets ?? this.getTargets(actor)) {
      const add = actor.changeOverrides[t]?.add;
      const current = foundry.utils.getProperty(actor, t);
      if (!add || typeof current !== "number") continue;
      // What PF1 just applied: nothing when a bonus of this type was already counted (its record is above 0),
      // else the whole penalty ("use higher value only" against none)
      const applied = add[this.type] > 0 ? 0 : this.value;
      const key = `${t}|${this.type}`;
      const sofar = map.get(key) ?? 0;
      foundry.utils.setProperty(actor, t, current - applied + Math.min(0, this.value - sofar));
      map.set(key, Math.min(sofar, this.value));
      const ability = t.match(/^system\.abilities\.([a-zA-Z0-9]+)\.(?:total|penalty|base)$/)?.[1];
      if (ability) {
        const a = actor.system.abilities[ability];
        a.mod = pf1.utils.getAbilityModifier(a.total, { damage: a.damage, penalty: a.penalty });
      }
    }
    return result;
  });
});
