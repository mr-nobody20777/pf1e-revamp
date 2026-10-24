// Studied Target (Slayer and similar): bonuses that apply only against specific creatures.
// PF1's own Studied Target class feature is recognized automatically, so the item the Slayer class
// grants needs no changes. Any other feature can opt in (or override the formulas) with
//   flags["pf1e-revamp"].studiedTarget = { bonus, max }
// where bonus and max are roll formulas evaluated with the item's roll data. The studied token
// UUIDs, oldest first, are stored in the same flag under `targets`.
//
// Using the feature studies the user's current targets. Bonuses are then added to weapon attack
// and damage rolls and to Bluff, Knowledge, Perception, Sense Motive and Survival checks whenever
// the roller has a studied creature targeted.
//
// Visibility: the active GM's client mirrors each studied pair as indicator buffs (no changes) on
// the studier and the studied creature; deleting or deactivating either buff stops studying, which
// removes the other. Targets can also be discarded from the item's footnote or the studied token's HUD.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { registerRollEffect } from "./roll-effects.mjs";
import { evaluate, classLevel, isActiveGM, allActors, linkedBuffs as linkedBuffsBy, createQueue, stillExists, deleteIfExists, onSceneCatchUp } from "./util.mjs";

const FLAG = "studiedTarget";
const PF1_STUDIED_TARGET = "Compendium.pf1.class-abilities.Item.JnXrphJlr1ULx1MK";
const DEFAULTS = {
  bonus: "1 + floor(max(@class.level, @classes.slayer.level) / 5)",
  max: "1 + floor(max(@class.level, @classes.slayer.level) / 5)",
};
const WEAPON_ACTIONS = ["mwak", "rwak", "twak"];
const STUDIED_SKILLS = ["blf", "per", "sen", "sur"]; // plus every knowledge skill (k**)
const LINK = "studiedLink";

/** Studied Target config for an item, or null if it isn't a Studied Target feature. */
function getConfig(item) {
  const flag = item.flags[MODULE_ID]?.[FLAG]; // direct read: this runs on every item update and attack
  const isPF1Feature =
    item.type === "feat" && (item._stats?.compendiumSource === PF1_STUDIED_TARGET || item.name === "Studied Target");
  if (!flag && !isPF1Feature) return null;
  return { ...DEFAULTS, targets: [], ...flag };
}

function tokenName(uuid) {
  return fromUuidSync(uuid)?.name ?? "unknown";
}

async function setTargets(item, targets) {
  if (!stillExists(item)) return;
  await item.setFlag(MODULE_ID, `${FLAG}.targets`, targets);
}

async function discard(item, uuid) {
  const config = getConfig(item);
  await setTargets(item, config.targets.filter((u) => u !== uuid));
  ui.notifications.info(`${item.name}: stopped studying ${tokenName(uuid)}.`);
}

/**
 * Highest studied-target bonus the actor has: against the user's current targets, or (with `any`)
 * against anything it is studying, for listing it as not applying.
 */
function studiedBonus(actor, { any = false } = {}) {
  if (!actor) return null;
  const targeted = Array.from(game.user.targets, (t) => t.document.uuid);
  if (!targeted.length && !any) return null;

  let best = null;
  for (const item of actor.itemTypes.feat) {
    const config = getConfig(item);
    if (!config || !item.isActive || !config.targets.length) continue;
    if (!any && !config.targets.some((uuid) => targeted.includes(uuid))) continue;

    // The default formula only needs the slayer level; skip building the item's full roll data per attack
    const level = classLevel(item, "slayer");
    const value = evaluate(config.bonus, item, config.bonus === DEFAULTS.bonus ? { class: { level }, classes: { slayer: { level } } } : undefined);
    if (value > 0 && (!best || value > best.value)) best = { value, label: item.name };
  }
  return best;
}

/* -------------------------------------------- */
/*  Studying                                    */
/* -------------------------------------------- */

