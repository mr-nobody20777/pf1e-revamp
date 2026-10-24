// Subclass powers: sorcerer bloodlines, cleric domains and wizard arcane schools. PF1 ships these as
// text items that mostly don't grant their powers, and many powers don't exist as items at all.
//   - Granting: adding a bloodline/domain/school to a character offers to link its powers into the
//     class's own feature list at their levels (so PF1's leveling grants them), and adds the ones
//     the character already qualifies for. Powers are found by explicit link, by tag, or by the
//     names in the subclass text, in PF1's class abilities and this module's Class Features pack
//     (which holds powers PF1 lacks, like the Solar bloodline's).
//   - Trait grants: features with flags["pf1e-revamp"].grants add energy resistance, damage
//     immunity or condition immunity to the character while it's prepared (nothing is written to
//     the actor, so removing the feature removes the trait).
//   - Bloodline arcana: extra damage per die for spells with a given descriptor.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { evaluate, classLevel, itemsFromSource, classFlagUpdate, createClassFeatures, esc, norm, plainText, openLink, addSearch, isActiveGM, titleFor } from "./util.mjs";
import { variantsAllowed, variantOptions, setVariant, VARIANTS } from "./variant-channeling.mjs";
import { checkPrerequisites } from "./prereqs.mjs";
import { promptOpposition, specialtyOf } from "./opposition-schools.mjs";

const FLAG = "subclass";
const KINDS = [
  { suffix: " Bloodline", className: "Sorcerer", label: "bloodline" },
  { suffix: " Domain", className: "Cleric", label: "domain" },
  { suffix: " School", className: "Wizard", label: "arcane school" },
  { suffix: " Subschool", className: "Wizard", label: "arcane subschool" },
];
// Class features named like a subclass but that are the generic class feature itself
const NOT_SUBCLASSES = ["Sorcerer Bloodline", "Arcane School"];
const PACKS = ["pf1.class-abilities", `${MODULE_ID}.features`];

// Powers PF1 ships as items but doesn't tag or name in their subclass's text
const EXTRA_POWERS = {
  "Solar Bloodline": ["Compendium.pf1.class-abilities.Item.pGfHEBWjXuZvfsOI"], // Solar Ascension
};

const ARCANA = {
  "Solar Bloodline": { descriptor: "fire", perDie: 1 },
};

// PF1 data errors in powers, corrected when the power is added to a character
const POWER_FIXES = {
  // "You can use this ability for a number of rounds per day equal to your wizard level" (PF1 has Int mod)
  Foretell: { wrong: (item) => item.system.uses?.maxFormula === "@abilities.int.mod", update: { "system.uses.maxFormula": "@class.level", "system.uses.per": "day" } },
};
Hooks.on("createItem", (item, options, userId) => {
  const fix = POWER_FIXES[item.name];
  if (userId === game.user.id && item.actor && fix?.wrong(item)) item.update(fix.update);
});

function kindOf(item) {
  if (item.type !== "feat" || NOT_SUBCLASSES.includes(item.name)) return null;
  return KINDS.find((k) => item.name.endsWith(k.suffix)) ?? null;
}

/* -------------------------------------------- */
/*  Finding powers                              */
/* -------------------------------------------- */

function powerLevel(doc) {
  const own = doc.getFlag?.(MODULE_ID, "level") ?? doc.flags?.[MODULE_ID]?.level;
  if (own) return { level: own, guessed: false };
  // Only an opening "At 8th level, ..." is the level gained; later mentions are upgrades
  // (Forewarned: "...At 20th level, anytime you roll initiative...")
  const text = plainText(doc.system.description?.value);
  const m = text.match(/^\W*(?:At|Starting at|Beginning at) (\d+)(?:st|nd|rd|th) level/i) ?? text.match(/^\s*Level\s*:\s*(\d+)/i);
  return m ? { level: Number(m[1]), guessed: false } : { level: 1, guessed: true };
}

