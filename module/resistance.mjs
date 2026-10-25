// Energy resistance and immunity on quick-applied damage. PF1 only applies resistances through its
// Apply Damage dialog; the quick path (applying straight from a chat card) applies the full amount.
// This reduces each damage instance by the target's best matching energy resistance, or ignores it
// entirely if the target is immune to all of its types (or to precision or nonlethal damage it carries),
// and whispers what happened. The dialog path is left alone, since the dialog already handles
// resistances (its precision/nonlethal immunity is corrected below).
//
// Order: the rules don't say whether a save for half or resistance comes first (no FAQ). Following the
// usual table reading and the guideline of applying effects in the order most favorable to the creature,
// halving (PF1's ½ buttons) comes first, then resistance: 20 fire, saved for half, resist 10 → 0, not 5.
// Doubling (ratio above 1) keeps resistance first, which is also the more favorable order.

import { MODULE_ID } from "./const.mjs";
import { esc, wrapMethod } from "./util.mjs";

const SETTING = "quickApplyResistance";
const FROM_DIALOG = `${MODULE_ID}FromDialog`;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING, {
    name: "Apply energy resistance on quick damage",
    hint: "PF1 only applies energy resistance and immunity through its Apply Damage dialog. When on, damage applied straight from a chat card is also reduced by the target's matching resistance or immunity.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
});

// Precision and nonlethal are modifiers on other damage types (sneak attack is "piercing, precision"),
// and immunity to them blocks that damage. PF1 only counts damage as immune when every one of its
// types is the immune type, so it would let typed precision damage through.
const isModifier = (type) => !!pf1.registry.damageTypes.get(type)?.isModifier;
const isImmune = (types, immunities) => types.every((t) => immunities.has(t)) || types.some((t) => isModifier(t) && immunities.has(t));

// Creatures immune to precision damage by their nature, usually not listed as a damage immunity:
// oozes, elementals, incorporeal and amorphous creatures, and some shape-changing spells. Checked when
// the damage is applied, so the attacker doesn't learn it before attacking.
const PRECISION_IMMUNE_FORMS = /^(gaseous form|elemental body (iii|iv)|particulate form)$/i;
export function creatureTypes(actor) {
  const race = actor?.race?.system;
  const set = (field) => new Set([...(race?.[field]?.base ?? []), ...(race?.[field]?.total ?? [])].map((t) => String(t).toLowerCase()));
  return { types: set("creatureTypes"), subtypes: set("creatureSubtypes") };
}
export const isIncorporeal = (actor) => !!actor?.statuses?.has("incorporeal") || creatureTypes(actor).subtypes.has("incorporeal");
export function precisionImmune(actor) {
  if (!actor) return false;
  const { types, subtypes } = creatureTypes(actor);
  if (types.has("ooze") || subtypes.has("elemental") || isIncorporeal(actor)) return true;
  if ((actor.itemTypes?.feat ?? []).some((f) => f.isActive !== false && /^amorphous$/i.test(f.name))) return true;
  return (actor.itemTypes?.buff ?? []).some((b) => b.isActive && PRECISION_IMMUNE_FORMS.test(b.name));
}

Hooks.once("setup", () => {
  wrapMethod("pf1.applications.ApplyDamage.prototype._processImmunities", function (wrapped, target) {
    let immunized = wrapped(target);
    const innate = precisionImmune(target.actor) && !target.di?.some((di) => di.id === "precision") ? [{ id: "precision", active: true }] : [];
    for (const di of [...(target.di ?? []), ...innate]) {
      if (!di.active || !di.id || !isModifier(di.id)) continue;
      for (const instance of target.instances) {
        if (instance.immune || !instance.typeIds?.has(di.id)) continue;
        instance.immune = true;
        immunized += instance.total;
        instance.total = 0;
      }
    }
    return immunized;
  });
});

// Mark damage coming through PF1's dialog, which already accounts for resistance.
Hooks.on("pf1ApplyDamageTargetOptions", (app, target, options) => {
  options[FROM_DIALOG] = true;
  refreshStaleTarget(app, target, options);
});

// PF1's dialog halves each damage instance (floor(value × ratio)) before working out immunity, DR,
// energy resistance and hardness. Code that changes a target's ratio afterwards without recomputing
// (Nevela's Automation Suite calls a `_refreshTargets` method PF1 doesn't have) leaves those reductions
// worked out on the unhalved damage, then halves on top: 6 slashing + 4 fire, halved, against fire
// resistance 10 dealt 1 instead of 3. Recompute such a target with PF1's own method. A target that's
// already current is left as it is, so this does nothing on PF1's normal path.
function refreshStaleTarget(app, target, options) {
  const ratio = target?.ratio ?? 1;
  if (ratio === 1 || typeof app?._refreshTarget !== "function" || !target.uuid) return;
  const stale = (target.instances ?? []).some((i) => Number.isFinite(i.value) && i.total !== Math.floor(i.value * ratio));
  if (!stale) return;
  app._refreshTarget(target.uuid);
  const fresh = app.targets?.get(target.uuid) ?? target;
  options.reduction = fresh.reduction?.total || 0;
  options.instances = fresh.instances.map((i) => {
    const part = new pf1.models.action.DamagePartModel(pf1.utils.deepClone(i));
    for (const key of Object.keys(i)) part[key] = i[key];
    return part;
  });
}

