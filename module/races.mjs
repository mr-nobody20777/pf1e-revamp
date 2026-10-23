// Racial traits. PF1's race items carry the race's fixed numbers (ability modifiers, skill bonuses,
// the human bonus feat and skill ranks) but not its traits: pf-content ships those as separate items
// ("Energy Resistance (Ifrit)", "Darkvision (Ifrit)", "Wildfire Heart"...) that nothing links to the
// race, and the "+2 to one ability score of your choice" isn't applied at all.
//
// Adding a race to a character (or its footnote, for characters already built) opens a review:
//   - standard traits, checked; alternate traits, unchecked, each saying what it replaces
//     ("Replaced Trait(s): Skilled"). Choosing an alternate drops the traits it replaces, including
//     their bonuses on the race item itself (Heart of the Mountains replaces Skilled: the race's
//     extra skill ranks go).
//   - an ability picker for traits that give "+2 to one ability score of your choice".
// Trait items that repeat a bonus the race item already gives are added without it, so nothing
// counts twice. "You have fire resistance 5" traits grant real resistance (see subclass.mjs grants).
// Everything changed is recorded on the race item (flags["pf1e-revamp"].racialTraits) and undone by
// "Remove racial traits" or by deleting the race.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { esc, norm, plainText, onSceneCatchUp, openLink } from "./util.mjs";

const TRAIT_PACK = "pf-content.pf-racial-traits";
const FLAG = "racialTraits";
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const ENERGY = ["acid", "cold", "electric", "electricity", "fire", "sonic"];

const stem = (name) => name.replace(/\s*\([^()]*\)\s*$/, "").trim();
const sameChange = (a, b) => a.target === b.target && String(a.formula).trim() === String(b.formula).trim();

/** "Replaced Trait(s): Skilled, Bonus Feat" → ["Skilled", "Bonus Feat"] */
function replacedBy(doc) {
  // Tags become line breaks: some entries bold each word ("<strong>Replaced</strong> <strong>Trait(s)</strong>")
  const text = (doc.system.description?.value ?? "").replace(/<[^>]+>/g, "\n");
  const m = text.match(/Replaced\s+Trait\(s\)\s*:\s*([^\n]+)/i);
  return m ? m[1].split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean) : [];
}

/**
 * pf-content traits for a race. Tags narrow it down, but some traits are tagged with several races
 * (Elf Blood: Half-Elf, Elf, Human), so the "Race: X" line in the text decides; heritage traits
 * ("Race: Ifrit - Sunsoul") belong to the heritage, not the base race.
 */
async function traitsFor(raceName) {
  const pack = game.packs.get(TRAIT_PACK);
  if (!pack) return [];
  const index = await pack.getIndex({ fields: ["system.tags"] });
  const entries = index.filter((e) => (e.system?.tags ?? []).some((t) => t.trim() === raceName));
  const docs = await Promise.all(entries.map((e) => pack.getDocument(e._id)));
  return docs
    .filter((doc) => (doc.system.description?.value ?? "").match(/<strong>Race<\/strong>\s*:\s*([^<]+)/i)?.[1].trim() === raceName)
    .map((doc) => ({ doc, replaces: replacedBy(doc), choices: (doc.system.changes ?? []).filter((c) => !c.target).length }));
}

const onSheet = (actor, doc) => actor.items.find((i) => i._stats?.compendiumSource === doc.uuid || (i.type === "feat" && norm(i.name) === norm(doc.name)));

/* -------------------------------------------- */
/*  Review dialog                               */
/* -------------------------------------------- */

function abilitySelect(name, disabled) {
  return `<select name="${name}" ${disabled ? "disabled" : ""} style="width:auto; margin-left:0.5em">${ABILITIES.map((a) => `<option value="${a}">${pf1.config.abilities[a]}</option>`).join("")}</select>`;
}

/**
 * @param {object} [choose] Skip the dialog (macros, tests): { alternates: [names], abilities: { traitName: ["str", ...] } }
 */
