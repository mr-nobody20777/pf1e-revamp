// Character traits whose pf-content items leave a choice blank or don't apply their rule:
//   Criminal: "Select one of the following skills: Disable Device, Intimidate, or Sleight of Hand. You
//     gain a +1 trait bonus on that skill, and it is always a class skill for you."
//   Dilettante Artist (Elf): "+1 trait bonus to one category of Perform checks and a +1 trait bonus to
//     Diplomacy checks. One of these skills (your choice) is always a class skill for you."
//   Magical Knack: "Pick a class when you gain this trait—your caster level in that class gains a +2
//     trait bonus as long as this bonus doesn't increase your caster level higher than your current Hit
//     Dice." (pf-content's formula always gives +2; a single-class caster's level already equals its
//     Hit Dice, so RAW it gives nothing until the character multiclasses.)
//   Gifted Adept: "Pick one spell when you choose this trait. Whenever you cast that spell, its effects
//     manifest at +1 caster level."
//   Swordlord's Page (Brevoy): "+1 attack bonus to confirm critical hits when using an edged weapon you
//     are proficient with."
// Adding one of the choice traits asks for the choice; its footnote can change it later. The choice is
// stored on the trait (flags["pf1e-revamp"].traitChoice).

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { esc, wrapMethod, searchSelects, titleFor } from "./util.mjs";

const FLAG = "traitChoice";
const baseName = (name) => name.replace(/\s*\([^()]*\)\s*$/, "").trim();
const skillLabel = (actor, key) => actor?.getSkillInfo?.(key)?.fullName ?? pf1.config.skills[key] ?? key;
const casterClasses = (actor) => {
  const books = Object.values(actor.system.attributes?.spells?.spellbooks ?? {}).filter((b) => b.inUse);
  return actor.itemTypes.class.filter((c) => books.some((b) => b.class === c.system.tag));
};
const performSkills = (actor) => {
  const subs = Object.keys(actor.system.skills?.prf?.subSkills ?? {}).map((k) => `prf.subSkills.${k}`);
  return subs.length ? subs : ["prf"];
};

const RULES = {
  Criminal: {
    choices: [{ key: "skill", label: "Skill", options: (actor) => ["dev", "int", "slt"].map((k) => [k, skillLabel(actor, k)]) }],
    update: (item, { skill }) => ({
      "system.changes": [{ _id: foundry.utils.randomID(8), target: `skill.${skill}`, type: "trait", formula: "1" }],
      "system.classSkills": { [skill]: true },
    }),
    summary: (actor, { skill }) => `+1 trait bonus on ${skillLabel(actor, skill)}, always a class skill.`,
  },
  "Dilettante Artist": {
    choices: [
      { key: "perform", label: "Perform category", options: (actor) => performSkills(actor).map((k) => [k, skillLabel(actor, k)]) },
      { key: "classSkill", label: "Class skill", options: () => [["dip", "Diplomacy"], ["prf", "Perform"]] },
    ],
    update: (item, { perform, classSkill }) => ({
      "system.changes": [
        { _id: foundry.utils.randomID(8), target: "skill.dip", type: "trait", formula: "1" },
        { _id: foundry.utils.randomID(8), target: `skill.${perform}`, type: "trait", formula: "1" },
      ],
      "system.classSkills": { [classSkill]: true },
    }),
    summary: (actor, { perform, classSkill }) => `+1 trait bonus on Diplomacy and ${skillLabel(actor, perform)}; ${classSkill === "dip" ? "Diplomacy" : "Perform"} is always a class skill.`,
  },
  "Magical Knack": {
    choices: [{ key: "class", label: "Class", options: (actor) => casterClasses(actor).map((c) => [c.system.tag, c.name]) }],
    update: (item, picks) => ({
      "system.changes": [{ _id: foundry.utils.randomID(8), target: "cl", type: "trait", formula: `min(2, max(0, @attributes.hd.total - @classes.${picks.class}.level))` }],
    }),
    summary: (actor, picks) => {
      const cls = actor.itemTypes.class.find((c) => c.system.tag === picks.class);
      const bonus = Math.min(2, Math.max(0, (actor.system.attributes.hd?.total ?? 0) - (cls?.system.level ?? 0)));
      return `+${bonus} caster level for ${cls?.name ?? picks.class} (+2, but never above your Hit Dice${bonus === 0 ? ": nothing yet, since that class is all your levels" : ""}).`;
    },
  },
  "Gifted Adept": {
    choices: [{ key: "spell", label: "Spell", options: (actor) => actor.itemTypes.spell.map((s) => [s.name, s.name]).sort((a, b) => a[1].localeCompare(b[1])) }],
    update: () => ({}),
    summary: (actor, { spell }) => `${spell} is cast at +1 caster level.`,
  },
};

