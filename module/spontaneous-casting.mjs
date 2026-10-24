// Cleric Spontaneous Casting: "The cleric can 'lose' any prepared spell that is not an orison or
// domain spell in order to cast any cure spell of the same spell level or lower (a cure spell is any
// spell with 'cure' in its name). An evil cleric ... can convert them to inflict spells ... A cleric
// who is neither good nor evil and whose deity is neither good nor evil can convert spells to either
// cure spells or inflict spells (player's choice). Once the player makes this choice, it cannot be
// reversed."
//
// Each eligible prepared spell gets a button on the spellbook tab (and in its footnote). It offers
// the cure (or inflict) spells of that level or lower from PF1's spell list, spends one preparation
// of the lost spell, and casts the chosen spell through PF1 without spending a slot of its own. The
// chosen spell is added to the cleric's spellbook (0 prepared) the first time, so it's reused after.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton } from "./footnote.mjs";
import { esc, spellbookKey, titleFor } from "./util.mjs";

const CHOICE_FLAG = "spontaneousKind"; // "cure" | "inflict", for clerics who are neither good nor evil

const clericBook = (actor) => spellbookKey(actor, "cleric");

/** A prepared cleric spell that can be lost: not an orison or domain spell, with a preparation left. */
export function canConvert(spell) {
  if (spell?.type !== "spell" || !spell.actor) return false;
  const book = clericBook(spell.actor);
  return !!book && spell.system.spellbook === book && spell.system.level >= 1 && !spell.system.domain && (spell.system.preparation?.value ?? 0) > 0;
}

/** "cure" or "inflict" by alignment; neutral clerics choose once. */
async function spontaneousKind(actor) {
  const alignment = actor.system.details?.alignment ?? "";
  if (alignment[1] === "g") return "cure";
  if (alignment[1] === "e") return "inflict";
  const chosen = actor.getFlag(MODULE_ID, CHOICE_FLAG);
  if (chosen) return chosen;
  const kind = await foundry.applications.api.DialogV2.wait({
    window: { title: titleFor("Spontaneous casting", actor) },
    content: "<p>A cleric who is neither good nor evil chooses once whether to convert prepared spells into <strong>cure</strong> or <strong>inflict</strong> spells. This can't be changed later (it also decides positive or negative channel energy).</p>",
    buttons: [
      { action: "cure", label: "Cure spells", icon: "fa-solid fa-heart" },
      { action: "inflict", label: "Inflict spells", icon: "fa-solid fa-skull" },
    ],
    rejectClose: false,
  });
  if (kind === "cure" || kind === "inflict") await actor.setFlag(MODULE_ID, CHOICE_FLAG, kind);
  return kind === "cure" || kind === "inflict" ? kind : null;
}

/** Cure (or inflict) spells on the cleric list at this level or lower, highest first. */
export async function spellOptions(kind, maxLevel) {
  const pack = game.packs.get("pf1.spells");
  const index = await pack.getIndex({ fields: ["system.learnedAt.class"] });
  const word = new RegExp(`\\b${kind}\\b`, "i");
  return index
    .map((e) => ({ entry: e, level: e.system?.learnedAt?.class?.cleric }))
    .filter((o) => word.test(o.entry.name) && Number.isFinite(o.level) && o.level <= maxLevel)
    .sort((a, b) => b.level - a.level || a.entry.name.localeCompare(b.entry.name));
}

/** The chosen spell in the cleric's spellbook, added (0 prepared) if it isn't there yet. */
async function spellInBook(actor, book, option) {
  const existing = actor.itemTypes.spell.find((s) => s.name === option.entry.name && s.system.spellbook === book);
  if (existing) return existing;
  const doc = await game.packs.get("pf1.spells").getDocument(option.entry._id);
  const data = game.items.fromCompendium(doc, { clearFolder: true });
  Object.assign(data.system, { spellbook: book, level: option.level, preparation: { value: 0, max: 0 } });
  data.flags = { ...(data.flags ?? {}), [MODULE_ID]: { spontaneous: true } };
  const [created] = await actor.createEmbeddedDocuments("Item", [data]);
  return created;
}

/**
 * Lose a prepared spell to cast a cure/inflict spell of its level or lower.
 * @param {string} [spellName] Skip the picker and cast this one (macros, tests).
 */
export async function convert(spell, { spellName = null, skipDialog } = {}) {
  if (!canConvert(spell)) return ui.notifications.warn(`${spell?.name}: not a prepared cleric spell that can be converted.`);
  const actor = spell.actor;
  const kind = await spontaneousKind(actor);
  if (!kind) return;
  const options = await spellOptions(kind, spell.system.level);
  if (!options.length) return ui.notifications.warn(`No ${kind} spells of level ${spell.system.level} or lower found.`);

  let option = spellName ? options.find((o) => o.entry.name === spellName) : null;
  if (!option) {
    const picked = await foundry.applications.api.DialogV2.wait({
      window: { title: titleFor(`Spontaneous casting: lose ${spell.name}`, actor) },
      content: `<p>Lose one prepared <strong>${esc(spell.name)}</strong> (level ${spell.system.level}) to cast:</p>`,
      buttons: [
        ...options.map((o, i) => ({ action: `s${i}`, label: `${o.entry.name} (${o.level})`, default: i === 0, callback: () => i })),
        { action: "cancel", label: "Cancel" },
      ],
      rejectClose: false,
    });
    if (typeof picked !== "number") return;
    option = options[picked];
  }

  const book = spell.system.spellbook;
  const target = await spellInBook(actor, book, option);
  const prepared = spell.system.preparation.value;
  await spell.update({ "system.preparation.value": prepared - 1 });
  const result = await target.use({ cost: 0, ...(skipDialog !== undefined ? { skipDialog } : {}) });
  // Cancelled in PF1's dialog: the prepared spell isn't lost
  if (!result) await spell.update({ "system.preparation.value": prepared });
  return result;
}

// Spellbook tab: a button next to each convertible spell's Use button
Hooks.on("renderActorSheetPF", (app, html) => {
  const actor = app.actor;
  if (!actor?.isOwner || !clericBook(actor)) return;
  const root = html[0] ?? html;
  for (const row of root.querySelectorAll("li.item[data-item-id]")) {
    const spell = actor.items.get(row.dataset.itemId);
    if (!canConvert(spell)) continue;
    const cell = row.querySelector(".item-actions");
    if (!cell || cell.querySelector(`.${MODULE_ID}-spontaneous`)) continue;
    const a = document.createElement("a");
    a.className = `item-control ${MODULE_ID}-spontaneous`;
    a.dataset.tooltip = "Spontaneous casting: lose this spell to cast a cure (or inflict) spell";
    a.innerHTML = '<i class="fa-solid fa-hand-holding-medical" inert></i>';
    a.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      convert(spell);
    });
    cell.append(a);
  }
});

registerFootnote((item) => {
  if (!canConvert(item)) return null;
  const content = ["Spontaneous casting: lose one preparation of this spell to cast a cure (or inflict) spell of its level or lower."];
  if (item.isOwner) content.push(footnoteButton("Convert…", "Pick the cure/inflict spell to cast", () => convert(item)));
  return content;
});
