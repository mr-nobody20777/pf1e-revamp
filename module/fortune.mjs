// Effects on the next d20 roll(s): roll twice and keep the better (Bit of Luck), a stored d20 result
// (Prescience), and one-time bonuses (True Strike, Guidance). They apply to attack rolls and to the
// actor's saves, skill checks, ability checks, concentration and caster level checks.
//
// State lives on buffs, so it survives a refresh and shows on the sheet:
//   flags["pf1e-revamp"].fortune = "best"             every d20 is 2d20 keep-highest (Bit of Luck)
//   flags["pf1e-revamp"].prescience = { value, armed } once armed, the next d20 uses `value`
//   NEXT_ROLL below                                   a bonus on the next roll, then the buff turns off
//
// Rules:
//   Bit of Luck (Luck domain): "For the next round, any time the target rolls a d20, he may roll
//     twice and take the more favorable result." Taking the better roll is never worse, so it's automatic.
//   Prescience (Foresight subschool): "At the beginning of your turn, you may, as a free action, roll a
//     single d20. At any point before your next turn, you may use the result of this roll as the result
//     of any d20 roll you are required to make. If you do not use the d20 result before your next turn,
//     it is lost." The wizard sees the number first, so they arm it for the roll they choose.
//   True Strike: "Your next single attack roll (if it is made before the end of the next round) gains a
//     +20 insight bonus."
//   Guidance: "+1 competence bonus on a single attack roll, saving throw, or skill check."
// The buffs are put on characters by buff-grants.mjs (Bit of Luck, Guidance) or the Buff Library.

import { MODULE_ID, ATTACK_ACTIONS } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { esc, isActiveGM, ownerWhisper } from "./util.mjs";
import { TYPED, highestOfType } from "./roll-effects.mjs";

const KEEP_HIGHEST = "2d20kh";
const MARK = "pf1eRevampFortune";

// One-time bonuses: the first matching active buff applies to the next roll of these kinds
// ("attack" or a PF1 actor roll: "Save", "Skill", ...), then switches off.
const NEXT_ROLL = [
  { label: "True Strike", bonus: 20, type: "insight", kinds: ["attack"], match: (b) => b.flags[MODULE_ID]?.trueStrike },
  { label: "Guidance", bonus: 1, type: "competence", kinds: ["attack", "Save", "Skill"], match: (b) => b.name.toLowerCase() === "guidance" },
  // Luck variant channeling: "a channel bonus or a luck bonus (creature's choice) on one roll (attack roll, CMB check,
  // saving throw, or skill check) made before the end of your next turn"
  { label: "Luck channel", bonus: (b) => b.flags[MODULE_ID].channelLuck.bonus, type: (b) => b.flags[MODULE_ID].channelLuck.type ?? "luck", kinds: ["attack", "Save", "Skill"], match: (b) => !!b.flags[MODULE_ID]?.channelLuck },
];
// These bonuses are "on a single roll" of the creature's choosing: every roll window gets a ticked box per
// bonus, and unticking it saves the bonus for a later roll. Rolls made without a window use it.
const SKIPPED = "pf1eRevampNextRollSkipped";

function nextRollToggle(def, buff, value, onChange) {
  const label = document.createElement("label");
  label.className = `checkbox ${MODULE_ID}-next-roll`;
  label.dataset.tooltip = `${buff.name}: unticked, this roll goes without it and the bonus stays for a later roll`;
  label.innerHTML = `<input type="checkbox" checked> ${esc(def.label)} +${value} (one roll)`;
  label.querySelector("input").addEventListener("change", (event) => onChange(event.currentTarget.checked));
  return label;
}
const bonusOf = (def, buff) => (typeof def.bonus === "function" ? def.bonus(buff) : def.bonus);
const typeOf = (def, buff) => (typeof def.type === "function" ? def.type(buff) : def.type);

const activeBuffs = (actor) => (actor?.itemTypes?.buff ?? []).filter((b) => b.isActive);
const hasFortune = (actor) => activeBuffs(actor).some((b) => b.flags[MODULE_ID]?.fortune === "best");
const armedPrescience = (actor) => activeBuffs(actor).find((b) => b.flags[MODULE_ID]?.prescience?.armed) ?? null;

/**
 * One-roll bonuses for this roll, worth only what's above a bonus of the same type the roll already has
 * (Guidance's +1 competence adds nothing beside Inspire Courage's +3 competence). One that would add
 * nothing isn't offered, so it isn't used up either.
 */
