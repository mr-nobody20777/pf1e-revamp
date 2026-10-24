// Quarry / Improved Quarry (Slayer 14th/19th). PF1 ships both as text with an empty action.
//   - Using Quarry (standard) or Improved Quarry (free) with one creature targeted marks it as the
//     quarry. It must be a studied target or match a favored enemy type (asked when not studied).
//   - Linked buffs, like Studied Target: "Quarry: X" on the slayer (with the Survival take 10/20
//     note) and "Quarry of Y" on the creature. Removing either dismisses the quarry.
//   - +2 insight (+4 improved) on attack rolls while targeting the quarry; attack cards against it
//     note that critical threats are automatically confirmed.
//   - Cooldown before a new quarry, in game time: 24 hours after dismissing, 1 hour if it died;
//     10 minutes either way with Improved Quarry. Advisory: selecting early asks to override.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { registerRollEffect } from "./roll-effects.mjs";
import { isActiveGM, allActors, linkedBuffs, createQueue, stillExists, deleteIfExists, esc, onSceneCatchUp, titleFor } from "./util.mjs";

const FLAG = "quarry";
const LINK = "quarryLink";
const PF1 = "Compendium.pf1.class-abilities.Item.";
const QUARRY_SOURCE = `${PF1}5NS7Ec3WhKIkhygg`;
const IMPROVED_SOURCE = `${PF1}oRac7XDHBN0JzuyY`;
const ATTACK_ACTIONS = ["mwak", "rwak", "twak", "msak", "rsak"];

function isQuarry(item) {
  return item.type === "feat" && (item._stats?.compendiumSource === QUARRY_SOURCE || item.name === "Quarry");
}
function isImproved(item) {
  return item.type === "feat" && (item._stats?.compendiumSource === IMPROVED_SOURCE || item.name === "Improved Quarry");
}
function findQuarry(actor) {
  return actor?.items.find(isQuarry) ?? null;
}
function hasImproved(actor) {
  return !!actor?.items.some((i) => isImproved(i) && i.isActive);
}
function tokenName(uuid) {
  return fromUuidSync(uuid)?.name ?? "unknown";
}
function formatTime(seconds) {
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)} hour(s)`;
  return `${Math.ceil(seconds / 60)} minute(s)`;
}

/** Is the token one of this actor's studied targets? */
function isStudied(actor, uuid) {
  return actor.items.some((i) => (i.getFlag(MODULE_ID, "studiedTarget")?.targets ?? []).includes(uuid));
}

function isDead(tokenDoc) {
  const actor = tokenDoc?.actor;
  if (!actor) return true; // gone from the scene
  if (actor.statuses?.has("dead") || tokenDoc.combatant?.isDefeated) return true;
  return (actor.system.attributes?.hp?.value ?? 1) <= 0;
}

/* -------------------------------------------- */
/*  Selecting and dismissing                    */
/* -------------------------------------------- */

async function selectQuarry(actor, usedItem) {
  const quarry = findQuarry(actor);
  if (!quarry) return ui.notifications.warn(`${actor.name} has no Quarry feature.`);
  const targets = [...game.user.targets];
  if (targets.length !== 1) return ui.notifications.warn(`${usedItem.name}: target exactly one creature.`);
  const token = targets[0].document;

  // Cooldown (game time)
  const cooldown = quarry.getFlag(MODULE_ID, "cooldownUntil");
  const remaining = cooldown ? cooldown - game.time.worldTime : 0;
  if (remaining > 0) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: titleFor("Quarry on cooldown", actor) },
      content: `<p>${esc(actor.name)} can't select a new quarry for another <strong>${formatTime(remaining)}</strong> of game time.</p><p>Select anyway?</p>`,
      rejectClose: false,
    });
    if (!ok) return;
  }

  // Must be a studied target or a favored enemy type
  if (!isStudied(actor, token.uuid)) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: titleFor("Quarry requirement", actor) },
      content: `<p><strong>${esc(token.name)}</strong> isn't one of ${esc(actor.name)}'s studied targets.</p><p>A quarry must be a studied target or match one of your favored enemy types. Does it match a favored enemy type?</p>`,
      rejectClose: false,
    });
    if (!ok) return;
  }

  const current = quarry.getFlag(MODULE_ID, FLAG);
  if (current?.target === token.uuid) return ui.notifications.info(`${token.name} is already ${actor.name}'s quarry.`);

  await quarry.update({
    [`flags.${MODULE_ID}.${FLAG}`]: { target: token.uuid, since: game.time.worldTime },
    [`flags.${MODULE_ID}.-=cooldownUntil`]: null,
  });
  const bonus = hasImproved(actor) ? 4 : 2;
  ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    content: `<p><strong>Quarry:</strong> ${esc(actor.name)} marks <strong>${esc(token.name)}</strong>. +${bonus} insight on attack rolls against it; critical threats are automatically confirmed.</p>`,
  });
}