const ruleFor = (item) => (item?.type === "feat" && item.system.subType === "trait" ? RULES[baseName(item.name)] ?? null : null);

export async function chooseTrait(item, { picks = null } = {}) {
  const rule = ruleFor(item);
  const actor = item.actor;
  if (!rule || !actor) return;
  if (!picks) {
    const current = item.getFlag(MODULE_ID, FLAG) ?? {};
    const fields = rule.choices
      .map((c) => {
        const options = c.options(actor);
        if (!options.length) return `<p><strong>${esc(c.label)}:</strong> none available on this character yet.</p>`;
        return `<p><label><strong>${esc(c.label)}:</strong> <select name="${c.key}">${options.map(([v, l]) => `<option value="${esc(v)}" ${current[c.key] === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label></p>`;
      })
      .join("");
    picks = await foundry.applications.api.DialogV2.wait({
      window: { title: titleFor(`${item.name}: choose`, actor) },
      content: `<div>${fields}</div>`,
      render: (event, dialog) => searchSelects(dialog.element), // e.g. Gifted Adept's spell list
      buttons: [
        { action: "ok", label: "Save", default: true, callback: (event, button) => Object.fromEntries(rule.choices.map((c) => [c.key, button.form.elements[c.key]?.value]).filter(([, v]) => v)) },
        { action: "cancel", label: "Later" },
      ],
      rejectClose: false,
    });
    if (!picks || typeof picks === "string" || rule.choices.some((c) => !picks[c.key])) return;
  }
  await item.update({ ...rule.update(item, picks), [`flags.${MODULE_ID}.${FLAG}`]: picks });
  refreshFootnotes(item);
}

Hooks.on("createItem", (item, options, userId) => {
  if (userId !== game.user.id || !item.actor || options.pf1eRevampNoPrompt || !ruleFor(item)) return;
  chooseTrait(item);
});

registerFootnote((item) => {
  const rule = ruleFor(item);
  if (!rule || !item.actor) return null;
  const picks = item.getFlag(MODULE_ID, FLAG);
  const content = [picks ? `Automated: ${rule.summary(item.actor, picks)}` : "Choice not made yet: the trait doesn't apply until it is."];
  if (item.isOwner) content.push(footnoteButton(picks ? "Change…" : "Choose…", "Make this trait's choice", () => chooseTrait(item)));
  return content;
});

/* -------------------------------------------- */
/*  Gifted Adept and Swordlord's Page           */
/* -------------------------------------------- */

const giftedSpell = (actor) => actor?.itemTypes?.feat.find((f) => ruleFor(f) === RULES["Gifted Adept"])?.getFlag(MODULE_ID, FLAG)?.spell ?? null;
const hasSwordlordsPage = (actor) => actor?.itemTypes?.feat.some((f) => f.system.subType === "trait" && baseName(f.name) === "Swordlord's Page");
const CRIT = "pf1eRevampCritConfirm";
const EDGED = ["slashing", "piercing"];

Hooks.once("setup", () => {
  // Gifted Adept: the chosen spell's effects use +1 caster level (before any of its rolls)
  wrapMethod("pf1.actionUse.ActionUse.prototype.alterRollData", function (wrapped, ...args) {
    const result = wrapped(...args);
    const item = this.item;
    if (item?.type === "spell" && giftedSpell(this.actor) === item.name && this.shared.rollData) this.shared.rollData.cl = (this.shared.rollData.cl ?? 0) + 1;
    return result;
  });
  // Mark confirmation rolls, which PF1 otherwise rolls exactly like attacks
  wrapMethod("pf1.actionUse.ChatAttack.prototype.addAttack", async function (wrapped, options = {}) {
    if (this.rollData) this.rollData[CRIT] = !!options.critical;
    try {
      return await wrapped(options);
    } finally {
      if (this.rollData) delete this.rollData[CRIT];
    }
  });
});

// Swordlord's Page: +1 to confirm with an edged (slashing or piercing) weapon you're proficient with
Hooks.on("pf1PreAttackRoll", (action, config, rollData, rollOptions, parts) => {
  if (!rollData[CRIT] || !config.proficient || !hasSwordlordsPage(action.actor)) return;
  const types = (action.damage?.parts ?? []).flatMap((p) => [...(p.types ?? [])]);
  if (types.some((t) => EDGED.includes(t))) parts.push("1[Swordlord's Page]");
});

registerFootnote((item) => {
  if (item.type !== "feat" || item.system.subType !== "trait" || baseName(item.name) !== "Swordlord's Page") return null;
  return ["Automated: +1 on critical confirmation rolls with slashing or piercing weapons you're proficient with."];
});

/* -------------------------------------------- */
/*  Student of Philosophy                       */
/* -------------------------------------------- */

/* "You can use your Intelligence modifier in place of your Charisma modifier on Diplomacy checks to
   persuade others and on Bluff checks to convince others that a lie is true. (This trait does not
   affect Diplomacy checks to gather information or Bluff checks to feint in combat.)" Which kind of
   check it is isn't known when rolling, so the card shows both: the normal total, and below it the
   total with Int, for persuading or lying. Only when Int is the higher modifier. */
const PHILOSOPHY_SKILLS = { dip: "persuading only", blf: "convincing someone a lie is true only" };
const hasStudentOfPhilosophy = (actor) => actor?.itemTypes?.feat.some((f) => f.system.subType === "trait" && baseName(f.name) === "Student of Philosophy");

Hooks.on("pf1PreActorRollSkill", (actor, rollOptions, skillId) => {
  const skill = skillId.split(".")[0];
  if (!PHILOSOPHY_SKILLS[skill] || !hasStudentOfPhilosophy(actor)) return;
  const abilities = actor.system.abilities;
  const used = actor.system.skills[skill]?.ability ?? "cha";
  const delta = (abilities.int?.mod ?? 0) - (abilities[used]?.mod ?? 0);
  if (delta <= 0) return;
  rollOptions.messageData = foundry.utils.mergeObject(rollOptions.messageData ?? {}, { flags: { [MODULE_ID]: { altAbility: { delta, skill } } } });
});

Hooks.on("renderChatMessagePF", (message, html) => {
  const alt = message.flags[MODULE_ID]?.altAbility;
  const total = message.rolls?.[0]?.total;
  if (!alt || !Number.isFinite(total)) return;
  const line = document.createElement("div");
  line.className = `${MODULE_ID}-alt-total`;
  line.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #69c; font-style: italic;";
  line.innerHTML = `With Int (Student of Philosophy; ${esc(PHILOSOPHY_SKILLS[alt.skill])}): <strong>${total + alt.delta}</strong>`;
  (html.querySelector(".dice-roll") ?? html.querySelector(".message-content"))?.after(line);
});

registerFootnote((item) => {
  if (item.type !== "feat" || item.system.subType !== "trait" || baseName(item.name) !== "Student of Philosophy") return null;
  return ["Automated: Diplomacy and Bluff cards also show the total with your Intelligence modifier (when it's higher), to use when persuading or lying."];
});
