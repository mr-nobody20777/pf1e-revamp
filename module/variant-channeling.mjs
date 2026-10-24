// Variant channeling (Ultimate Magic), an optional rule the GM turns on in the module settings:
//   "When you create a cleric character, decide whether she uses the standard form of channel energy
//   or a variant presented here based on one aspect of her deity's portfolio. Once this choice is
//   made, it cannot be altered."
//   "A variant channeling either modifies positive channeled energy when used to heal or modifies
//   negative energy when used to harm. When using positive energy to heal, affected creatures gain
//   only half the normal amount of healing but also receive a specific beneficial effect. When
//   channeling negative energy to harm, affected creatures take only half the normal damage but take
//   an additional penalty or harmful effect; a successful saving throw negates the additional penalty
//   or effect but does not reduce the damage any further."
//   "a 'channel bonus' on rolls or statistics ... is +1, increasing to +2 at cleric level 5 and for
//   every 5 cleric levels thereafter (to a maximum of +5)." Penalties mirror it.
//
// The choice is made in the new-cleric level-up window (subclass.mjs) or once from Channel Energy's
// note, and is stored on the Channel Energy item. Halving applies to every portfolio; each effect is
// shown in the channel summary. Luck's effect is automated: a one-roll bonus (fortune.mjs) when
// healing, a penalty on all d20 rolls when harming.

import { MODULE_ID } from "./const.mjs";
import { esc, searchSelects, titleFor } from "./util.mjs";
import { VARIANTS } from "./variant-channeling-data.mjs";

export { VARIANTS };
export const SETTING = "variantChanneling";
const FLAG = "variantChanneling";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING, {
    name: "Variant channeling (optional rule)",
    hint: "Ultimate Magic's variant channeling: clerics (and other channelers who serve a deity) may choose a portfolio-based variant when created. Healing or harming is halved for a portfolio effect.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
});

export const variantsAllowed = () => game.settings.get(MODULE_ID, SETTING);
export const variantOf = (channelItem) => channelItem?.getFlag(MODULE_ID, FLAG) ?? null;

// The choice lives on Channel Energy; a "Variant Channeling (Luck)" class feature shows it on the sheet
const FEATURE_FLAG = "variantFeature";
const featuresOf = (channelItem) => channelItem.actor?.itemTypes.feat.filter((f) => f.flags[MODULE_ID]?.[FEATURE_FLAG]) ?? [];

function featureData(channelItem, name) {
  const { heal, harm } = VARIANTS[name];
  return {
    name: `Variant Channeling (${name})`,
    type: "feat",
    img: channelItem.img,
    system: {
      subType: "classFeat",
      class: channelItem.system.class,
      description: {
        value: `<p><strong>Heal:</strong> ${esc(heal)}</p><p><strong>Harm:</strong> ${esc(harm)}</p>
          <p>Variant channeling (<em>Ultimate Magic</em>): when using positive energy to heal, affected creatures gain only half the normal amount of healing but also receive the effect above. When channeling negative energy to harm, affected creatures take only half the normal damage but take the additional effect; a successful saving throw negates the additional effect but does not reduce the damage any further. A "channel bonus" is +1, increasing to +2 at cleric level 5 and for every 5 cleric levels thereafter (to a maximum of +5).</p>`,
      },
    },
    flags: { [MODULE_ID]: { [FEATURE_FLAG]: channelItem.id } },
  };
}

export async function setVariant(channelItem, name) {
  await channelItem.setFlag(MODULE_ID, FLAG, name);
  const old = featuresOf(channelItem);
  if (old.length) await channelItem.actor.deleteEmbeddedDocuments("Item", old.map((f) => f.id));
  if (channelItem.actor) await channelItem.actor.createEmbeddedDocuments("Item", [featureData(channelItem, name)]);
}

export async function clearVariant(channelItem) {
  await channelItem.unsetFlag(MODULE_ID, FLAG);
  const old = featuresOf(channelItem);
  if (old.length) await channelItem.actor.deleteEmbeddedDocuments("Item", old.map((f) => f.id));
}

export const isVariantFeature = (item) => !!item.flags?.[MODULE_ID]?.[FEATURE_FLAG];

/** +1, +2 at level 5, +1 per 5 levels after, max +5 */
export const channelBonus = (level) => Math.min(5, 1 + Math.floor(level / 5));

/**
 * How a variant changes this channel. Only positive energy healing and negative energy harming are
 * modified; a portfolio whose effect "works like a standard channel (not halved)" isn't halved.
 */
