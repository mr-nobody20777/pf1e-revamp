// Channel Energy: "a burst that affects all creatures of one type (either undead or living) in a
// 30-foot radius centered on the cleric ... Creatures that take damage from channeled energy receive
// a Will save to halve the damage ... Creatures healed by channel energy cannot exceed their maximum
// hit point total ... A cleric can choose whether or not to include herself in this effect."
//
// PF1's own Use rolls the dice and spends the use (its template prompt is skipped: the burst is
// always centered on the cleric). Then a checklist shows every creature of the affected type within
// 30 ft. Everyone is included; only the cleric can opt out, or, with Selective Channeling, up to
// Cha-modifier other targets. The active GM applies it (players can't change other characters' HP):
// healing goes straight on, harmed creatures roll their Will save and take full or half.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { esc, onGmRequest, classLevel } from "./util.mjs";
import { variantEffect, variantOf, variantsAllowed, chooseVariant, clearVariant, applyVariant, channelBonus, isVariantFeature, VARIANTS } from "./variant-channeling.mjs";

const RADIUS = 30;
const isChannel = (item) => item?.type === "feat" && item.system.tag === "classFeat_channelEnergy";

/** The channel's mode from PF1's action names ("Positive - Heal living", "Negative - Harm living"...). */
function modeOf(action) {
  const name = action.name.toLowerCase();
  return { heal: name.includes("heal"), undead: /heal undead|harm undead/.test(name) };
}

/** Undead by the creature type on its race (PCs and most NPCs carry one); anything else is living. */
export function isUndead(actor) {
  return (actor?.race?._source.system.creatureTypes ?? []).includes("undead");
}

const hasSelectiveChanneling = (actor) => actor.itemTypes.feat.some((f) => /^selective channeling$/i.test(f.name));

/* Blossoming Light (cleric archetype), 3rd level: "when a blossoming light channels energy to harm
   undead, her channeled energy also harms chaotic evil outsiders, worshipers of chaotic evil deities,
   and evil creatures with light sensitivity or light blindness as if they were undead." Worshipers
   can't be told from the sheet (a deity is free text); the other two can. */
function isBlossomingLight(cleric) {
  const font = cleric.itemTypes.feat.find((f) => f.name === "Luminous Font (Blossoming Light)");
  const level = cleric.itemTypes.class.find((c) => c.system.tag === "cleric")?.system.level ?? 0;
  return !!font && level >= 3;
}

function harmedAsUndead(actor) {
  const alignment = actor.system.details?.alignment ?? "";
  const types = actor.race?._source.system.creatureTypes ?? [];
  if (types.includes("outsider") && alignment === "ce") return true;
  return alignment[1] === "e" && actor.items.some((i) => /^light (sensitivity|blindness)\b/i.test(i.name));
}

export function creaturesInBurst(centerToken, undead, { blossoming = false } = {}) {
  return canvas.tokens.placeables
    .filter((t) => t.actor && !t.document.hidden && (isUndead(t.actor) === undead || (blossoming && undead && harmedAsUndead(t.actor))))
    .map((t) => ({ token: t, distance: t === centerToken ? 0 : canvas.grid.measurePath([centerToken.center, t.center]).distance }))
    .filter((c) => c.distance <= RADIUS)
    .sort((a, b) => a.distance - b.distance);
}

// The burst is always centered on the cleric: no template to place
Hooks.on("pf1CreateActionUse", (actionUse) => {
  if (!isChannel(actionUse.item)) return;
  actionUse.shared.useMeasureTemplate = false;
  // PF1's use dialog reads its "Measure Template" box from the use options, ticked unless told otherwise
  if (actionUse.shared.useOptions) actionUse.shared.useOptions.measureTemplate = false;
});

/**
 * @param {Token[]} [targets] Skip the checklist and affect these tokens (macros, tests).
 */