async function dismissQuarry(quarry, reason = "dismissed") {
  if (!stillExists(quarry)) return;
  const state = quarry.getFlag(MODULE_ID, FLAG);
  if (!state) return;
  const actor = quarry.actor;
  const dead = isDead(fromUuidSync(state.target));
  const wait = hasImproved(actor) ? 600 : dead ? 3600 : 86400;
  await quarry.update({
    [`flags.${MODULE_ID}.-=${FLAG}`]: null,
    [`flags.${MODULE_ID}.cooldownUntil`]: game.time.worldTime + wait,
  });
  ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    content: `<p><strong>Quarry</strong> on ${esc(tokenName(state.target))} ends (${esc(dead ? "dead" : reason)}). A new quarry can be selected in ${formatTime(wait)} of game time.</p>`,
  });
}

Hooks.on("pf1PostActionUse", (actionUse) => {
  const item = actionUse.item;
  if (item?.actor && (isQuarry(item) || isImproved(item))) selectQuarry(item.actor, item);
});

/* -------------------------------------------- */
/*  Bonuses and attack card note                */
/* -------------------------------------------- */

function quarryAgainstTargets(actor) {
  const state = findQuarry(actor)?.getFlag(MODULE_ID, FLAG);
  if (!state) return null;
  return [...game.user.targets].some((t) => t.document.uuid === state.target) ? state : null;
}

// Shown in the roll window (roll-effects.mjs), as not applying when the quarry isn't targeted
registerRollEffect({
  collect(actor, roll) {
    if (roll.kind !== "attack" || !ATTACK_ACTIONS.includes(roll.action.actionType)) return [];
    if (!findQuarry(actor)?.getFlag(MODULE_ID, FLAG)) return [];
    const applies = !!quarryAgainstTargets(actor);
    const reason = game.user.targets.size ? "your target isn't your quarry" : "no target selected";
    // Insight bonuses don't stack: only the part above an insight bonus the slayer already has counts
    const existing = Math.max(0, ...actor.changes.filter((c) => c.type === "insight" && ["attack", "wattack", "mattack", "rattack"].includes(c.target)).map((c) => c.value ?? 0));
    const atk = Math.max(0, (hasImproved(actor) ? 4 : 2) - existing);
    if (!atk) return [{ id: "quarry", label: "Quarry", type: "insight", atk: hasImproved(actor) ? 4 : 2, applies: false, reason: "a higher insight bonus already applies" }];
    const trueStrike = actor.itemTypes.buff.some((b) => b.isActive && b.flags[MODULE_ID]?.trueStrike);
    const tooltip = trueStrike ? "Doesn't stack with True Strike's +20 insight: it counts only on attacks without True Strike" : "";
    return [{ id: "quarry", label: "Quarry", part: "Quarry (insight)", type: "insight", atk, applies, reason, tooltip }];
  },
});

// Note on attack cards made against the quarry
Hooks.on("preCreateChatMessage", (message) => {
  if (message.type !== "action") return;
  const actor = ChatMessage.implementation.getSpeakerActor(message.speaker);
  const state = findQuarry(actor)?.getFlag(MODULE_ID, FLAG);
  if (state && (message.system.targets ?? []).includes(state.target)) message.updateSource({ [`flags.${MODULE_ID}.vsQuarry`]: true });
});

Hooks.on("renderChatMessagePF", (message, html) => {
  if (!message.getFlag(MODULE_ID, "vsQuarry")) return;
  const card = html.querySelector(".card-content") ?? html.querySelector(".message-content");
  if (!card) return;
  const note = document.createElement("p");
  note.style.cssText = "margin: 0.25em 0; font-weight: bold;";
  note.textContent = "Quarry: critical threats against this target are automatically confirmed.";
  card.append(note);
});

/* -------------------------------------------- */
/*  Linked buffs (active GM only)               */
/* -------------------------------------------- */

const enqueue = createQueue("Quarry");

function buffData(name, img, description, link, notes = []) {
  return {
    name,
    type: "buff",
    img,
    system: {
      subType: "feat",
      active: true,
      description: { value: description },
      contextNotes: notes.map(([target, text]) => ({ target, text })),
    },
    flags: { [MODULE_ID]: { [LINK]: link } },
  };
}