export async function findPowers(subclass, kind = kindOf(subclass)) {
  const text = plainText(subclass.system.description.value);
  const found = new Map();
  const add = (doc, how) => {
    if (!doc || found.has(doc.uuid) || doc.uuid === subclass._stats?.compendiumSource || doc.name === subclass.name) return;
    let { level, guessed } = powerLevel(doc);
    if (guessed) {
      // The subclass text may give it: "Woodland Stride (Ex): At 3rd level, ..."
      const name = doc.name.replace(/\s*\([^()]*\)\s*$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = text.match(new RegExp(`${name}\\s*\\((?:Ex|Su|Sp)\\)\\s*:?\\s*(?:At|Starting at|Beginning at) (\\d+)(?:st|nd|rd|th) level`, "i"));
      if (m) [level, guessed] = [Number(m[1]), false];
    }
    found.set(doc.uuid, { uuid: doc.uuid, name: doc.name, level, how, flags: guessed ? ["level guessed"] : [] });
  };

  // 1. Explicit links on the subclass item (some domains have them), and known untagged powers
  for (const link of [...(subclass.system.links?.children ?? []), ...(subclass.system.links?.supplements ?? [])]) {
    add(await fromUuid(link.uuid), "linked");
  }
  for (const uuid of EXTRA_POWERS[subclass.name] ?? []) add(await fromUuid(uuid), "known power");

  // 2. Items tagged with the subclass name ("Draconic Bloodline", "Solar Bloodline"). Skip ones
  // that belong to another class: PF1 tags warpriest blessings "Luck Domain" too.
  const forOtherClass = (entry) => {
    const classes = entry.system?.associations?.classes ?? [];
    return classes.length > 0 && !classes.some((c) => norm(c) === norm(kind.className));
  };
  const indexes = [];
  for (const packId of PACKS) {
    const pack = game.packs.get(packId);
    if (!pack) continue;
    const index = await pack.getIndex({ fields: ["system.tags", "system.associations.classes"] });
    indexes.push({ pack, index });
    for (const entry of index) {
      if ((entry.system?.tags ?? []).includes(subclass.name) && !forOtherClass(entry)) add(await pack.getDocument(entry._id), "tagged");
    }
  }

  // 3. Power names in the subclass text ("Name (Su)"), matched by name among this class's features
  // (a heading can run into the name: "Realization Domain Powers Strength Surge (Su)")
  const names = [...new Set([...text.matchAll(/([A-Z][\w' -]{2,40}?)\s*\((?:Ex|Su|Sp)\)/g)].map((m) => m[1].replace(/^.*\bPowers\s+/, "").trim()))];
  // "Strength Surge" is the item "Strength Surge (Domain Power)"
  const base = (s) => norm(s.replace(/\s*\([^()]*\)\s*$/, ""));
  const textOnly = [];
  for (const name of names) {
    if ([...found.values()].some((p) => base(p.name) === base(name))) continue;
    let hit = null;
    for (const { pack, index } of indexes) {
      const entry = index.find(
        (e) => base(e.name) === base(name) && (e.system?.associations?.classes ?? []).some((c) => norm(c) === norm(kind.className))
      );
      if (entry) { hit = await pack.getDocument(entry._id); break; }
    }
    if (hit) add(hit, "named in text");
    else textOnly.push(name);
  }

  // 4. Subschools keep their associated school's powers, except the ones they replace
  // ("...replace the diviner's fortune and scrying adept powers of the divination school")
  const associated = text.match(/Associated School:\s*([A-Z][\w ]*? School)\b/)?.[1];
  const schoolEntry = associated && indexes[0]?.index.find((e) => e.name === associated);
  if (schoolEntry && associated !== subclass.name) {
    const replaced = norm(text.match(/replace the (.*?) powers?\b/i)?.[1] ?? "");
    const school = await indexes[0].pack.getDocument(schoolEntry._id);
    for (const power of (await findPowers(school, kind)).powers) {
      if (!replaced.includes(norm(power.name))) add(await fromUuid(power.uuid), `from ${associated}`);
    }
  }

  return { powers: [...found.values()].sort((a, b) => a.level - b.level), textOnly };
}

/* -------------------------------------------- */
/*  Review dialog and apply / revert            */
/* -------------------------------------------- */

function findClass(actor, className) {
  return actor.itemTypes.class.find((c) => norm(c.name) === norm(className));
}

function existingFor(actor, power) {
  return actor.items.find((i) => i._stats?.compendiumSource === power.uuid || (i.type === "feat" && norm(i.name) === norm(power.name)));
}

/**
 * @param {boolean} [grantAll] Skip the review dialog and grant every power found (macros, tests).
 */
export async function promptApply(actor, subclass, { grantAll = false } = {}) {
  const kind = kindOf(subclass);
  const classItem = findClass(actor, kind.className);
  if (!classItem) return ui.notifications.warn(`${subclass.name}: ${actor.name} has no ${kind.className} class.`);
  // Tie it to its class like PF1 does for class features, so its formulas' @class.level work
  // (Protection Domain: "+1 resistance bonus on saving throws ... increases by 1 for every 5 levels")
  if (subclass.system.class !== classItem.system.tag) await subclass.update({ "system.class": classItem.system.tag });

  const { powers, textOnly } = await findPowers(subclass, kind);
  // Many of PF1's bloodline entries stop at the bloodline arcana and never name their powers
  if (!powers.length && !textOnly.length) {
    return ui.notifications.warn(`${subclass.name}: PF1's entry doesn't list its powers, so they can't be added automatically. Add them from the Class Abilities compendium by hand.`, { permanent: true });
  }
  for (const p of powers) p.existing = existingFor(actor, p)?.id ?? null;

  const rows = powers
    .map(
      (p, i) => `<tr>
        <td><input type="checkbox" name="power" value="${i}" checked></td>
        <td><input type="number" name="lvl${i}" value="${p.level}" min="1" max="20" style="width:3.5em"></td>
        <td>${esc(p.name)}${openLink(p.uuid)}${p.flags.length ? ` <i class="fa-solid fa-triangle-exclamation" style="color:#c80" data-tooltip="${esc(p.flags.join("; "))}"></i>` : ""}
          ${p.existing ? '<em style="opacity:0.7">(already on sheet)</em>' : ""}
          <div style="font-size:11px; opacity:0.7">${esc(p.how)} · ${esc(p.uuid.startsWith(`Compendium.${MODULE_ID}`) ? "PF1e Revamp" : "PF1")}</div></td>
      </tr>`
    )
    .join("");

  const choices = grantAll ? powers : await foundry.applications.api.DialogV2.wait({
    window: { title: titleFor(`Grant ${subclass.name} powers`, actor), resizable: true },
    position: { width: 480 },
    content: `<p>Links these powers into <strong>${esc(classItem.name)}</strong> (level ${classItem.system.level}) at their levels, and adds the ones already reached.</p>
      <table><thead><tr><th></th><th>Lvl</th><th>Power</th></tr></thead><tbody>${rows || "<tr><td colspan=3>No power items found.</td></tr>"}</tbody></table>
      ${textOnly.length ? `<p style="font-size:11px"><i class="fa-solid fa-triangle-exclamation" style="color:#c80"></i> Named in the text but no item exists yet: ${esc(textOnly.join(", "))}.</p>` : ""}`,
    buttons: [
      {
        action: "apply",
        label: "Grant powers",
        icon: "fa-solid fa-check",
        default: true,
        callback: (event, button) =>
          [...button.form.querySelectorAll('input[name="power"]:checked')].map((el) => ({
            ...powers[el.value],
            level: Number(button.form.elements[`lvl${el.value}`].value) || powers[el.value].level,
          })),
      },
      { action: "cancel", label: "Not now" },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(choices)) return;

  // Link into the class, then add what the character already qualifies for
  const links = foundry.utils.deepClone(classItem.system.links?.classAssociations ?? []);
  for (const p of choices) if (!links.some((l) => l.uuid === p.uuid)) links.push({ uuid: p.uuid, level: p.level });
  await classItem.update({ "system.links.classAssociations": links });

  const level = classItem.system.level ?? 0;
  const created = await createClassFeatures(
    classItem,
    choices.filter((p) => !p.existing && p.level <= level)
  );

  await subclass.setFlag(MODULE_ID, FLAG, {
    classId: classItem.id,
    added: choices.map((p) => ({ uuid: p.uuid, name: p.name, level: p.level })),
    preexisting: choices.map((p) => p.existing).filter(Boolean),
  });
  ui.notifications.info(`${subclass.name}: ${choices.length} power(s) linked, ${created.length} added now.`);

  // A specialist wizard also picks two opposition schools
  if (!grantAll && kind.className === "Wizard" && specialtyOf(subclass) && !subclass.getFlag(MODULE_ID, "opposition")) await promptOpposition(actor, subclass);
}

export async function revert(actor, record, name) {
  const classItem = actor.items.get(record.classId);
  if (!classItem) return;
  const addedUuids = new Set(record.added.map((a) => a.uuid));
  const preexisting = new Set(record.preexisting);
  const toDelete = record.added.flatMap((a) => itemsFromSource(classItem, a.uuid)).filter((i) => !preexisting.has(i.id));
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete.map((i) => i.id));
  await classItem.update({
    "system.links.classAssociations": (classItem.system.links?.classAssociations ?? []).filter((l) => !addedUuids.has(l.uuid)),
    ...classFlagUpdate(toDelete.map((i) => i.id), []),
  });
  ui.notifications.info(`${name}: powers removed from ${classItem.name}.`);
}

Hooks.on("createItem", (item, options, userId) => {
  if (userId !== game.user.id || !item.actor || !kindOf(item) || item.getFlag(MODULE_ID, FLAG)) return;
  if (options[`${MODULE_ID}NoPrompt`]) return; // added by the level-up picker, which prompts in order itself
  promptApply(item.actor, item);
});

/* -------------------------------------------- */
/*  Subclass picker in PF1's add-class dialog   */
/* -------------------------------------------- */

const PICKS = { Sorcerer: 1, Cleric: 2, Wizard: 1 }; // how many to choose (clerics pick two domains)

/** Picks made in an open level-up dialog, applied when the class levels. Keyed by the dialog itself, not
 *  its id: PF1 reuses one id per class, so a closed dialog's delayed cleanup would wipe the next one's picks. */
const pending = new Map();

/** Subclass choices per class, loaded once at startup so the picker renders with the dialog. */
const optionsCache = new Map();

async function loadSubclassOptions() {
  const pack = game.packs.get("pf1.class-abilities");
  const index = pack ? await pack.getIndex({ fields: ["system.associations.classes"] }) : [];
  // Schools and subschools are both wizard options, so the lists for one class are combined
  const byClass = new Map();
  for (const kind of KINDS) {
    const options = index
      .filter((e) => e.name.endsWith(kind.suffix) && !NOT_SUBCLASSES.includes(e.name))
      .filter((e) => kind.className === "Cleric" || (e.system?.associations?.classes ?? []).some((c) => norm(c) === norm(kind.className)))
      .map((e) => ({ uuid: `Compendium.pf1.class-abilities.Item.${e._id}`, name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    byClass.set(kind.className, [...(byClass.get(kind.className) ?? []), ...options]);
  }
  for (const [className, options] of byClass) optionsCache.set(className, options);
}

Hooks.once("ready", loadSubclassOptions);

// Bloodlines, domains and schools granted before 0.19 weren't tied to their class: fix them once (GM)
Hooks.once("ready", async () => {
  if (!isActiveGM()) return;
  for (const actor of game.actors) {
    const updates = [];
    for (const item of actor.itemTypes.feat) {
      const kind = kindOf(item);
      const tag = kind && findClass(actor, kind.className)?.system.tag;
      if (tag && item.system.class !== tag) updates.push({ _id: item.id, "system.class": tag });
    }
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  }
});

/** A picker section styled to sit above the level-up dialog's buttons. */
function pickerSection(title, hint) {
  const section = document.createElement("section");
  section.className = `${MODULE_ID}-levelup-picker`;
  section.style.cssText = "margin: 0.5em 0; padding: 0.25em 0.5em; border: 1px dashed var(--color-border-light-2, #999);";
  section.innerHTML = `<h3 style="margin:0 0 0.25em 0">${esc(title)} <span style="font-size:11px; opacity:0.7">(PF1e Revamp)</span></h3>
    <p style="font-size:11px; margin:0 0 0.25em 0; opacity:0.8">${esc(hint)}</p>`;
  return section;
}

/** A dropdown of compendium entries (values are uuids), with a book icon that opens the selected one. */
function pickerSelect(placeholder, options, selected, onChange) {
  const row = document.createElement("div");
  row.style.cssText = "display: flex; align-items: center; gap: 0.4em; margin-bottom: 0.25em;";
  row.innerHTML = `<select style="flex: 1">
      <option value="">— ${esc(placeholder)} —</option>${options
        .map((o) => `<option value="${esc(o.value)}" ${o.value === selected ? "selected" : ""} ${o.title ? `title="${esc(o.title)}"` : ""}>${esc(o.label)}</option>`)
        .join("")}
    </select>${openLink("pending")}`;
  // No name attribute: this isn't part of PF1's form data
  const select = addSearch(row.querySelector("select"));
  const link = row.querySelector(`.${MODULE_ID}-open`);
  const sync = () => {
    link.dataset.uuid = select.value;
    link.style.visibility = select.value ? "visible" : "hidden";
  };
  select.addEventListener("change", () => (sync(), onChange(select.value)));
  sync();
  return row;
}

function pendingState(app) {
  let state = pending.get(app);
  if (!state) pending.set(app, (state = { actorUuid: app.actor.uuid, className: app.item.name, picks: [], feat: "", at: Date.now() }));
  return state;
}

// A cancelled level-up never fires pf1ClassLevelChange; drop its picks once the dialog is closed
// (after a short delay, so a Finish that closes the dialog is still applied).
Hooks.on("closeLevelUpForm", (app) => setTimeout(() => pending.delete(app), 10000));

/** New class: choose a bloodline / domains / arcane school. */
async function subclassPicker(app) {
  const kind = KINDS.find((k) => norm(k.className) === norm(app.item.name));
  if (!kind || app.actor.items.some((i) => kindOf(i) === kind)) return null;
  if (!optionsCache.has(kind.className)) {
    await loadSubclassOptions(); // only if startup loading hasn't finished yet
    app.render(); // redraw so the picker is part of the initial layout
    return null;
  }

  const count = PICKS[kind.className];
  const state = pendingState(app);
  const label = kind.label.replace(/\b\w/g, (c) => c.toUpperCase());
  const section = pickerSection(count > 1 ? `${label}s` : label, `Optional. After Finish, the ${kind.label} is added and you'll review its powers.`);
  const options = optionsCache.get(kind.className).map((o) => ({ value: o.uuid, label: o.name }));
  for (let i = 0; i < count; i++) {
    const placeholder = count > 1 ? `choose ${kind.label} ${i + 1}` : `choose ${/^[aeiou]/i.test(kind.label) ? "an" : "a"} ${kind.label}`;
    section.append(pickerSelect(placeholder, options, state.picks[i], (v) => (state.picks[i] = v)));
  }
  // Variant channeling (optional rule): "When you create a cleric character, decide whether she uses the
  // standard form of channel energy or a variant ... Once this choice is made, it cannot be altered."
  if (kind.className === "Cleric" && variantsAllowed()) {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; margin-top: 0.25em;";
    row.innerHTML = `<select style="flex: 1">${variantOptions().map((o) => `<option value="${esc(o.value)}" ${o.value === (state.variant ?? "") ? "selected" : ""}>${o.value ? `Variant channeling: ${esc(o.label)}` : esc(o.label)}</option>`).join("")}</select>`;
    const select = addSearch(row.querySelector("select"));
    const hint = document.createElement("p");
    hint.style.cssText = "font-size: 11px; margin: 0.15em 0 0; opacity: 0.8;";
    const show = () => (hint.textContent = VARIANTS[select.value] ? `Pick one of your deity's portfolios; it can't be changed later. Heal: ${VARIANTS[select.value].heal}` : "");
    select.addEventListener("change", () => ((state.variant = select.value || null), show()));
    show();
    section.append(row, hint);
  }
  return section;
}

/* Bloodline bonus feats: "At 7th level, and every six levels thereafter, a sorcerer receives one
   bonus feat, chosen from a list specific to each bloodline." */
const BLOODLINE_FEAT_LEVELS = [7, 13, 19];
const featCache = new Map(); // bloodline item id → feat documents

async function bloodlineFeats(bloodline) {
  if (featCache.has(bloodline.id)) return featCache.get(bloodline.id);
  const html = bloodline.system.description.value ?? "";
  const start = html.search(/Bonus Feats/i);
  const segment = start >= 0 ? html.slice(start).split(/Bloodline Arcana|Bloodline Powers/i)[0] : "";
  const docs = [];
  for (const m of segment.matchAll(/@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g)) {
    const doc = await fromUuid(m[1]);
    if (doc && !docs.some((d) => d.uuid === doc.uuid)) docs.push(doc);
  }
  featCache.set(bloodline.id, docs);
  return docs;
}

async function bloodlineFeatPicker(app) {
  if (norm(app.item.name) !== "sorcerer") return null;
  const newLevel = app.config?.level?.new ?? (app.item.system.level ?? 0) + 1;
  if (!BLOODLINE_FEAT_LEVELS.includes(newLevel)) return null;
  const bloodline = app.actor.items.find((i) => kindOf(i)?.className === "Sorcerer");
  if (!bloodline) return null;
  if (!featCache.has(bloodline.id)) {
    await bloodlineFeats(bloodline);
    app.render();
    return null;
  }

  const state = pendingState(app);
  state.featLevel = newLevel;
  const owned = new Set(app.actor.itemTypes.feat.map((f) => norm(f.name)));
  const marks = { met: "✓", unmet: "✗", unknown: "?" };
  const options = featCache.get(bloodline.id).map((feat) => {
    const check = checkPrerequisites(feat, app.actor);
    const have = owned.has(norm(feat.name));
    return { value: feat.uuid, label: `${have ? "(have) " : ""}${marks[check.status]} ${feat.name}`, title: check.summary };
  });

  const section = pickerSection(
    `${bloodline.name}: bonus feat`,
    `Level ${newLevel} bloodline feat. ✓ prerequisites met · ✗ not met · ? check manually (hover for details). Prerequisites are checked against your current stats.`
  );
  section.append(pickerSelect("choose a bloodline feat", options, state.feat, (v) => (state.feat = v)));
  return section;
}

Hooks.on("renderLevelUpForm", async (app, html) => {
  const root = html[0] ?? html;
  const footer = root.querySelector("footer.buttons");
  if (!footer || root.querySelector(`.${MODULE_ID}-levelup-picker`)) return;
  const section = app.isNewClass ? await subclassPicker(app) : await bloodlineFeatPicker(app);
  if (!section || root.querySelector(`.${MODULE_ID}-levelup-picker`)) return;
  footer.before(section);
  app.setPosition({ height: "auto" }); // fit the window to the added section
});

// After Finish, PF1 creates or levels the class; then add what was picked.
Hooks.on("pf1ClassLevelChange", (actor, classItem, curLevel, newLevel) => {
  if (newLevel <= curLevel) return;
  for (const [app, state] of pending) {
    if (state.actorUuid !== actor.uuid || norm(state.className) !== norm(classItem.name)) continue;
    pending.delete(app);
    if (Date.now() - state.at > 30 * 60 * 1000) return;
    (async () => {
      // New class: the subclass(es), reviewed one at a time so their class edits can't collide
      if (curLevel === 0) {
        for (const uuid of [...new Set(state.picks.filter(Boolean))]) {
          const doc = await fromUuid(uuid);
          if (!doc) continue;
          const data = game.items.fromCompendium(doc, { clearFolder: true });
          const [subclass] = await actor.createEmbeddedDocuments("Item", [data], { [`${MODULE_ID}NoPrompt`]: true });
          await promptApply(actor, subclass);
        }
        // Variant channeling, on the Channel Energy feature PF1 adds with the class
        if (state.variant) {
          let channelItem;
          for (let i = 0; i < 20 && !(channelItem = actor.itemTypes.feat.find((f) => f.system.tag === "classFeat_channelEnergy")); i++) await new Promise((r) => setTimeout(r, 250));
          if (channelItem) await setVariant(channelItem, state.variant);
        }
      }
      // Bloodline bonus feat
      if (state.feat && state.featLevel === newLevel) {
        const doc = await fromUuid(state.feat);
        if (doc) {
          await actor.createEmbeddedDocuments("Item", [game.items.fromCompendium(doc, { clearFolder: true })]);
          ui.notifications.info(`${actor.name} gains ${doc.name} (bloodline bonus feat).`);
        }
      }
    })();
    return;
  }
});

Hooks.on("deleteItem", (item, options, userId) => {
  if (userId !== game.user.id || !item.actor) return;
  const record = item.getFlag(MODULE_ID, FLAG);
  if (record) revert(item.actor, record, item.name);
});

Hooks.on("updateItem", (item, changes) => {
  if (kindOf(item) && foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)) refreshFootnotes(item);
});

registerFootnote((item) => {
  const kind = kindOf(item);
  if (!kind || !item.actor) return null;
  const record = item.getFlag(MODULE_ID, FLAG);
  if (!record) {
    const content = [`This ${kind.label}'s powers aren't linked to the ${kind.className} class yet.`];
    if (item.isOwner) content.push(footnoteButton("Grant powers…", "Review and link this subclass's powers", () => promptApply(item.actor, item)));
    return content;
  }
  const content = [`Powers linked into ${kind.className}: ${record.added.map((a) => `${a.name} (${a.level})`).join(", ")}. Deleting this item removes them.`];
  if (item.isOwner) {
    content.push(
      footnoteButton("Remove powers", "Unlink and remove this subclass's powers", async () => {
        await revert(item.actor, record, item.name);
        await item.unsetFlag(MODULE_ID, FLAG);
      })
    );
  }
  return content;
});

/* -------------------------------------------- */
/*  Trait grants (resistances, immunities)      */
/* -------------------------------------------- */

const TRAIT_LABELS = { eres: "resistance", di: "immunity", ci: "immunity" };

/**
 * Grants active at the item's class level. This runs on every actor preparation, so it reads the
 * class level directly and evaluates amounts against a tiny roll data object, never the item's
 * full roll data.
 */
// Grant amounts depend only on formula and class level; a handful of entries at most.
const amountCache = new Map();

function activeGrants(item) {
  const flags = item.flags[MODULE_ID];
  const grants = flags?.grants;
  if (!grants?.length || !item.isActive) return [];
  const fallbackTag = (flags.levelFormula ?? "").match(/@classes\.(\w+)\.level/)?.[1] ?? "sorcerer";
  const level = classLevel(item, fallbackTag);
  const amount = (formula) => {
    const key = `${formula}|${level}`;
    if (!amountCache.has(key)) amountCache.set(key, evaluate(formula, item, { class: { level }, classes: { [fallbackTag]: { level } } }));
    return amountCache.get(key);
  };
  return grants
    .filter((g) => level >= (g.minLevel ?? 0) && level <= (g.maxLevel ?? Infinity))
    .map((g) => ({ ...g, amount: g.amount ? amount(g.amount) : null }));
}

function addTrait(trait, type) {
  if (trait?.standard instanceof Set) trait.standard.add(type);
  else if (Array.isArray(trait?.value) && !trait.value.includes(type)) trait.value.push(type);
}

// Runs on every actor preparation: only feats carry grants, and the flag is read directly
// (getFlag validates its scope on every call).
Hooks.on("pf1PrepareDerivedActorData", (actor) => {
  const traits = actor.system.traits;
  if (!traits) return;
  for (const item of actor.itemTypes?.feat ?? []) {
    if (!item.flags[MODULE_ID]?.grants) continue;
    for (const grant of activeGrants(item)) {
      if (grant.trait === "eres") {
        traits.eres ??= { value: [], custom: "" };
        traits.eres.value ??= [];
        const existing = traits.eres.value.find((e) => e.types?.includes(grant.type));
        if (existing) existing.amount = Math.max(existing.amount ?? 0, grant.amount);
        else traits.eres.value.push({ amount: grant.amount, operator: true, types: [grant.type, ""] });
      } else {
        addTrait(traits[grant.trait], grant.type);
      }
    }
  }
  // Energy resistances don't stack: of several against the same single energy type (a granted one
  // and one typed in by hand, say), only the highest is kept, so PF1's Apply Damage dialog can't
  // apply both.
  const eres = traits.eres?.value;
  if (eres?.length > 1) {
    const best = new Map();
    const multi = [];
    for (const entry of eres) {
      const types = (entry.types ?? []).filter(Boolean);
      if (types.length !== 1) multi.push(entry);
      else if (!best.has(types[0]) || (entry.amount ?? 0) > (best.get(types[0]).amount ?? 0)) best.set(types[0], entry);
    }
    if (best.size + multi.length < eres.length) traits.eres.value = [...best.values(), ...multi];
  }
});

registerFootnote((item) => {
  const grants = item.getFlag(MODULE_ID, "grants");
  if (!grants?.length) return null;
  if (!item.actor) return [`Grants are applied automatically as the character levels: ${grants.map((g) => `${g.type} ${TRAIT_LABELS[g.trait]}`).join(", ")}.`];
  const active = activeGrants(item);
  return [
    `Applied automatically: ${active.map((g) => `${g.type} ${TRAIT_LABELS[g.trait]}${g.amount ? ` ${g.amount}` : ""}`).join(", ") || "nothing at this level"}.`,
  ];
});

/* -------------------------------------------- */
/*  Bloodline arcana                            */
/* -------------------------------------------- */

function arcanaFor(actor) {
  for (const [name, arcana] of Object.entries(ARCANA)) {
    if (actor?.items.some((i) => i.type === "feat" && i.name === name)) return { name, ...arcana };
  }
  return null;
}

function hasDescriptor(item, descriptor) {
  const d = item.system.descriptors;
  const values = d?.total ?? d?.value ?? d ?? [];
  return [...values].includes(descriptor);
}

Hooks.on("pf1PreDamageRoll", (action, rollData, parts) => {
  const item = action.item;
  if (item?.type !== "spell" || !parts.length) return;
  const arcana = arcanaFor(item.actor);
  if (!arcana || !hasDescriptor(item, arcana.descriptor)) return;

  const { RollPF } = pf1.dice;
  let dice = 0;
  for (const part of parts) {
    const roll = RollPF.safeRollSync(part.base, rollData, undefined, { suppressError: true }, { minimize: true });
    dice += roll.dice.reduce((n, d) => n + (d.number ?? 0), 0);
  }
  if (dice > 0) parts[0].extra.push(`${dice * arcana.perDie}[Bloodline Arcana]`);
});

registerFootnote((item) => {
  const arcana = ARCANA[item.name];
  if (!arcana || item.type !== "feat") return null;
  return [`Bloodline Arcana is automated: spells with the ${arcana.descriptor} descriptor get +${arcana.perDie} damage per die rolled.`];
});
