// Shield bashes. PF1 treats every shield bash as nonproficient (−4) unless the shield is manually
// marked proficient: it has no weapon category for shields. By the core rules light and heavy
// shields are martial weapons when bashing.
//   - Setting (on by default): shield bashes use martial weapon proficiency.
//   - Shield-Trained (religion trait, Gorum; Inner Sea Gods p. 222): "Heavy and light shields are
//     considered simple weapons rather than martial weapons for you. Heavy shields are considered
//     light weapons for you." Recognized by its pf-content source or name. Any item can grant the
//     same with flags["pf1e-revamp"].shieldBash = { category: "simple"|"martial", heavyIsLight }.
//   - Weapon Finesse with a shield bash that counts as light: Dex instead of Str when higher, and
//     (per the feat) the shield's armor check penalty applies to the attack roll.
// All of this happens at roll/check time; nothing is written to the shield.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote } from "./footnote.mjs";
import { registerRollEffect } from "./roll-effects.mjs";

const SETTING = "shieldBashMartial";
const BASH_SHIELDS = ["lightShield", "heavyShield"];
const SHIELD_TRAINED_SOURCE = "Compendium.pf-content.pf-traits.Item.KQOcLTeWu57NjXZW";
const WEAPON_FINESSE_SOURCE = "Compendium.pf1.feats.Item.vWiTqHC4Y3Xn1Pme";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING, {
    name: "Shield bashes use martial weapon proficiency",
    hint: "By the core rules, light and heavy shields are martial weapons when used to bash. PF1 currently gives every shield bash the −4 nonproficiency penalty. When on, characters with martial weapon proficiency bash without it.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
});

export function isBashShield(item) {
  return item?.type === "equipment" && item.subType === "shield" && BASH_SHIELDS.includes(item.system.equipmentSubtype);
}

function isShieldTrained(item) {
  return item.type === "feat" && (item._stats?.compendiumSource === SHIELD_TRAINED_SOURCE || /^Shield-Trained\b/i.test(item.name));
}

/** Shield-bash rules granted by the actor's active items. */
export function shieldBashRules(actor) {
  const rules = { category: null, heavyIsLight: false, sources: [] };
  for (const item of actor?.items ?? []) {
    if (!item.isActive) continue;
    const granted = item.getFlag(MODULE_ID, "shieldBash") ?? (isShieldTrained(item) ? { category: "simple", heavyIsLight: true } : null);
    if (!granted) continue;
    if (granted.category === "simple" || (granted.category && !rules.category)) rules.category = granted.category;
    rules.heavyIsLight ||= !!granted.heavyIsLight;
    rules.sources.push(item.name);
  }
  return rules;
}

export function hasShieldTrained(actor) {
  return shieldBashRules(actor).sources.length > 0;
}

/** Does this shield's bash count as a light weapon for the actor? */
export function bashCountsAsLight(item, actor) {
  if (!isBashShield(item)) return false;
  return item.system.equipmentSubtype === "lightShield" || shieldBashRules(actor).heavyIsLight;
}

/** Weapon category a bash counts as for this actor, or null to leave it to PF1. */
function bashCategory(actor) {
  return shieldBashRules(actor).category ?? (game.settings.get(MODULE_ID, SETTING) ? "martial" : null);
}

function shieldAcp(item) {
  const acp = item.system.armor?.acp ?? 0;
  return Math.max(0, acp - (item.system.masterwork ? 1 : 0));
}

function hasWeaponFinesse(actor) {
  return !!actor?.itemTypes.feat.some((f) => f.isActive && (f._stats?.compendiumSource === WEAPON_FINESSE_SOURCE || f.name === "Weapon Finesse"));
}

/* -------------------------------------------- */
/*  Proficiency                                 */
/* -------------------------------------------- */