/**
 * How much of the damage each instance carries, adding up to `value`. Uses the instances' own amounts;
 * else, for a card's attack, its damage rolls by type (PF1's quick path drops per-instance amounts);
 * else a lone instance carries everything. Damage not accounted for by the instances is left untyped.
 * Null when the split can't be known.
 */
function amountsOf(options) {
  const instances = options.instances;
  let amounts = instances.map((i) => Math.max(0, i.value ?? 0));
  if (!amounts.some((a) => a > 0)) {
    if (instances.length === 1) return [options.value];
    const attack = options.message?.systemRolls?.attacks?.[options.attackIndex ?? 0];
    const rolls = attack ? [...(attack.damage ?? []), ...(options.critMult ? attack.critDamage ?? [] : [])] : [];
    const key = (types) => [...(types ?? [])].sort().join("|");
    amounts = instances.map((i) => rolls.filter((r) => key(r.options?.damageType) === key(i.types)).reduce((t, r) => t + (r.total ?? 0), 0));
    if (amounts.reduce((t, a) => t + a, 0) !== options.value) return null;
  }
  const rest = options.value - amounts.reduce((t, a) => t + a, 0);
  return rest > 0 ? [...amounts, rest] : amounts;
}

/** Split `total` in proportion to `amounts`, rounding so the shares add up exactly (largest remainders). */
function proportional(amounts, total) {
  const sum = amounts.reduce((t, a) => t + a, 0);
  if (!sum || sum === total) return amounts;
  const exact = amounts.map((a) => (a * total) / sum);
  const shares = exact.map(Math.floor);
  let left = total - shares.reduce((t, a) => t + a, 0);
  for (const i of exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i)) {
    if (left-- <= 0) break;
    shares[i]++;
  }
  return shares;
}

/** The value PF1 must receive so that its own floor(value × ratio) comes out at `damage`. */
function beforeRatio(damage, ratio) {
  if (damage <= 0) return 0;
  let value = Math.ceil(damage / ratio - 1e-9);
  while (Math.floor(value * ratio + 1e-9) < damage) value++;
  return value;
}

Hooks.on("pf1ApplyDamage", (actor, options) => {
  if (!game.settings.get(MODULE_ID, SETTING)) return;
  if (options[FROM_DIALOG] || !(options.value > 0) || !options.instances?.length) return;

  const traits = actor.system.traits ?? {};
  const resistances = traits.eres?.value ?? [];
  const immunities = new Set(traits.di?.total ?? traits.di?.standard ?? []);
  if (precisionImmune(actor)) immunities.add("precision");

  // Halve first (minimum 1, like any halved damage), then split the halved total across the instances
  const ratio = options.ratio ?? 1;
  const halving = ratio > 0 && ratio < 1;
  const total = halving ? Math.max(1, Math.floor(options.value * ratio)) : options.value;
  const amounts = amountsOf(options);
  console.debug(`${MODULE_ID} | quick-apply resistance`, actor.name, {
    value: options.value,
    ratio,
    total,
    instances: options.instances.map((i) => ({ types: [...(i.types ?? [])], value: i.value })),
    amounts,
    resistances,
    immunities: [...immunities],
  });
  if (!amounts) return; // several damage types and no way to tell how much is which: left to the GM

  const shares = proportional(amounts, total);
  let reduced = 0;
  const notes = [];
  options.instances.forEach((instance, i) => {
    const types = [...(instance.types ?? [])];
    const share = shares[i] ?? 0;
    if (!types.length || share <= 0) return;
    if (isImmune(types, immunities)) {
      reduced += share;
      const modifier = types.find((t) => isModifier(t) && immunities.has(t));
      notes.push(`immune to ${modifier ?? types.join("/")} (${share})`);
      return;
    }
    let best = 0;
    for (const res of resistances) if (res.types?.some((t) => t && types.includes(t))) best = Math.max(best, res.amount ?? 0);
    if (best > 0) {
      const r = Math.min(share, best);
      reduced += r;
      notes.push(`${types.join("/")} resistance ${best} (−${r})`);
    }
  });
  if (!reduced) return;

  // PF1 still applies its ratio after this hook, and later hooks may read it to see the target saved:
  // keep the ratio, and give PF1 the value that it turns into the damage actually left
  const left = total - reduced;
  options.value = halving ? beforeRatio(left, ratio) : left;
  const took = halving ? left : Math.floor(left * ratio);

  ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id),
    content: `<p><strong>${esc(actor.name)}</strong> resists ${reduced} damage${halving ? " (after halving)" : ""}: ${esc(notes.join(", "))}. Took ${took}.</p>`,
  });
});

// Halved damage or healing never drops below 1: "if you wind up with a fraction, round down ...
// Exception: Certain rolls, such as damage and hit points, have a minimum of 1." PF1 applies its ratio
// (the ½ buttons, or a ratio typed in the dialog) as floor(value × ratio), which turns 1 into 0; this
// runs after the resistance hook above, so resistance can still reduce damage to nothing.
Hooks.on("pf1ApplyDamage", (actor, options) => {
  const ratio = options.ratio ?? 1;
  if (!(ratio > 0 && ratio < 1) || !options.value) return;
  if (Math.abs(options.value) * ratio < 1) {
    options.value = Math.sign(options.value);
    options.ratio = 1;
  }
});