function nextRollBonuses(actor, kind, roll = null) {
  const active = activeBuffs(actor);
  return NEXT_ROLL.filter((def) => def.kinds.includes(kind))
    .map((def) => ({ def, buff: active.find(def.match) }))
    .filter((b) => b.buff)
    .map((b) => ({ ...b, value: bonusOf(b.def, b.buff) - (roll ? highestOfType(actor, roll, typeOf(b.def, b.buff)) : 0) }))
    .filter((b) => b.value > 0);
}

/** Use up one-time effects after the roll they applied to. */
async function consume(actor, ids) {
  for (const item of ids.map((id) => actor?.items.get(id)).filter(Boolean)) {
    if (item.flags[MODULE_ID]?.prescience) await item.delete();
    else await item.update({ "system.active": false });
  }
}

/* -------------------------------------------- */
/*  Attack rolls                                */
/* -------------------------------------------- */

Hooks.on("pf1PreAttackRoll", (action, config, rollData, rollOptions, parts) => {
  if (!ATTACK_ACTIONS.includes(action.actionType)) return;
  const actor = action.actor;
  const used = (rollData[MARK] ??= []); // one-time effects already used by this action's attacks

  // A stored result covers one roll; the rest of a full attack rolls normally
  const prescience = armedPrescience(actor);
  if (prescience && !used.includes(prescience.id)) {
    rollOptions.staticRoll = prescience.flags[MODULE_ID].prescience.value;
    rollOptions.flavor = `${rollOptions.flavor ?? ""} (Prescience)`.trim();
    used.push(prescience.id);
  } else if (hasFortune(actor) && !rollData.d20) {
    rollData.d20 = KEEP_HIGHEST;
  }

  for (const { def, buff, value } of nextRollBonuses(actor, "attack", { kind: "attack", action })) {
    if (used.includes(buff.id) || rollData[SKIPPED]?.includes(buff.id)) continue;
    parts.push(`${value}[${def.label}]`);
    // Same-type situational bonuses (Quarry's insight) don't stack with it
    (rollData[TYPED] ??= []).push({ type: typeOf(def, buff), value });
    used.push(buff.id);
  }
});

// The attack window: one ticked box per one-roll bonus
Hooks.on("renderAttackDialog", (app, html) => {
  const root = html[0] ?? html;
  const actor = app.action?.actor;
  if (!actor || !ATTACK_ACTIONS.includes(app.action.actionType) || root.querySelector(`.${MODULE_ID}-next-roll`)) return;
  const flags = root.querySelector(".form-group.flags");
  const rollData = app.rollData;
  if (!flags || !rollData) return;
  for (const { def, buff, value } of nextRollBonuses(actor, "attack", { kind: "attack", action: app.action })) {
    flags.append(nextRollToggle(def, buff, value, (on) => {
      const skipped = new Set(rollData[SKIPPED] ?? []);
      on ? skipped.delete(buff.id) : skipped.add(buff.id);
      rollData[SKIPPED] = [...skipped];
    }));
  }
});

// Fortune changes rollData.d20 for this action only; one-time effects are used up afterwards
Hooks.on("pf1PostActionUse", async (actionUse) => {
  const used = actionUse.shared?.rollData?.[MARK];
  if (used?.length) await consume(actionUse.actor, used);
});

/* -------------------------------------------- */
/*  Saves, skills, ability checks, CL and       */
/*  concentration checks                        */
/* -------------------------------------------- */

const pending = new Map(); // actor id → { ids: always used up once rolled, toggles: one-roll bonuses, name }

// With a roll window, one-roll bonuses go in its Situational Bonus field, where a ticked box can take them
// out again; without one (shift-click), they're added to the roll directly. Either way a bonus is used up
// only if it ended up in the roll.
const splitBonus = (text) => (text ?? "").split(/\s*\+\s*/).map((t) => t.trim()).filter(Boolean);

// The roll, for capping one-roll bonuses by same-type bonuses on it (saves and skills only)
const ROLL_OF = { Save: (id) => ({ kind: "save", saveId: id }), Skill: (id) => ({ kind: "skill", skillId: id }), Ability: (id) => ({ kind: "ability", abilityId: id }) };

