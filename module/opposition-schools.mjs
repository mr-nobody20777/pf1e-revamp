// Wizard opposition schools: "A wizard that chooses to specialize in one school of magic must select
// two other schools as his opposition schools ... A wizard who prepares spells from his opposition
// schools must use two spell slots of that level to prepare the spell ... In addition, a specialist
// takes a –4 penalty on any skill checks made when crafting a magic item that has a spell from one of
// his opposition schools as a prerequisite. A universalist wizard can prepare spells from any school
// without restriction."
//
// The choice is stored on the school item (flags["pf1e-revamp"].opposition = ["evo", "nec"]) and asked
// for when a specialist school or subschool is granted (subclass.mjs), or from its footnote. Spells
// of those schools in the wizard's spellbook get PF1's slot cost of 2, so the sheet counts slots right.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { esc, plainText, spellbookKey } from "./util.mjs";

const FLAG = "opposition";
const COST_FLAG = "oppositionCost"; // set on spells whose slot cost we changed

const isSchool = (item) => item?.type === "feat" && / (Sub)?[Ss]chool$/.test(item.name) && !["Arcane School", "Universalist School"].includes(item.name);

/** The school a specialist school or subschool belongs to, as PF1's key ("div"). */
export function specialtyOf(school) {
  const associated = plainText(school.system.description?.value).match(/Associated School:\s*([A-Z][a-z]+)/)?.[1];
  const name = associated ?? school.name.replace(/ (Sub)?[Ss]chool$/, "");
  return Object.entries(pf1.config.spellSchools).find(([, label]) => label.toLowerCase() === name.toLowerCase())?.[0] ?? null;
}

const schoolItem = (actor) => actor?.itemTypes?.feat.find((f) => isSchool(f) && f.getFlag(MODULE_ID, FLAG)) ?? null;
const oppositionOf = (actor) => schoolItem(actor)?.getFlag(MODULE_ID, FLAG) ?? [];

/** Ask which two schools are opposed. */
export async function promptOpposition(actor, school) {
  const specialty = specialtyOf(school);
  const current = school.getFlag(MODULE_ID, FLAG) ?? [];
  const options = Object.entries(pf1.config.spellSchools).filter(([key]) => key !== specialty && key !== "uni");
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: `${school.name}: opposition schools` },
    content: `<p>Choose <strong>two</strong> opposition schools. Preparing their spells takes two slots, and crafting items that need them takes a −4 penalty.</p>
      ${options.map(([key, label]) => `<label style="display:block"><input type="checkbox" name="school" value="${key}" ${current.includes(key) ? "checked" : ""}> ${esc(label)}</label>`).join("")}`,
    buttons: [
      {
        action: "ok",
        label: "Set opposition schools",
        default: true,
        callback: (event, button) => [...button.form.querySelectorAll('input[name="school"]:checked')].map((el) => el.value),
      },
      { action: "cancel", label: "Later" },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(chosen)) return;
  if (chosen.length !== 2) return ui.notifications.warn("Choose exactly two opposition schools."), promptOpposition(actor, school);
  return setOpposition(actor, school, chosen);
}

/** Record the opposition schools and set the slot cost of the wizard's spells to match. */
export async function setOpposition(actor, school, schools) {
  await school.setFlag(MODULE_ID, FLAG, schools);
  await applySlotCosts(actor);
  refreshFootnotes(school);
}

async function applySlotCosts(actor) {
  const book = spellbookKey(actor, "wizard");
  const opposed = oppositionOf(actor);
  const updates = [];
  for (const spell of actor.itemTypes.spell) {
    const wanted = spell.system.spellbook === book && opposed.includes(spell.system.school);
    const ours = spell.getFlag(MODULE_ID, COST_FLAG);
    if (wanted && !ours) updates.push({ _id: spell.id, "system.slotCost": 2, [`flags.${MODULE_ID}.${COST_FLAG}`]: true });
    else if (!wanted && ours) updates.push({ _id: spell.id, "system.slotCost": 1, [`flags.${MODULE_ID}.-=${COST_FLAG}`]: null });
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

// Spells added to the wizard's spellbook later
Hooks.on("createItem", (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "spell" || !item.actor) return;
  if (oppositionOf(item.actor).includes(item.system.school) && item.system.spellbook === spellbookKey(item.actor, "wizard")) {
    item.update({ "system.slotCost": 2, [`flags.${MODULE_ID}.${COST_FLAG}`]: true });
  }
});

// Removing the school removes the costs
Hooks.on("deleteItem", (item, options, userId) => {
  if (userId === game.user.id && item.actor && isSchool(item) && item.getFlag(MODULE_ID, FLAG)) applySlotCosts(item.actor);
});

registerFootnote((item) => {
  if (item.type === "spell" && item.getFlag(MODULE_ID, COST_FLAG)) {
    return [`Opposition school (${esc(pf1.config.spellSchools[item.system.school] ?? item.system.school)}): preparing it takes two slots, and crafting an item that needs it takes a −4 penalty.`];
  }
  if (!isSchool(item) || !item.actor || !specialtyOf(item)) return null;
  const opposed = item.getFlag(MODULE_ID, FLAG);
  const content = [opposed ? `Opposition schools: ${opposed.map((k) => pf1.config.spellSchools[k]).join(", ")} (their spells cost two slots).` : "Opposition schools not chosen yet."];
  if (item.isOwner) content.push(footnoteButton(opposed ? "Change…" : "Choose…", "Choose the two opposition schools", () => promptOpposition(item.actor, item)));
  return content;
});