export async function promptRacialTraits(actor, race, { choose = null } = {}) {
  const traits = await traitsFor(race.name);
  if (!traits.length) return ui.notifications.info(`${race.name}: no racial traits found in ${TRAIT_PACK}.`);
  const standard = traits.filter((t) => !t.replaces.length);
  const alternates = traits.filter((t) => t.replaces.length);

  let picked;
  if (choose) {
    picked = { alternates: alternates.filter((t) => choose.alternates?.includes(t.doc.name)), abilities: choose.abilities ?? {}, standard };
  } else {
    const row = (t, i, kind) => {
      const existing = onSheet(actor, t.doc);
      const selects = Array.from({ length: t.choices }, (_, n) => abilitySelect(`${kind}${i}ab${n}`, kind === "alt")).join("");
      return `<label style="display:block; margin:2px 0">
        <input type="checkbox" name="${kind}" value="${i}" ${kind === "std" ? "checked" : ""} data-replaces="${esc(t.replaces.join("|"))}" data-stem="${esc(stem(t.doc.name))}">
        ${esc(t.doc.name)}${openLink(t.doc.uuid)}${selects}${existing ? ' <em style="opacity:0.7">(already on sheet)</em>' : ""}
        ${t.replaces.length ? `<span style="font-size:11px; opacity:0.75"> — replaces ${esc(t.replaces.join(", "))}</span>` : ""}</label>`;
    };
    picked = await foundry.applications.api.DialogV2.wait({
      window: { title: `${race.name}: racial traits`, resizable: true },
      position: { width: 560 },
      content: `<div style="max-height:65vh; overflow-y:auto">
        <p>Standard traits are checked. Checking an alternate trait unchecks what it replaces.</p>
        <h3>Standard traits</h3>${standard.map((t, i) => row(t, i, "std")).join("")}
        ${alternates.length ? `<h3>Alternate traits</h3>${alternates.map((t, i) => row(t, i, "alt")).join("")}` : ""}</div>`,
      render: (event, dialog) => {
        const form = dialog.element.querySelector("form") ?? dialog.element;
        for (const box of form.querySelectorAll('input[name="alt"]')) {
          box.addEventListener("change", () => {
            for (const sel of box.parentElement.querySelectorAll("select")) sel.disabled = !box.checked;
            if (!box.checked) return;
            const replaced = box.dataset.replaces.split("|").map(norm);
            for (const std of form.querySelectorAll('input[name="std"]')) if (replaced.includes(norm(std.dataset.stem))) std.checked = false;
          });
        }
      },
      buttons: [
        {
          action: "apply",
          label: "Apply racial traits",
          default: true,
          callback: (event, button) => {
            const form = button.form;
            const checked = (name, list) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => list[el.value]);
            const abilities = {};
            for (const [kind, list] of [["std", standard], ["alt", alternates]]) {
              list.forEach((t, i) => {
                if (t.choices) abilities[t.doc.name] = Array.from({ length: t.choices }, (_, n) => form.elements[`${kind}${i}ab${n}`]?.value);
              });
            }
            return { standard: checked("std", standard), alternates: checked("alt", alternates), abilities };
          },
        },
        { action: "cancel", label: "Not now" },
      ],
      rejectClose: false,
    });
    if (!picked || typeof picked === "string") return;
  }
  return applyRacialTraits(actor, race, picked);
}

/* -------------------------------------------- */
/*  Apply / revert                              */
/* -------------------------------------------- */

/** Fire resistance 5 and the like, from a trait's text, as a resistance grant. */
function resistanceGrants(doc) {
  const text = plainText(doc.system.description?.value);
  return [...text.matchAll(/\b(acid|cold|electricity|fire|sonic) resistance (\d+)\b/gi)]
    .map((m) => ({ trait: "eres", type: m[1].toLowerCase() === "electricity" ? "electric" : m[1].toLowerCase(), amount: m[2] }))
    .filter((g) => ENERGY.includes(g.type));
}