function preActorRoll(kind) {
  return (actor, rollOptions, id) => {
    const ids = [];
    const toggles = [];
    const prescience = armedPrescience(actor);
    if (prescience && rollOptions.staticRoll == null) {
      rollOptions.staticRoll = prescience.flags[MODULE_ID].prescience.value;
      rollOptions.flavor = `${rollOptions.flavor ?? ""} (Prescience)`.trim();
      ids.push(prescience.id);
    } else if (hasFortune(actor) && (rollOptions.dice ?? "1d20") === "1d20") {
      rollOptions.dice = KEEP_HIGHEST;
    }
    const windowed = !(rollOptions.skipDialog ?? pf1.documents.settings.getSkipActionPrompt());
    for (const { def, buff, value } of nextRollBonuses(actor, kind, typeof id === "string" ? ROLL_OF[kind]?.(id) : null)) {
      const part = `${value}[${def.label}]`;
      if (!windowed) (rollOptions.parts ??= []).push(part); // with a window, the field gets it when it opens
      toggles.push({ def, buff, value, part });
    }
    if (ids.length || toggles.length) pending.set(actor.id, { ids, toggles, name: actor.name });
  };
}

// The roll window (skill, save, ability check...): one ticked box per bonus, kept in step with the field
Hooks.on("renderDialogV2", (app, element) => {
  const input = element.querySelector('input[name="bonus"]');
  if (!input || element.querySelector(`.${MODULE_ID}-next-roll`)) return;
  const entry = [...pending.values()].find((e) => e.toggles.length && !e.shown && (app.title ?? "").startsWith(`${e.name}:`));
  if (!entry) return;
  entry.shown = true;
  // In the field rather than PF1's bonus option: PF1 ignores an emptied field and would keep the option
  input.value = [...splitBonus(input.value), ...entry.toggles.map((t) => t.part)].join(" + ");
  const row = document.createElement("div");
  row.className = "form-group";
  for (const t of entry.toggles) {
    row.append(nextRollToggle(t.def, t.buff, t.value, (on) => {
      const parts = splitBonus(input.value).filter((p) => p !== t.part);
      input.value = (on ? [...parts, t.part] : parts).join(" + ");
    }));
  }
  input.closest(".form-group").before(row);
  app.setPosition?.({ height: "auto" });
});

function postActorRoll(actor, result) {
  const entry = pending.get(actor.id);
  if (!entry) return;
  pending.delete(actor.id);
  if (!result) return; // the roll window was cancelled: keep everything
  // A one-roll bonus is used up only if it was in the roll (it may have been unticked or deleted)
  const formula = result.rolls?.[0]?.formula ?? "";
  const used = entry.toggles.filter((t) => formula.includes(`[${t.def.label}]`)).map((t) => t.buff.id);
  if (entry.ids.length || used.length) consume(actor, [...entry.ids, ...used]);
}

for (const kind of ["Save", "Skill", "Ability", "Cl", "Concentration"]) {
  Hooks.on(`pf1PreActorRoll${kind}`, preActorRoll(kind));
  Hooks.on(`pf1ActorRoll${kind}`, postActorRoll);
}

/* -------------------------------------------- */
/*  Prescience                                  */
/* -------------------------------------------- */

const isPrescience = (item) => item?.type === "feat" && item.name === "Prescience";
const prescienceBuffs = (actor) => (actor?.itemTypes?.buff ?? []).filter((b) => b.flags[MODULE_ID]?.prescience);

// Using Prescience (PF1 spends the use) rolls the d20 and stores it on a buff
Hooks.on("pf1PostActionUse", async (actionUse) => {
  if (!isPrescience(actionUse.item) || !actionUse.actor?.isOwner) return;
  const actor = actionUse.actor;
  const roll = await new Roll("1d20").evaluate();
  const value = roll.total;
  for (const old of prescienceBuffs(actor)) await old.delete();
  await actor.createEmbeddedDocuments("Item", [
    {
      name: `Prescience: ${value}`,
      type: "buff",
      img: actionUse.item.img,
      system: { subType: "temp", active: true, description: { value: `<p>You may use ${value} as the result of any d20 roll you make before your next turn. Arm it before the roll you want it for.</p>` } },
      flags: { [MODULE_ID]: { prescience: { value, armed: false } } },
    },
  ]);
  await roll.toMessage({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    flavor: `Prescience: ${value} stored until the start of your next turn`,
    flags: { [MODULE_ID]: { prescienceRoll: actor.uuid } },
  });
});