Hooks.once("setup", () => {
  const path = "pf1.documents.actor.ActorPF.prototype.hasWeaponProficiency";
  const wrapper = function (wrapped, item, options) {
    if (isBashShield(item)) {
      const category = bashCategory(this);
      if (category && this.system.traits?.weaponProf?.standard?.has(category)) return true;
    }
    return wrapped(item, options);
  };
  if (game.modules.get("lib-wrapper")?.active) {
    libWrapper.register(MODULE_ID, path, wrapper, "MIXED");
  } else {
    const proto = pf1.documents.actor.ActorPF.prototype;
    const original = proto.hasWeaponProficiency;
    proto.hasWeaponProficiency = function (item, options) {
      return wrapper.call(this, original.bind(this), item, options);
    };
  }
});

/* -------------------------------------------- */
/*  Weapon Finesse                              */
/* -------------------------------------------- */

// Before attacks are built: switch a light shield bash to Dex when Weapon Finesse makes it better
Hooks.on("pf1CreateActionUse", (actionUse) => {
  const { item, actor } = actionUse;
  if (!isBashShield(item) || actionUse.action?.actionType !== "mwak") return;
  if (!hasWeaponFinesse(actor) || !bashCountsAsLight(item, actor)) return;
  const abilities = actor.system.abilities ?? {};
  if ((abilities.dex?.mod ?? 0) <= (abilities.str?.mod ?? 0)) return;
  const ability = actionUse.shared.rollData.action?.ability;
  if (!ability || ability.attack === "dex") return;
  ability.attack = "dex";
});

// The penalty, shown in the roll window (roll-effects.mjs) as imposed: only the GM can leave it out
registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "attack") return [];
    const { action } = roll;
    const item = action.item;
    // Only when the bash is switched to Dex above (an attack already set to Dex is left as it is)
    if (!isBashShield(item) || action.actionType !== "mwak" || action.ability?.attack === "dex") return [];
    if (!hasWeaponFinesse(actor) || !bashCountsAsLight(item, actor)) return [];
    const abilities = actor.system.abilities ?? {};
    const acp = shieldAcp(item);
    if ((abilities.dex?.mod ?? 0) <= (abilities.str?.mod ?? 0) || !(acp > 0)) return [];
    return [{ id: "finesse-shield-acp", label: "Weapon Finesse: shield ACP", type: "untyped", atk: -acp, applies: true, imposed: true, tooltip: "Weapon Finesse: the shield's armor check penalty applies to attack rolls" }];
  },
});

/* -------------------------------------------- */
/*  Notes                                       */
/* -------------------------------------------- */

// Heavy shield bash cards: remind that it counts as a light weapon
Hooks.on("renderChatMessagePF", (message, html) => {
  const item = message.itemSource;
  if (!isBashShield(item) || item.system.equipmentSubtype !== "heavyShield" || !shieldBashRules(item.actor).heavyIsLight) return;
  const card = html.querySelector(".card-content") ?? html.querySelector(".message-content");
  if (!card) return;
  const note = document.createElement("p");
  note.style.cssText = "margin: 0.25em 0; font-style: italic;";
  note.textContent = "This heavy shield counts as a light weapon for you (Weapon Finesse, two-weapon fighting off-hand).";
  card.append(note);
});

registerFootnote((item) => {
  if (isShieldTrained(item) || item.getFlag?.(MODULE_ID, "shieldBash")) {
    return [
      "Automated: light and heavy shield bashes count as simple weapons for you (proficient with simple weapon proficiency), and heavy shields count as light weapons: for two-weapon fighting and, with Weapon Finesse, Dex to attack.",
    ];
  }
  if (isBashShield(item) && item.actor) {
    const actor = item.actor;
    const rules = shieldBashRules(actor);
    const category = bashCategory(actor);
    const light = bashCountsAsLight(item, actor);
    const parts = [
      category ? `Bashes count as ${category} weapons${rules.sources.length ? ` (${rules.sources.join(", ")})` : ""}: ${item.isProficient ? "proficient" : "not proficient"}.` : "",
      light ? "Counts as a light weapon." : "",
      light && hasWeaponFinesse(actor) ? `Weapon Finesse: Dex to attack when higher, with this shield's armor check penalty (−${shieldAcp(item)}).` : "",
    ].filter(Boolean);
    return parts.length ? [parts.join(" ")] : null;
  }
  return null;
});