async function applyRacialTraits(actor, race, { standard, alternates, abilities }) {
  const replaced = new Set(alternates.flatMap((t) => t.replaces.map(norm)));
  const keep = standard.filter((t) => !replaced.has(norm(stem(t.doc.name))));
  const dropped = standard.filter((t) => replaced.has(norm(stem(t.doc.name))));
  const raceChanges = foundry.utils.deepClone(race._source.system.changes ?? []);

  // A replaced trait's bonuses may live on the race item itself (Skilled → its extra skill ranks)
  const allStandard = (await traitsFor(race.name)).filter((t) => !t.replaces.length);
  const droppedChanges = allStandard.filter((t) => replaced.has(norm(stem(t.doc.name)))).flatMap((t) => t.doc.system.changes ?? []);
  const newRaceChanges = raceChanges.filter((c) => !droppedChanges.some((d) => d.target && sameChange(c, d)));

  const data = [];
  for (const t of [...keep, ...alternates]) {
    if (onSheet(actor, t.doc)) continue;
    const item = game.items.fromCompendium(t.doc, { clearFolder: true });
    const picks = [...(abilities[t.doc.name] ?? [])];
    item.system.changes = (item.system.changes ?? [])
      .map((c) => (c.target ? c : { ...c, target: picks.shift(), type: "racial" }))
      .filter((c) => c.target && !newRaceChanges.some((r) => sameChange(r, c))); // already on the race: don't count twice
    const grants = resistanceGrants(t.doc);
    item.flags = { ...(item.flags ?? {}), [MODULE_ID]: { ...(item.flags?.[MODULE_ID] ?? {}), ...(grants.length ? { grants } : {}), racialTraitOf: race.id } };
    data.push(item);
  }
  const created = data.length ? await actor.createEmbeddedDocuments("Item", data) : [];
  await race.update({
    "system.changes": newRaceChanges,
    [`flags.${MODULE_ID}.${FLAG}`]: { added: created.map((i) => i.id), raceChanges, dropped: dropped.map((t) => t.doc.name) },
  });
  ui.notifications.info(`${race.name}: ${created.length} racial trait(s) added${dropped.length ? `; replaced ${dropped.map((t) => stem(t.doc.name)).join(", ")}` : ""}.`);
}

export async function revertRacialTraits(actor, race) {
  const record = race.getFlag(MODULE_ID, FLAG);
  if (!record) return;
  const ids = record.added.filter((id) => actor.items.has(id));
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  if (actor.items.has(race.id)) await race.update({ "system.changes": record.raceChanges, [`flags.${MODULE_ID}.-=${FLAG}`]: null });
}

/* -------------------------------------------- */
/*  Triggers                                    */
/* -------------------------------------------- */

Hooks.on("createItem", (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "race" || !item.actor || options.pf1eRevampNoPrompt) return;
  promptRacialTraits(item.actor, item);
});

// Deleting the race removes the traits it added (the race's own changes go with it)
Hooks.on("deleteItem", (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "race" || !item.actor) return;
  const record = item.getFlag(MODULE_ID, FLAG);
  const ids = record?.added.filter((id) => item.actor.items.has(id)) ?? [];
  if (ids.length) item.actor.deleteEmbeddedDocuments("Item", ids);
});

// Racial traits already on characters (added by hand): give resistance traits their grant
onSceneCatchUp((item) => {
  if (item.type !== "feat" || item.system.subType !== "racial" || item.flags[MODULE_ID]?.grants) return;
  const grants = resistanceGrants(item);
  if (grants.length && !(item.system.changes ?? []).length) item.setFlag(MODULE_ID, "grants", grants);
});

registerFootnote((item) => {
  if (item.type !== "race" || !item.actor) return null;
  const record = item.getFlag(MODULE_ID, FLAG);
  const content = [record ? `Racial traits applied (${record.added.length} added${record.dropped.length ? `; replaced ${record.dropped.map(stem).join(", ")}` : ""}).` : "Racial traits not reviewed yet."];
  if (item.isOwner) {
    content.push(footnoteButton(record ? "Review again…" : "Review racial traits…", "Choose standard and alternate racial traits", async () => {
      if (record) await revertRacialTraits(item.actor, item);
      await promptRacialTraits(item.actor, item);
      refreshFootnotes(item);
    }));
  }
  return content;
});