// Record the targets of this use, dropping the oldest beyond the maximum.
// If every target is already studied, discard them instead (a free action in the rules).
Hooks.on("pf1PostActionUse", async (actionUse) => {
  const item = actionUse.item;
  const config = item && getConfig(item);
  if (!config) return;

  const tokens = actionUse.shared.targets ?? [];
  if (!tokens.length) {
    ui.notifications.warn(`${item.name}: target a creature first.`);
    return;
  }

  const chosen = tokens.map((t) => t.document.uuid);
  let studied = config.targets;
  let message;

  if (chosen.every((uuid) => studied.includes(uuid))) {
    studied = studied.filter((uuid) => !chosen.includes(uuid));
    message = `${item.name}: discarded ${tokens.map((t) => t.name).join(", ")}.`;
  } else {
    const max = Math.max(1, evaluate(config.max, item));
    studied = [...studied.filter((uuid) => !chosen.includes(uuid)), ...chosen].slice(-max);
    message = `${item.name}: studying ${studied.map(tokenName).join(", ")} (max ${max}).`;
  }

  await setTargets(item, studied);
  ui.notifications.info(message);
});

/* -------------------------------------------- */
/*  Bonuses                                     */
/* -------------------------------------------- */

// Weapon attack and damage rolls, and the listed skills; shown in the roll window (roll-effects.mjs),
// as not applying when no studied creature is targeted.
const studiedSkill = (skillId) => {
  const skill = skillId.split(".")[0];
  return STUDIED_SKILLS.includes(skill) || /^k[a-z]{2}$/.test(skill);
};

registerRollEffect({
  collect(actor, roll) {
    if (roll.kind === "save" || (roll.kind === "attack" && !WEAPON_ACTIONS.includes(roll.action.actionType))) return [];
    if (roll.kind === "skill" && !studiedSkill(roll.skillId)) return [];
    const best = studiedBonus(actor, { any: true });
    if (!best) return [];
    const applying = studiedBonus(actor);
    const value = (applying ?? best).value;
    const values = roll.kind === "attack" ? { atk: value, dmg: value } : { roll: value };
    const reason = game.user.targets.size ? "your target isn't studied" : "no target selected";
    return [{ id: "studied-target", label: best.label, part: best.label, type: "untyped", ...values, applies: !!applying, reason }];
  },
});

/* -------------------------------------------- */
/*  Footnote with discard buttons               */
/* -------------------------------------------- */

registerFootnote((item) => {
  const config = getConfig(item);
  if (!config) return null;

  const content = [
    "Use this feature with creatures targeted to study them. The bonus is added automatically to weapon attack and damage rolls and to Bluff, Knowledge, Perception, Sense Motive and Survival checks while a studied creature is targeted.",
  ];
  if (!item.actor) return content;

  content.push(" Removing either linked indicator buff also stops studying.");
  content.push(` Currently +${evaluate(config.bonus, item)}, up to ${Math.max(1, evaluate(config.max, item))} target(s). Studying: `);
  if (!config.targets.length) content.push("nobody.");
  config.targets.forEach((uuid, i) => {
    if (i > 0) content.push(", ");
    content.push(tokenName(uuid));
    if (item.isOwner) content.push(footnoteButton("×", "Stop studying", () => discard(item, uuid)));
  });
  return content;
});


/* -------------------------------------------- */
/*  Indicator buffs (active GM only)            */
/* -------------------------------------------- */

function linkedBuffs(actor, sourceUuid, targetUuid) {
  return linkedBuffsBy(actor, LINK, sourceUuid, targetUuid);
}

function indicatorData(item, name, description, link) {
  return {
    name,
    type: "buff",
    img: item.img,
    system: { subType: "feat", active: true, description: { value: `<p>${description}</p>` } },
    flags: { [MODULE_ID]: { [LINK]: link } },
  };
}

const enqueue = createQueue("Studied Target");