export async function channel(actionUse, { targets = null } = {}) {
  const { actor, item, action } = actionUse;
  const amount = actionUse.shared.chatAttacks?.[0]?.damage?.total ?? 0; // already halved for a variant (pf1PreDamageRoll)
  const dc = actionUse.shared.saveDC;
  const mode = modeOf(action);
  const variant = variantEffect(item, mode);
  const refund = () => item.update({ "system.uses.value": (item.system.uses.value ?? 0) + 1 });

  const clericToken = actor.getActiveTokens()[0];
  if (!clericToken) {
    await refund();
    return ui.notifications.warn(`${actor.name}'s token must be on the scene to channel energy.`);
  }

  const blossoming = !mode.heal && mode.undead && isBlossomingLight(actor);
  const candidates = creaturesInBurst(clericToken, mode.undead, { blossoming });
  const selective = hasSelectiveChanneling(actor);
  const maxExcluded = selective ? Math.max(0, actor.system.abilities.cha.mod) : 0;

  let chosen = targets;
  if (!chosen) {
    const rows = candidates
      .map((c, i) => {
        const self = c.token === clericToken;
        const locked = !self && !selective;
        return `<label style="display:block"><input type="checkbox" name="target" value="${i}" checked ${locked ? "disabled" : ""} ${self ? "" : 'data-other="1"'}>
          ${esc(c.token.name)} <span style="opacity:0.7">(${self ? "you" : `${Math.round(c.distance)} ft`})</span></label>`;
      })
      .join("");
    const who = mode.undead ? "undead" : "living creatures";
    chosen = await foundry.applications.api.DialogV2.wait({
      window: { title: `${action.name}` },
      content: `<p><strong>${esc(action.name)}</strong>: ${mode.heal ? "heals" : "deals"} <strong>${amount}</strong>${variant?.halved ? ` (halved: ${esc(variant.name)} variant)` : ""}${mode.heal ? "" : variant ? `, Will DC ${dc} negates the variant effect` : `, Will DC ${dc} for half`}.</p>
        ${variant ? `<p style="font-size:11px"><strong>${esc(variant.name)}:</strong> ${esc(variant.text)}</p>` : ""}
        <p style="font-size:11px; opacity:0.8">Affects all ${who} within ${RADIUS} ft. You can leave yourself out.
        ${selective ? `Selective Channeling: you may also exclude up to ${maxExcluded} other target(s).` : "Others can only be excluded with Selective Channeling."}
        ${blossoming ? "Blossoming Light: chaotic evil outsiders and evil creatures with light sensitivity or light blindness are included. Worshipers of chaotic evil deities are too; the GM applies those by hand." : ""}</p>
        ${rows || `<p>No ${who} within ${RADIUS} ft.</p>`}`,
      render: (event, dialog) => {
        // Selective Channeling: stop unchecking once the limit is reached
        const boxes = [...dialog.element.querySelectorAll('input[data-other="1"]')];
        for (const box of boxes) {
          box.addEventListener("change", () => {
            const excluded = boxes.filter((b) => !b.checked).length;
            if (excluded > maxExcluded) {
              box.checked = true;
              ui.notifications.warn(`Selective Channeling: at most ${maxExcluded} other target(s) can be excluded.`);
            }
          });
        }
      },
      buttons: [
        {
          action: "channel",
          label: "Channel",
          icon: "fa-solid fa-sun",
          default: true,
          callback: (event, button) => [...button.form.querySelectorAll('input[name="target"]:checked')].map((el) => candidates[el.value].token),
        },
        { action: "cancel", label: "Cancel" },
      ],
      rejectClose: false,
    });
    if (!Array.isArray(chosen)) return refund();
  }

  if (!chosen.length) return;
  // A request to the active GM (players can't change other characters' HP), whispered and deleted once applied:
  // PF1's own card already shows the amount, and saves get their own cards
  return ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    content: `<p><strong>${esc(action.name)}</strong>: applying to ${chosen.length} creature(s)…</p>`,
    flags: {
      [MODULE_ID]: {
        channel: {
          heal: mode.heal, amount, dc, card: actionUse.shared.message?.uuid ?? null, targets: chosen.map((t) => t.document.uuid), label: action.name,
          variant: variant && { ...variant, bonus: channelBonus(classLevel(item, "cleric")), source: actor.name },
        },
      },
    },
  });
}

