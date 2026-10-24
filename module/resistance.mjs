// Energy resistance and immunity on quick-applied damage. PF1 only applies resistances through its
// Apply Damage dialog; the quick path (applying straight from a chat card) applies the full amount.
// This reduces each damage instance by the target's best matching energy resistance, or ignores it
// entirely if the target is immune to all of its types, and whispers what happened. The dialog path
// is left alone, since the dialog already handles resistances.
//
// Order: the rules don't say whether a save for half or resistance comes first (no FAQ). Following the
// usual table reading and the guideline of applying effects in the order most favorable to the creature,
// halving (PF1's ½ buttons) comes first, then resistance: 20 fire, saved for half, resist 10 → 0, not 5.
// Doubling (ratio above 1) keeps resistance first, which is also the more favorable order.

import { MODULE_ID } from "./const.mjs";
import { esc } from "./util.mjs";

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

// Mark damage coming through PF1's dialog, which already accounts for resistance.
Hooks.on("pf1ApplyDamageTargetOptions", (app, target, options) => {
  options[FROM_DIALOG] = true;
});

Hooks.on("pf1ApplyDamage", (actor, options) => {
  if (!game.settings.get(MODULE_ID, SETTING)) return;
  if (options[FROM_DIALOG] || !(options.value > 0) || !options.instances?.length) return;

  const traits = actor.system.traits ?? {};
  const resistances = traits.eres?.value ?? [];
  const immunities = traits.di?.total ?? traits.di?.standard ?? new Set();

  // PF1's quick path copies instances with toObject(), which keeps their types but drops the
  // per-instance amount. A lone instance gets the whole value; with several and no amounts, each
  // matching resistance applies once against the total.
  const instances = options.instances;
  const missingAmounts = instances.every((i) => !(i.value > 0));

  // Halve before resistance (minimum 1, like any halved damage); PF1 then has no ratio left to apply
  const ratio = options.ratio ?? 1;
  const halving = ratio > 0 && ratio < 1;
  const scale = (n) => (halving ? Math.max(1, Math.floor(n * ratio)) : n);
  const total = scale(options.value);
  console.debug(`${MODULE_ID} | quick-apply resistance`, actor.name, {
    value: options.value,
    instances: instances.map((i) => ({ types: [...(i.types ?? [])], value: i.value })),
    resistances,
    immunities: [...immunities],
  });

  let reduced = 0;
  const notes = [];
  for (const instance of instances) {
    const types = [...(instance.types ?? [])];
    const amount = instance.value > 0 ? scale(instance.value) : missingAmounts && instances.length === 1 ? total : missingAmounts ? total - reduced : 0;
    if (!types.length || amount <= 0) continue;

    if (types.every((t) => immunities.has(t))) {
      reduced += amount;
      notes.push(`immune to ${types.join("/")} (${amount})`);
      continue;
    }

    let best = 0;
    for (const res of resistances) if (res.types?.some((t) => t && types.includes(t))) best = Math.max(best, res.amount ?? 0);
    if (best > 0) {
      const r = Math.min(amount, best);
      reduced += r;
      notes.push(`${types.join("/")} resistance ${best} (−${r})`);
    }
  }
  if (!reduced) return;

  reduced = Math.min(reduced, total);
  options.value = total - reduced;
  if (halving) options.ratio = 1;

  ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id),
    content: `<p><strong>${esc(actor.name)}</strong> resists ${reduced} damage${halving ? " (after halving)" : ""}: ${esc(notes.join(", "))}. Took ${options.value * (options.ratio ?? 1)}.</p>`,
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