async function reconcile(quarry) {
  if (!stillExists(quarry)) return;
  const actor = quarry.actor;
  if (!actor) return;
  const state = quarry.getFlag(MODULE_ID, FLAG);

  for (const other of allActors()) {
    for (const buff of linkedBuffs(other, LINK, quarry.uuid)) {
      if (!state || buff.getFlag(MODULE_ID, LINK).target !== state.target) await deleteIfExists(buff);
    }
  }
  if (!state) return;

  const target = fromUuidSync(state.target);
  const improved = hasImproved(actor);
  const link = { source: quarry.uuid, target: state.target };
  if (!linkedBuffs(actor, LINK, quarry.uuid).length) {
    const survival = `Tracking ${target?.name ?? "your quarry"}: may take ${improved ? 20 : 10} on Survival while moving at normal speed, without penalty (Quarry)`;
    await actor.createEmbeddedDocuments("Item", [
      buffData(
        `Quarry: ${target?.name ?? "unknown"}`,
        quarry.img,
        `<p>+${improved ? 4 : 2} insight on attack rolls against ${esc(target?.name ?? "the quarry")}; critical threats automatically confirmed. Delete or deactivate this buff to dismiss the quarry.</p>`,
        link,
        [["skill.sur", survival]]
      ),
    ]);
  }
  if (target?.actor && !linkedBuffs(target.actor, LINK, quarry.uuid).length) {
    await target.actor.createEmbeddedDocuments("Item", [
      buffData(`Quarry of ${actor.name}`, quarry.img, `<p>${esc(actor.name)} has marked this creature as their quarry. Delete or deactivate this buff to end it.</p>`, link),
    ]);
  }
}

async function unlink(link) {
  const quarry = fromUuidSync(link.source);
  if (quarry?.getFlag(MODULE_ID, FLAG)?.target === link.target) await dismissQuarry(quarry, "dismissed");
}

Hooks.on("updateItem", (item, changes) => {
  if (isQuarry(item)) refreshFootnotes(item);
  if (!isActiveGM()) return;
  if (isQuarry(item) && foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)) enqueue(() => reconcile(item));
  const link = item.getFlag(MODULE_ID, LINK);
  if (link && changes.system?.active === false) enqueue(() => unlink(link));
});

Hooks.on("deleteItem", (item) => {
  if (!isActiveGM()) return;
  const link = item.getFlag(MODULE_ID, LINK);
  if (link) enqueue(() => unlink(link));
  if (isQuarry(item)) {
    enqueue(async () => {
      for (const other of allActors()) for (const buff of linkedBuffs(other, LINK, item.uuid)) await deleteIfExists(buff);
    });
  }
});

// The quarry's token leaving the scene ends it (treated as proof it's gone/dead).
Hooks.on("deleteToken", (tokenDoc) => {
  if (!isActiveGM()) return;
  for (const actor of allActors()) {
    const quarry = findQuarry(actor);
    if (quarry?.getFlag(MODULE_ID, FLAG)?.target === tokenDoc.uuid) enqueue(() => dismissQuarry(quarry, "removed"));
  }
});

onSceneCatchUp((item) => {
  if (isQuarry(item) && item.getFlag(MODULE_ID, FLAG)) enqueue(() => reconcile(item));
});

/* -------------------------------------------- */
/*  Footnotes                                   */
/* -------------------------------------------- */

registerFootnote((item) => {
  if (!isQuarry(item) && !isImproved(item)) return null;
  const actor = item.actor;
  const content = [
    "Use this with one creature targeted (a studied target or favored enemy type) to mark it. The insight bonus is added to attack rolls against it automatically; removing either linked buff dismisses it.",
  ];
  if (!actor) return content;
  const quarry = findQuarry(actor);
  const state = quarry?.getFlag(MODULE_ID, FLAG);
  if (state) {
    content.push(` Current quarry: ${tokenName(state.target)}.`);
    if (quarry.isOwner) content.push(footnoteButton("Dismiss quarry", "Dismiss as a free action (starts the cooldown)", () => dismissQuarry(quarry)));
  } else {
    const remaining = (quarry?.getFlag(MODULE_ID, "cooldownUntil") ?? 0) - game.time.worldTime;
    content.push(remaining > 0 ? ` No quarry; a new one can be selected in ${formatTime(remaining)} of game time.` : " No quarry.");
  }
  return content;
});