export function variantEffect(channelItem, { heal, undead }) {
  const name = variantOf(channelItem);
  if (!name || undead || !VARIANTS[name]) return null;
  const text = VARIANTS[name][heal ? "heal" : "harm"];
  return { name, text, halved: !/not halved/i.test(text), heal };
}

/** The variant dropdown's options: standard first, then every portfolio. */
export const variantOptions = () => [{ value: "", label: "Standard channel energy" }, ...Object.keys(VARIANTS).map((n) => ({ value: n, label: n }))];

/** Choose once (from Channel Energy's note). */
export async function chooseVariant(channelItem) {
  const options = variantOptions().map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
  const name = await foundry.applications.api.DialogV2.wait({
    window: { title: titleFor("Variant channeling", channelItem.actor) },
    content: `<p>Choose one aspect of your deity's portfolio. <strong>This can't be changed later</strong> (only the GM can reset it).</p>
      <div style="display:flex; align-items:center"><select name="variant" style="flex:1">${options}</select></div>
      <p class="pfr-variant-text" style="font-size:11px; opacity:0.8; min-height:3em"></p>`,
    render: (event, dialog) => {
      searchSelects(dialog.element);
      const select = dialog.element.querySelector("select");
      const text = dialog.element.querySelector(".pfr-variant-text");
      const show = () => (text.textContent = VARIANTS[select.value] ? `Heal: ${VARIANTS[select.value].heal} Harm: ${VARIANTS[select.value].harm}` : "");
      select.addEventListener("change", show);
    },
    buttons: [
      { action: "choose", label: "Choose", default: true, callback: (event, button) => button.form.elements.variant.value },
      { action: "cancel", label: "Later" },
    ],
    rejectClose: false,
  });
  if (name && VARIANTS[name]) await setVariant(channelItem, name);
}

/* -------------------------------------------- */
/*  Luck                                        */
/* -------------------------------------------- */

const LUCK_FLAG = "channelLuck";
const PENALTY_FLAG = "channelLuckPenalty";

/** Heal: a one-roll bonus (fortune.mjs uses it up). One buff per creature, refreshed by each channel. */
async function luckBonus(actor, bonus, source) {
  const existing = actor.itemTypes.buff.find((b) => b.flags[MODULE_ID]?.[LUCK_FLAG]);
  const data = {
    name: `Luck Channel (+${bonus})`,
    "system.active": true,
    "system.duration": { value: "1", units: "round", end: "turnEnd" },
    [`flags.${MODULE_ID}.${LUCK_FLAG}`]: { bonus, type: existing?.flags[MODULE_ID][LUCK_FLAG].type ?? "sacred", source },
  };
  if (existing) return existing.update(data);
  return actor.createEmbeddedDocuments("Item", [foundry.utils.expandObject({ type: "buff", img: "icons/magic/control/buff-luck-fortune-green.webp", "system.subType": "temp", ...data })]);
}

/**
 * Harm: a penalty on all d20 rolls until the end of the channeler's next turn. Being channeled again
 * refreshes it rather than adding a second penalty (the same effect doesn't stack with itself).
 */
async function luckPenalty(actor, bonus) {
  const changes = ["attack", "allSavingThrows", "skills", "allChecks"].map((target) => ({ _id: foundry.utils.randomID(8), target, type: "untyped", formula: `-${bonus}` }));
  const data = {
    name: `Luck Channel Penalty (−${bonus})`,
    system: { active: true, changes, duration: { value: "1", units: "round", end: "turnEnd" } },
    flags: { [MODULE_ID]: { [PENALTY_FLAG]: true } },
  };
  const existing = actor.itemTypes.buff.find((b) => b.flags[MODULE_ID]?.[PENALTY_FLAG]);
  if (existing) return existing.update(data);
  return actor.createEmbeddedDocuments("Item", [foundry.utils.mergeObject(data, { type: "buff", img: "icons/magic/control/hypnosis-mesmerism-swirl.webp", system: { subType: "temp" } })]);
}

/** Apply a variant's automated effect to one creature (on the GM's client). Returns a note for the summary. */
export async function applyVariant(actor, effect, { bonus, saved = false, source }) {
  if (effect.name !== "Luck") return null;
  if (effect.heal) {
    await luckBonus(actor, bonus, source);
    return `+${bonus} on one roll`;
  }
  if (saved) return "penalty negated";
  await luckPenalty(actor, bonus);
  return `−${bonus} on d20 rolls`;
}

