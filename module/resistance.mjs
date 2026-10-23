// Energy resistance and immunity on quick-applied damage. PF1 only applies resistances through its
// Apply Damage dialog; the quick path (applying straight from a chat card) applies the full amount.
// This reduces each damage instance by the target's best matching energy resistance, or ignores it
// entirely if the target is immune to all of its types, and whispers what happened. The dialog path
// is left alone, since the dialog already handles resistances.

import { MODULE_ID } from "./const.mjs";

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
    const amount = instance.value > 0 ? instance.value : missingAmounts && instances.length === 1 ? options.value : missingAmounts ? options.value - reduced : 0;
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

  reduced = Math.min(reduced, options.value);
  options.value -= reduced;

  ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id),
    content: `<p><strong>${actor.name.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</strong> resists ${reduced} damage: ${notes.join(", ")}. Took ${options.value}.</p>`,
  });
});