// Variant channeling halves the roll itself, so PF1's card shows the amount that's actually applied
Hooks.on("pf1PreDamageRoll", (action, rollData, parts) => {
  if (!isChannel(action.item) || !variantEffect(action.item, modeOf(action))?.halved) return;
  for (const part of parts) {
    part.base = `max(1, floor((${[part.base, ...part.extra].join(" + ")}) / 2))`; // halved, but "damage and hit points have a minimum of 1"
    part.extra = [];
  }
});

// item.use({ options: { channelTargets: [tokens] } }) skips the checklist (macros, tests)
Hooks.on("pf1PostActionUse", (actionUse) => {
  if (isChannel(actionUse.item) && actionUse.actor?.isOwner) channel(actionUse, { targets: actionUse.shared.useOptions?.channelTargets ?? null });
});

// The active GM applies healing, rolls the saves and applies damage, then fills in the results
onGmRequest("channel", async (message, data) => {
  if (data.results) return;
  const results = [];
  const variant = data.variant;
  for (const uuid of data.targets) {
    const actor = fromUuidSync(uuid)?.actor;
    if (!actor) continue;
    let text, saved = false;
    if (data.heal) {
      const hp = actor.system.attributes.hp;
      const healed = Math.min(data.amount, Math.max(0, hp.max - hp.value));
      await actor.applyDamage(-data.amount, { forceDialog: false });
      text = healed === 0 ? "already full" : `+${healed}${healed < data.amount ? " (to max)" : ""}`;
    } else {
      const save = await actor.rollSavingThrow("will", { skipDialog: true, reference: data.card ?? undefined, dc: data.dc });
      const total = save?.rolls?.[0]?.total;
      saved = Number.isFinite(total) && total >= data.dc;
      // A variant's damage is already halved: the save negates the extra effect, not more damage
      const damage = saved && !variant ? Math.floor(data.amount / 2) : data.amount;
      await actor.applyDamage(damage, { forceDialog: false });
      text = `${damage} (Will ${total ?? "?"}: ${saved ? "saved" : "failed"})`;
    }
    const extra = variant ? await applyVariant(actor, variant, { bonus: variant.bonus, saved, source: variant.source }) : null;
    results.push({ name: actor.name, text: extra ? `${text}, ${extra}` : text });
  }
  Hooks.callAll(`${MODULE_ID}.channelApplied`, data, results); // macros and tests
  await message.delete();
});

registerFootnote((item) => {
  if (isVariantFeature(item)) return ["Chosen once from Channel Energy (it can't be changed; the GM can reset it there). Channeling halves the healing or damage; Luck's effect is applied automatically, other portfolios' effects are shown in the target list when you channel."];
  if (!isChannel(item)) return null;
  const content = [
    "Automated: Use rolls the channel and lists every creature of the affected type within 30 ft (centered on you, no template). Healing is applied (up to max HP); harmed creatures roll their Will save and take full or half. You can leave yourself out; others only with Selective Channeling. The card's own Apply buttons aren't needed.",
  ];
  const variant = variantOf(item);
  if (variant) {
    content.push(`Variant channeling: ${variant}. Healing with positive energy or harming with negative energy is halved (unless the portfolio says otherwise), plus: Heal: ${VARIANTS[variant]?.heal} Harm: ${VARIANTS[variant]?.harm}${variant === "Luck" ? " (automated)" : ""}`);
    if (game.user.isGM) content.push(footnoteButton("Reset variant (GM)", "The choice is permanent for players; the GM can undo a mistake", () => clearVariant(item).then(() => refreshFootnotes(item))));
  } else if (variantsAllowed() && item.isOwner) {
    // "When you create a cleric character, decide ...": characters made before the module choose once here
    content.push(footnoteButton("Choose variant channeling…", "Optional rule: a portfolio-based variant, chosen once", () => chooseVariant(item).then(() => refreshFootnotes(item))));
  }
  return content;
});
