// Buffs that an ability or spell puts on its targets when it's used, which PF1 leaves to the player:
//   Bit of Luck (Luck domain)       → "Bit of Luck" (1 round): every d20 rolled twice, keep the better
//   Guidance (cantrip)              → the Guidance buff: +1 on the next attack, save or skill check
//   Resistant Touch (Protection)    → "Resistant Touch" (1 minute): the cleric's domain resistance
//     bonus. "When you use this ability, you lose your resistance bonus granted by the Protection domain
//     for 1 minute": the domain feature (which carries that bonus) is disabled while the cleric's
//     "Resistant Touch (lent)" buff is active.
// No targets means the user (except Resistant Touch, which needs the ally touched). The action card
// carries the targets and the active GM creates the buffs, so it works for players too. Skipped for
// any action that Nevela's Automation Suite is set to apply a buff for itself.
// The roll effects themselves are in fortune.mjs.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote } from "./footnote.mjs";
import { esc, evaluate, isActiveGM, onGmRequest } from "./util.mjs";

const NEVELA = "nevelas-automation-suite";

const GRANTS = {
  "bit of luck": { type: "feat", buff: (caster) => bitOfLuckBuff(caster) },
  guidance: { type: "spell", buff: () => compendiumBuff("Guidance") },
  "resistant touch": { type: "feat", buff: (caster) => resistantTouchBuff(caster), onCaster: lendResistance, allyOnly: true },
};

function grantFor(item) {
  const grant = item && GRANTS[item.name.toLowerCase()];
  return grant && item.type === grant.type ? grant : null;
}

/* -------------------------------------------- */
/*  Buff data                                   */
/* -------------------------------------------- */

function bitOfLuckBuff(caster) {
  return {
    name: "Bit of Luck",
    type: "buff",
    img: "icons/magic/control/buff-luck-fortune-green.webp",
    system: {
      subType: "temp",
      active: true,
      duration: { value: "1", units: "round", end: "turnStart" },
      description: { value: `<p>From ${esc(caster.name)}'s Bit of Luck: for the next round, any time you roll a d20, roll twice and take the more favorable result.</p>` },
    },
    flags: { [MODULE_ID]: { fortune: "best" } },
  };
}

async function compendiumBuff(name) {
  for (const id of ["pf1.buffs", "pf-content.pf-buffs"]) {
    const pack = game.packs.get(id);
    const entry = pack?.index.find((e) => e.name === name && e.type === "buff");
    if (entry) {
      const data = game.items.fromCompendium(await pack.getDocument(entry._id), { clearFolder: true });
      data.system.active = true;
      return data;
    }
  }
  return { name, type: "buff", system: { subType: "spell", active: true, duration: { value: "1", units: "minute" } } };
}

const protectionDomain = (actor) => actor.itemTypes.feat.find((f) => f.name === "Protection Domain");

function resistantTouchBuff(caster) {
  const domain = protectionDomain(caster);
  const change = domain?.system.changes?.find((c) => c.target === "allSavingThrows" && c.type === "resist");
  const bonus = change ? evaluate(change.formula, domain) : 1;
  return {
    name: "Resistant Touch",
    type: "buff",
    img: "icons/magic/defensive/shield-barrier-glowing-blue.webp",
    system: {
      subType: "temp",
      active: true,
      duration: { value: "1", units: "minute" },
      changes: [{ _id: foundry.utils.randomID(8), target: "allSavingThrows", type: "resist", formula: String(bonus) }],
      description: { value: `<p>${esc(caster.name)}'s resistance bonus from the Protection domain, for 1 minute.</p>` },
    },
  };
}

async function lendResistance(caster) {
  const domain = protectionDomain(caster);
  if (!domain) return;
  const lent = caster.itemTypes.buff.find((b) => b.flags[MODULE_ID]?.lentResistance);
  if (lent) await lent.update({ "system.active": true });
  else {
    await caster.createEmbeddedDocuments("Item", [
      {
        name: "Resistant Touch (lent)",
        type: "buff",
        img: "icons/magic/defensive/shield-barrier-glowing-blue.webp",
        system: { subType: "temp", active: true, duration: { value: "1", units: "minute" }, description: { value: "<p>Your Protection domain resistance bonus is lent out; it returns when this ends.</p>" } },
        flags: { [MODULE_ID]: { lentResistance: true } },
      },
    ]);
  }
  await domain.update({ "system.disabled": true });
}

// The lent buff ends (expired, toggled off or deleted): the domain bonus comes back
function restoreResistance(item) {
  if (!item.flags?.[MODULE_ID]?.lentResistance || !item.actor || !isActiveGM()) return;
  const domain = protectionDomain(item.actor);
  if (domain?.system.disabled) domain.update({ "system.disabled": false });
}
Hooks.on("updateItem", (item, changes) => {
  if (changes.system?.active === false) restoreResistance(item);
});
Hooks.on("deleteItem", restoreResistance);

/* -------------------------------------------- */
/*  Applying                                    */
/* -------------------------------------------- */

/** Is Nevela's Automation Suite set to apply a buff for this action itself? */
function nevelaApplies(item, actionId) {
  if (!game.modules.get(NEVELA)?.active || !game.settings.get(NEVELA, "automaticBuffs")) return false;
  return item.flags[NEVELA]?.buffAutomationByAction?.[actionId]?.enabled === true;
}

// The user's card records who gets the buff...
Hooks.on("preCreateChatMessage", (message) => {
  if (message.type !== "action") return;
  const item = message.itemSource;
  const grant = grantFor(item);
  if (!grant || nevelaApplies(item, message.system.action?.id)) return;
  if (grant.allyOnly && !message.system.targets?.length) return ui.notifications.warn(`${item.name}: target the ally you touch.`);
  const targets = message.system.targets?.length ? message.system.targets : [ChatMessage.implementation.getSpeakerActor(message.speaker)?.uuid];
  message.updateSource({ [`flags.${MODULE_ID}.grant`]: { targets: targets.filter(Boolean) } });
});

// ...and the active GM creates it (players can't add items to other characters)
onGmRequest("grant", async (message, grant) => {
  const caster = ChatMessage.implementation.getSpeakerActor(message.speaker);
  const def = grantFor(message.itemSource);
  if (!def || !caster) return;
  const data = await def.buff(caster);
  for (const uuid of grant.targets) {
    const doc = fromUuidSync(uuid);
    const actor = doc?.actor ?? doc;
    if (!(actor instanceof Actor)) continue;
    // Recast on someone who has it: switch the existing one back on
    const existing = actor.itemTypes.buff.find((b) => b.name === data.name);
    if (existing) await existing.update({ "system.active": true, "system.changes": data.system.changes ?? existing._source.system.changes });
    else await actor.createEmbeddedDocuments("Item", [foundry.utils.deepClone(data)]);
  }
  await def.onCaster?.(caster);
});

registerFootnote((item) => {
  const grant = grantFor(item);
  if (!grant) return null;
  return [grant.allyOnly ? "Automated: target the ally you touch, then use this; the buff is applied for you." : "Automated: using this puts the buff on your targets (yourself if none)."];
});