/** Make the indicator buffs match the feature's studied list. */
async function reconcile(item) {
  if (!stillExists(item)) return;
  const actor = item.actor;
  if (!actor) return;
  const targets = getConfig(item)?.targets ?? [];

  for (const buff of linkedBuffs(actor, item.uuid)) {
    const target = buff.getFlag(MODULE_ID, LINK).target;
    if (targets.includes(target)) continue;
    for (const other of linkedBuffs(fromUuidSync(target)?.actor, item.uuid, target)) await deleteIfExists(other);
    await deleteIfExists(buff);
  }

  for (const uuid of targets) {
    const token = fromUuidSync(uuid);
    const name = token?.name ?? "unknown";
    const link = { source: item.uuid, target: uuid };

    if (!linkedBuffs(actor, item.uuid, uuid).length) {
      const description = `${actor.name} is studying ${name}. Delete or deactivate this buff to stop studying.`;
      await actor.createEmbeddedDocuments("Item", [indicatorData(item, `${item.name}: ${name}`, description, link)]);
    }
    if (token?.actor && !linkedBuffs(token.actor, item.uuid, uuid).length) {
      const description = `${actor.name} has this creature as a studied target. Delete or deactivate this buff to end it.`;
      await token.actor.createEmbeddedDocuments("Item", [indicatorData(item, `Studied by ${actor.name}`, description, link)]);
    }
  }
}

/** Stop studying a creature because one of its indicator buffs went away. */
async function unlink(link) {
  const item = fromUuidSync(link.source);
  const config = item && getConfig(item);
  if (!config?.targets.includes(link.target)) return;
  await setTargets(item, config.targets.filter((u) => u !== link.target));
}

// Removing a studied feature removes all of its indicator buffs.
async function clearIndicators(item) {
  for (const actor of allActors()) for (const buff of linkedBuffs(actor, item.uuid)) await deleteIfExists(buff);
}

Hooks.on("updateItem", (item, changes) => {
  const isFeature = !!getConfig(item);
  if (isFeature) refreshFootnotes(item); // keep the studied list in its footnote current
  if (!isActiveGM()) return;
  if (isFeature) enqueue(() => reconcile(item));
  const link = item.getFlag(MODULE_ID, LINK);
  if (link && changes.system?.active === false) enqueue(() => unlink(link));
});

Hooks.on("deleteItem", (item) => {
  if (!isActiveGM()) return;
  if (getConfig(item)) enqueue(() => clearIndicators(item));
  const link = item.getFlag(MODULE_ID, LINK);
  if (link) enqueue(() => unlink(link));
});

// A studied token leaving the scene ends the study.
Hooks.on("deleteToken", (tokenDoc) => {
  if (!isActiveGM()) return;
  enqueue(async () => {
    for (const actor of allActors()) {
      for (const item of actor.items) {
        const config = getConfig(item);
        if (config?.targets.includes(tokenDoc.uuid)) await setTargets(item, config.targets.filter((u) => u !== tokenDoc.uuid));
      }
    }
  });
});

// Catch up on anything studied while no GM was connected.
onSceneCatchUp((item) => {
  if (getConfig(item)) enqueue(() => reconcile(item));
});

/* -------------------------------------------- */
/*  Token HUD discard button                    */
/* -------------------------------------------- */

// Who's studying this token is worked out when its HUD opens (rare), rather than kept in an index.
Hooks.on("renderTokenHUD", (hud, html) => {
  const root = html[0] ?? html;
  const uuid = hud.document?.uuid;
  if (!uuid) return;
  const studiers = [];
  for (const actor of allActors()) {
    if (!actor.isOwner) continue;
    for (const item of actor.items) if (item.isActive && getConfig(item)?.targets.includes(uuid)) studiers.push(item);
  }
  if (!studiers.length) return;

  const button = document.createElement("div");
  button.className = "control-icon";
  button.dataset.tooltip = `Stop studying (${studiers.map((i) => `${i.actor.name}: ${i.name}`).join("; ")})`;
  button.innerHTML = '<i class="fa-solid fa-eye-slash" inert></i>';
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    for (const item of studiers) await discard(item, uuid);
    hud.close();
  });
  root.querySelector(".col.right")?.append(button);
});