async function arm(actor) {
  const buff = prescienceBuffs(actor)[0];
  if (!buff) return ui.notifications.warn("No Prescience result stored.");
  const armed = !buff.flags[MODULE_ID].prescience.armed;
  await buff.update({ [`flags.${MODULE_ID}.prescience.armed`]: armed, name: `Prescience: ${buff.flags[MODULE_ID].prescience.value}${armed ? " (armed)" : ""}` });
  refreshFootnotes(buff);
}

// At the start of the wizard's turn the old result is lost and a new one can be rolled. The
// previous turn's offer is removed so the chat log doesn't fill with them.
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  if (!isActiveGM()) return;
  const actor = combat.combatants.get(current.combatantId)?.actor;
  const item = actor?.items.find(isPrescience);
  if (!item) return;
  for (const old of prescienceBuffs(actor)) await old.delete();
  const staleOffers = game.messages.contents.slice(-100).filter((m) => m.flags[MODULE_ID]?.prescienceOffer === item.uuid);
  if (staleOffers.length) await ChatMessage.implementation.deleteDocuments(staleOffers.map((m) => m.id));
  if (!(item.system.uses?.value > 0)) return;
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: ownerWhisper(actor),
    content: `<p><strong>Prescience</strong> (${item.system.uses.value} left today): roll a d20 to use on any roll before your next turn?</p>`,
    flags: { [MODULE_ID]: { prescienceOffer: item.uuid } },
  });
});

Hooks.on("renderChatMessagePF", (message, html) => {
  const flags = message.flags[MODULE_ID];
  if (!flags?.prescienceOffer && !flags?.prescienceRoll) return;
  const content = html.querySelector(".message-content");
  if (flags.prescienceOffer) {
    const item = fromUuidSync(flags.prescienceOffer);
    if (item?.isOwner) content?.append(footnoteButton("Roll Prescience", "Spend a use and roll the d20", () => item.use({ skipDialog: true })));
  }
  if (flags.prescienceRoll) {
    const actor = fromUuidSync(flags.prescienceRoll);
    if (actor?.isOwner && prescienceBuffs(actor).length) content?.append(footnoteButton("Use it on my next roll", "Arm the stored result for your next d20 roll", () => arm(actor)));
  }
});

/* -------------------------------------------- */
/*  Footnotes                                   */
/* -------------------------------------------- */

registerFootnote((item) => {
  const p = item.flags?.[MODULE_ID]?.prescience;
  if (p) {
    const content = [p.armed ? `Armed: your next d20 roll uses ${p.value}.` : `Not armed yet: arm it before the roll you want ${p.value} for.`];
    if (item.isOwner) content.push(footnoteButton(p.armed ? "Disarm" : `Use ${p.value} on my next roll`, "Toggle", () => arm(item.actor)));
    return content;
  }
  if (isPrescience(item)) return ["Automated: using this rolls the d20 and stores it on a buff; arm it from the buff or the chat card for the roll you choose. In combat you're offered the roll at the start of your turn, and an unused result is lost then."];
  if (item.type !== "buff") return null;
  if (item.flags?.[MODULE_ID]?.fortune === "best") return ["Automated: every d20 you roll (attacks, saves, skill and ability checks) is rolled twice, keeping the better result."];
  const luck = item.flags[MODULE_ID]?.channelLuck;
  if (luck) {
    const content = [`Automated: +${luck.bonus} on one attack roll, CMB check, saving throw or skill check before the end of the channeler's next turn. Each roll window has a ticked box for it: untick it to save the bonus for a later roll. Rolls made without a window use it.`];
    if (item.isOwner) {
      // "a channel bonus or a luck bonus (creature's choice)": only matters for stacking with other bonuses
      content.push(footnoteButton(`Make it a ${luck.type === "sacred" ? "luck" : "sacred"} bonus`, `It counts as a ${luck.type} bonus now; your choice only matters for stacking`, () => item.setFlag(MODULE_ID, "channelLuck.type", luck.type === "sacred" ? "luck" : "sacred").then(() => refreshFootnotes(item))));
    }
    return content;
  }
  const next = NEXT_ROLL.find((def) => def.match(item));
  if (!next) return null;
  const content = [`Automated: +${bonusOf(next, item)} on your next ${next.kinds.map((k) => ({ attack: "attack roll or CMB check", Save: "saving throw", Skill: "skill check" })[k]).join(", ")}, then this buff switches off. The roll window has a ticked box for it: untick it to save it for a later roll.`];
  return content;
});
