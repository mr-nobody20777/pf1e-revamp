// Archetypes: applies archetypes from the "Pathfinder 1e Archetypes and Abilities" module
// (pf1e-archetypes) to a character's class. That module ships archetypes as text-only items; this
// reads each archetype's "This ability replaces/alters X" clauses, proposes a plan in a review
// dialog, and on confirm edits the character's own copy of the class:
//   - system.links.classAssociations: replaced base features out, archetype features in (with level),
//     so PF1's own level-up handling grants the right features from then on
//   - armor/weapon proficiencies, when the archetype changes them
// It also swaps features the character already has at its current level, skipping anything that's
// already on the sheet (characters set up by hand). The archetype item on the sheet is the record:
// its flag holds what was changed, its footnote offers Apply/Remove, and deleting it reverts.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { itemsFromSource, classFlagUpdate, esc, plainText, spellbookKey, openLink } from "./util.mjs";
import { ARCHETYPE_RULES } from "./archetype-rules.mjs";

const ARCH_PACK = "pf1e-archetypes.pf-archetypes";
const FEAT_PACK = "pf1e-archetypes.pf-arch-features";
const FLAG = "archetype";

/* -------------------------------------------- */
/*  Text parsing                                */
/* -------------------------------------------- */

/** "Lookout (Vanguard)" → "Lookout" */
function stem(name) {
  return name.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

/** Normalized feature name for fuzzy matching. */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/'s\b/g, "")
    .replace(/\b\d+(st|nd|rd|th)\b-?/g, " ")
    .replace(/\b(the|a|an|his|her|their|class features?|abilit(y|ies)|feature|normal|usual|standard|gained|at|levels?)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(\w{3,})s\b/g, "$1") // crude singular
    .replace(/\s+/g, " ")
    .trim();
}

const CLAUSE = /\b(?:this|these|which|and)\s+(?:[\w'-]+\s+){0,4}?(replaces?|alters?|modif(?:ies|y))\s+([^.]*)\./gi;
const GAIN_LEVEL = /\b(?:at|starting at|beginning at|upon reaching)\s+(\d+)(?:st|nd|rd|th)[ -]level/i;

function clausesIn(text) {
  return [...text.matchAll(CLAUSE)].map((m) => ({
    verb: m[1].toLowerCase().startsWith("replace") ? "replaces" : "alters",
    rest: m[2],
    sentence: m[0].trim(),
  }));
}

/** "arcane bond and the bonus feats gained at 10th, 15th, and 20th levels" → targets, keeping level lists together. */
function splitTargets(rest) {
  const parts = rest.split(/,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const levelOnly = /^(?:the\s+)?\d+(?:st|nd|rd|th)(?:[- ]?levels?)?$/i.test(part);
    if (levelOnly && out.length) out[out.length - 1] += `, ${part}`;
    else if (out.length && /-$/.test(out[out.length - 1])) out[out.length - 1] += ` ${part}`;
    else out.push(part);
  }
  return out.map((text) => ({
    text,
    levels: [...text.matchAll(/(\d+)(?:st|nd|rd|th)/g)].map((m) => Number(m[1])),
    proficiency: /proficienc/i.test(text),
  }));
}

function matchBase(target, baseFeatures) {
  const t = normalize(target);
  if (!t) return null;
  let best = null;
  for (const base of baseFeatures) {
    const b = base.norm;
    if (!b) continue;
    if (t === b) return base;
    if ((t.includes(b) || b.includes(t)) && Math.min(t.length, b.length) >= 4) {
      if (!best || b.length > best.norm.length) best = base;
    }
  }
  return best;
}

/* -------------------------------------------- */
/*  Plan building                               */
/* -------------------------------------------- */

function findClass(actor, className) {
  const key = (s) => normalize(s).split(" ").sort().join(" ");
  return actor.itemTypes.class.find((c) => key(c.name) === key(className));
}

async function archetypeSource(item) {
  const src = item._stats?.compendiumSource;
  if (src?.startsWith(`Compendium.${ARCH_PACK}.`)) return fromUuid(src);
  const pack = game.packs.get(ARCH_PACK);
  const entry = pack?.index.find((e) => e.name === item.name);
  return entry ? pack.getDocument(entry._id) : null;
}

/** Is this item an archetype from pf1e-archetypes? */
function isArchetype(item) {
  if (item.type !== "feat") return false;
  if (item._stats?.compendiumSource?.startsWith(`Compendium.${ARCH_PACK}.`)) return true;
  return !!game.packs.get(ARCH_PACK)?.index.find((e) => e.name === item.name);
}

export async function buildPlan(actor, archetype) {
  const className = archetype.name.replace(/\s*\([^()]*\)\s*$/, "");
  const archName = (archetype.name.match(/\(([^()]+)\)\s*$/) ?? [])[1];
  const classItem = findClass(actor, className);
  if (!classItem) throw new Error(`${actor.name} has no ${className} class.`);

  // Base class features from the character's class links
  const links = classItem.system.links?.classAssociations ?? [];
  const baseFeatures = [];
  for (const link of links) {
    const doc = await fromUuid(link.uuid);
    if (!doc) continue;
    const name = doc.name.replace(/\s*\([A-Z]{2,4}\)$/, "");
    baseFeatures.push({ uuid: link.uuid, name: doc.name, level: link.level, tag: doc.system.tag, norm: normalize(name) });
  }

  // Archetype features: "<Feature> (<Archetype>)" items tagged with this class
  const pack = game.packs.get(FEAT_PACK);
  const index = await pack.getIndex({ fields: ["system.associations.classes"] });
  const classKey = normalize(className);
  const entries = index.filter(
    (e) => e.name.endsWith(`(${archName})`) && (e.system?.associations?.classes ?? []).some((c) => normalize(c) === classKey)
  );
  let features = await Promise.all(entries.map((e) => pack.getDocument(e._id)));
  const archText = plainText(archetype.system.description.value);

  // Some archetypes have no feature items; fall back to the "Name (Ex):" headings in the archetype
  // text. These can still remove/alter base features but have nothing to add.
  if (!features.length) {
    features = [...archText.matchAll(/([A-Z][\w'’ -]{2,40}?)\s*\((?:Ex|Su|Sp)\)\s*:/g)].map((m) => ({
      uuid: null,
      name: `${m[1].trim()} (${archName})`,
      system: { description: { value: "" } },
    }));
  }

  // Split the archetype text into one section per feature, in reading order. A feature's section
  // starts at its heading ("Name (Ex):" / "Name:"), not wherever its name is first mentioned.
  const headingPos = (name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const heading = new RegExp(`${escaped}\\s*(?:\\((?:Ex|Su|Sp)\\))?\\s*:`, "i").exec(archText);
    return heading ? heading.index : archText.toLowerCase().indexOf(name.toLowerCase());
  };
  const positioned = features
    .map((f) => ({ f, pos: headingPos(stem(f.name)) }))
    .sort((a, b) => (a.pos < 0) - (b.pos < 0) || a.pos - b.pos);
  const section = (i) => {
    const { pos } = positioned[i];
    if (pos < 0) return "";
    const next = positioned.slice(i + 1).find((p) => p.pos > pos)?.pos ?? archText.length;
    return archText.slice(pos, next);
  };

  const plan = { actor, classItem, archetype, archName, baseFeatures, adds: [], removes: new Map(), alters: [], notes: [], proficiencyText: [] };
  const alter = (base, f, merge = false) => {
    if (!plan.alters.some((a) => a.baseUuid === base.uuid && a.by === f.name)) plan.alters.push({ baseUuid: base.uuid, tag: base.tag, by: f.name, byUuid: f.uuid, merge });
  };

  positioned.forEach(({ f }, i) => {
    const own = plainText(f.system.description.value);
    const sec = section(i);
    const seen = new Set();
    const clauses = [...clausesIn(own), ...clausesIn(sec)].filter((c) => !seen.has(c.sentence) && seen.add(c.sentence));

    const replaces = [], alters = [], flags = [];
    for (const clause of clauses) {
      for (const target of splitTargets(clause.rest)) {
        if (target.proficiency) {
          plan.proficiencyText.push(`${stem(f.name)}: ${clause.sentence}`);
          continue;
        }
        const base = matchBase(target.text, baseFeatures);
        if (!base) {
          flags.push(`couldn't match "${target.text}"`);
          plan.notes.push({ baseUuid: null, text: `${f.name}: ${clause.sentence}` });
          continue;
        }
        if (clause.verb === "replaces" && !target.levels.length) {
          replaces.push(base.name);
          plan.removes.set(base.uuid, { ...base, by: f.name });
        } else {
          (clause.verb === "replaces" ? replaces : alters).push(target.levels.length ? `${base.name} (${target.text})` : base.name);
          const what = target.levels.length ? `${target.text} replaced` : "altered";
          plan.notes.push({ baseUuid: base.uuid, text: `${what} by ${f.name}.` });
          alter(base, f);
        }
      }
    }
    if (!clauses.length) flags.push("no replaces/alters clause found");

    // pf1e-archetypes items start with a "Level : N" header; otherwise read "At Nth level" from the text
    const m = own.match(/^\s*Level\s*:\s*(\d+)/i) ?? own.match(GAIN_LEVEL) ?? sec.match(GAIN_LEVEL);
    let level = m ? Number(m[1]) : null;
    if (!level) {
      const replacedLevels = [...plan.removes.values()].filter((r) => r.by === f.name).map((r) => r.level);
      level = replacedLevels.length ? Math.min(...replacedLevels) : 1;
      flags.push("level guessed");
    }

    // Already on the sheet (set up by hand): same source, same full name, or same short name on an
    // item that isn't a PF1 base feature (base Skald "Raging Song" isn't Battle Scion's).
    if (!f.uuid) flags.push("text only: no item in the Archetype Features compendium, nothing to add");
    const existing = actor.items.find(
      (i) =>
        (f.uuid && i._stats?.compendiumSource === f.uuid) ||
        (i.type === "feat" &&
          (normalize(i.name) === normalize(f.name) ||
            (normalize(stem(i.name)) === normalize(stem(f.name)) && !i._stats?.compendiumSource?.startsWith("Compendium.pf1."))))
    );
    // A restatement of a base feature it keeps (Battle Scion's "Raging Song (Battle Scion)" is Raging
    // Song plus a new song): merge into the base feature instead of adding a second copy.
    const same = baseFeatures.find((b) => b.norm === normalize(stem(f.name)) && !plan.removes.has(b.uuid));
    if (same && f.uuid) {
      alter(same, f, true);
      flags.push(`merged into ${same.name}`);
    }
    plan.adds.push({ uuid: f.uuid, name: f.name, level, replaces, alters, flags, existing: existing?.id ?? null, merge: !!(same && f.uuid) });
  });

  plan.adds.sort((a, b) => a.level - b.level);
  return plan;
}

/* -------------------------------------------- */
/*  Review dialog                               */
/* -------------------------------------------- */

function checkboxGroup(name, labels, selected) {
  return Object.entries(labels)
    .map(([key, label]) => `<label style="white-space:nowrap; margin-right:0.75em;"><input type="checkbox" name="${name}" value="${esc(key)}" ${selected.includes(key) ? "checked" : ""}> ${esc(game.i18n.localize(label))}</label>`)
    .join(" ");
}

function dialogContent(plan) {
  const { classItem, adds, removes, baseFeatures, notes, proficiencyText } = plan;
  const warn = (flags) => (flags.length ? ` <i class="fa-solid fa-triangle-exclamation" style="color:#c80" data-tooltip="${esc(flags.join("; "))}"></i>` : "");

  const addRows = adds
    .map(
      (a, i) => `<tr>
        <td><input type="checkbox" name="add" value="${i}" ${a.uuid && !a.merge ? "checked" : "disabled"}></td>
        <td><input type="number" name="lvl${i}" value="${a.level}" min="1" max="20" style="width:3.5em"></td>
        <td>${esc(a.name)}${openLink(a.uuid)}${warn(a.flags)}${a.existing ? ' <em style="opacity:0.7">(already on sheet)</em>' : ""}
          <div style="font-size:11px; opacity:0.8">${a.replaces.length ? `replaces ${esc(a.replaces.join(", "))}` : ""}${a.replaces.length && a.alters.length ? "; " : ""}${a.alters.length ? `alters ${esc(a.alters.join(", "))}` : ""}</div></td>
      </tr>`
    )
    .join("");

  const removeRows = baseFeatures
    .map(
      (b) => `<label style="display:block"><input type="checkbox" name="remove" value="${esc(b.uuid)}" ${removes.has(b.uuid) ? "checked" : ""}>
        ${esc(b.name)}${openLink(b.uuid)} <span style="opacity:0.7">(lvl ${b.level})</span>${removes.has(b.uuid) ? ` <em style="font-size:11px; opacity:0.8">→ ${esc(removes.get(b.uuid).by)}</em>` : ""}</label>`
    )
    .join("");

  const preset = defaultChoices(plan);
  const profSection = proficiencyText.length
    ? `<h3>Proficiencies</h3>
       <p style="font-size:11px">${proficiencyText.map(esc).join("<br>")}</p>
       <p><strong>Armor:</strong> ${checkboxGroup("armorProf", pf1.config.armorProficiencies, preset.armorProf)}</p>
       <p><strong>Weapons:</strong> ${checkboxGroup("weaponProf", pf1.config.weaponProficiencies, preset.weaponProf)}</p>`
    : "";

  const noteList = notes.length
    ? `<h3>Notes (added as footnotes)</h3><ul style="font-size:11px">${notes.map((n) => `<li>${n.baseUuid ? `<strong>${esc(baseFeatures.find((b) => b.uuid === n.baseUuid)?.name)}:</strong> ` : ""}${esc(n.text)}</li>`).join("")}</ul>`
    : "";

  return `<div style="max-height:70vh; overflow-y:auto">
    <p>Applying to <strong>${esc(classItem.name)}</strong> (level ${classItem.system.level}). Rows marked <i class="fa-solid fa-triangle-exclamation" style="color:#c80"></i> need a look.</p>
    <h3>Archetype features to add</h3>
    <table><thead><tr><th></th><th>Lvl</th><th>Feature</th></tr></thead><tbody>${addRows || "<tr><td colspan=3>None found in the Archetype Features compendium.</td></tr>"}</tbody></table>
    <h3>Base class features to remove</h3>
    <p style="font-size:11px; opacity:0.8">Checked = removed from the class. "Alters" keeps the base feature.</p>
    ${removeRows}
    ${profSection}
    ${noteList}
  </div>`;
}

/** The dialog's preselected choices. */
function defaultChoices(plan) {
  const preset = (key) => plan.adds.map((a) => ARCHETYPE_RULES[a.name]?.[key]).find(Array.isArray) ?? plan.classItem._source.system[key] ?? [];
  return {
    adds: plan.adds.filter((a) => a.uuid && !a.merge),
    removes: [...plan.removes.keys()],
    armorProf: plan.proficiencyText.length ? preset("armorProf") : null,
    weaponProf: plan.proficiencyText.length ? preset("weaponProf") : null,
  };
}

/**
 * @param {boolean} [acceptDefaults] Skip the review dialog and apply its preselected choices (tests, macros).
 */
export async function promptApply(actor, archetypeItem, { acceptDefaults = false } = {}) {
  const source = await archetypeSource(archetypeItem);
  if (!source) return ui.notifications.warn(`${archetypeItem.name}: not found in the Archetypes compendium.`);

  let plan;
  try {
    plan = await buildPlan(actor, source);
  } catch (err) {
    return ui.notifications.warn(`${archetypeItem.name}: ${err.message}`);
  }

  const choices = acceptDefaults ? defaultChoices(plan) : await foundry.applications.api.DialogV2.wait({
    window: { title: `Apply ${archetypeItem.name}`, resizable: true },
    position: { width: 560 },
    content: dialogContent(plan),
    buttons: [
      {
        action: "apply",
        label: "Apply archetype",
        icon: "fa-solid fa-check",
        default: true,
        callback: (event, button) => {
          const form = button.form;
          const values = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => el.value);
          return {
            adds: values("add").map((i) => ({ ...plan.adds[i], level: Number(form.elements[`lvl${i}`].value) || plan.adds[i].level })),
            removes: values("remove"),
            armorProf: plan.proficiencyText.length ? values("armorProf") : null,
            weaponProf: plan.proficiencyText.length ? values("weaponProf") : null,
          };
        },
      },
      { action: "cancel", label: "Not now", icon: "fa-solid fa-xmark" },
    ],
    rejectClose: false,
  });
  if (!choices || choices === "cancel") return;

  await applyArchetype(plan, choices, archetypeItem);
}

/* -------------------------------------------- */
/*  Apply / revert                              */
/* -------------------------------------------- */

/** Archetype feature data with the mechanics from ARCHETYPE_RULES added. */
function withRules(data, name) {
  const rule = ARCHETYPE_RULES[name];
  if (!rule) return data;
  const sys = data.system;
  if (rule.changes) sys.changes = [...(sys.changes ?? []), ...rule.changes.map(([target, type, formula]) => ({ _id: foundry.utils.randomID(8), target, type, formula }))];
  if (rule.notes) sys.contextNotes = [...(sys.contextNotes ?? []), ...rule.notes.map(([target, text]) => ({ target, text }))];
  if (rule.uses) sys.uses = { ...(sys.uses ?? {}), ...rule.uses };
  return data;
}

/** Remember an item's state before the archetype changes it (once), for reverting. */
function snapshot(item, record) {
  if (record.altered.some((s) => s.id === item.id)) return;
  const { name, system } = item._source;
  record.altered.push({ id: item.id, name, system: foundry.utils.deepClone({ changes: system.changes ?? [], contextNotes: system.contextNotes ?? [], uses: system.uses ?? {}, description: system.description ?? {} }) });
}

/** Give an archetype feature already on the sheet its mechanics. */
async function giveRules(item, name) {
  if (!ARCHETYPE_RULES[name]) return;
  const { system } = withRules({ system: foundry.utils.deepClone(item._source.system) }, name);
  await item.update({ "system.changes": system.changes, "system.contextNotes": system.contextNotes, "system.uses": system.uses });
}

/**
 * Change a base feature the archetype alters: rename it "Feature (Archetype)", apply the mechanics
 * from ARCHETYPE_RULES, and add a line to its description linking what altered it. The item's
 * previous state goes into record.altered so reverting restores it.
 */
async function alterItem(item, alteration, archName, record) {
  snapshot(item, record);
  const rule = ARCHETYPE_RULES[alteration.by]?.alters?.[item.system.tag] ?? {};
  // Keep the tag: PF1 regenerates it from a new name, and formulas and features look items up by it
  const update = { name: `${stem(item.name)} (${archName})`, "system.tag": item.system.tag };
  if (rule.changeTargets) update["system.changes"] = (item._source.system.changes ?? []).filter((c) => rule.changeTargets.includes(c.target));
  if (rule.uses) update["system.uses.maxFormula"] = rule.uses;
  const link = alteration.byUuid ? `@UUID[${alteration.byUuid}]{${alteration.by}}` : esc(alteration.by);
  const line = alteration.merge
    ? `<p><strong>${esc(archName)}:</strong> see ${link} for what the archetype adds.</p>`
    : `<p><strong>Altered by ${link}.</strong> ${esc(rule.summary ?? "")}</p>`;
  update["system.description.value"] = `${item._source.system.description?.value ?? ""}<hr>${line}`;
  await item.update(update);
}


async function applyArchetype(plan, choices, archetypeItem) {
  const { actor, classItem } = plan;
  const level = classItem.system.level ?? 0;
  const removeSet = new Set(choices.removes);
  const oldLinks = foundry.utils.deepClone(classItem.system.links?.classAssociations ?? []);

  const record = {
    classId: classItem.id,
    links: oldLinks,
    armorProf: [...(classItem._source.system.armorProf ?? [])],
    weaponProf: [...(classItem._source.system.weaponProf ?? [])],
    added: choices.adds.map((a) => ({ uuid: a.uuid, name: a.name, level: a.level })),
    removed: [...removeSet],
    preexisting: choices.adds.map((a) => a.existing).filter(Boolean),
    removedItems: [],
    notes: plan.notes.filter((n) => n.baseUuid),
    archName: plan.archName,
    alters: plan.alters,
    altered: [],
    spellbook: null,
    appliedAt: Date.now(),
  };
  choices.adds = choices.adds.filter((a) => !a.merge);

  // 1. Class links and proficiencies
  const links = oldLinks.filter((l) => !removeSet.has(l.uuid));
  for (const add of choices.adds) if (!links.some((l) => l.uuid === add.uuid)) links.push({ uuid: add.uuid, level: add.level });
  const classUpdate = { "system.links.classAssociations": links };
  if (choices.armorProf) classUpdate["system.armorProf"] = choices.armorProf.concat((classItem._source.system.armorProf ?? []).filter((p) => !(p in pf1.config.armorProficiencies)));
  if (choices.weaponProf) classUpdate["system.weaponProf"] = choices.weaponProf.concat((classItem._source.system.weaponProf ?? []).filter((p) => !(p in pf1.config.weaponProficiencies)));
  await classItem.update(classUpdate);

  // 2. Remove replaced features the character already has
  const toDelete = [...removeSet].flatMap((uuid) => itemsFromSource(classItem, uuid));
  record.removedItems = toDelete.map((i) => i.toObject());
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete.map((i) => i.id));

  // 3. Add archetype features up to the current level, skipping ones already on the sheet
  const toCreate = [];
  for (const add of choices.adds) {
    if (add.existing || add.level > level) continue;
    const doc = await fromUuid(add.uuid);
    if (!doc) continue;
    const data = withRules(game.items.fromCompendium(doc, { clearFolder: true }), add.name);
    data.system.class = classItem.system.tag;
    toCreate.push({ data, level: add.level });
  }
  // Track them like PF1 does ({itemId: level} on the class), so leveling down removes them
  // (created documents don't always come back in request order, so pair them up by source)
  const created = toCreate.length ? await actor.createEmbeddedDocuments("Item", toCreate.map((c) => c.data)) : [];
  const levelOf = new Map(toCreate.map((c) => [c.data._stats?.compendiumSource, c.level]));
  const flagUpdate = classFlagUpdate(
    toDelete.map((i) => i.id),
    created.map((item) => [item.id, levelOf.get(item._stats?.compendiumSource)])
  );
  if (Object.keys(flagUpdate).length) await classItem.update(flagUpdate);

  // 4. Altered base features the character has (later ones are altered as PF1 grants them)
  for (const alteration of plan.alters) {
    for (const item of itemsFromSource(classItem, alteration.baseUuid)) await alterItem(item, alteration, plan.archName, record);
  }

  // Archetype features set up by hand before applying get the mechanics too (restored on revert)
  for (const add of choices.adds) {
    const item = add.existing && actor.items.get(add.existing);
    if (!item || !ARCHETYPE_RULES[add.name]) continue;
    snapshot(item, record);
    await giveRules(item, add.name);
  }

  // 5. Spellbook changes (e.g. no domain slot)
  const bookChanges = Object.assign({}, ...choices.adds.map((a) => ARCHETYPE_RULES[a.name]?.spellbook ?? {}));
  const bookKey = spellbookKey(actor, classItem.system.tag);
  if (bookKey && Object.keys(bookChanges).length) {
    const book = actor.system.attributes.spells.spellbooks[bookKey];
    record.spellbook = { key: bookKey, previous: Object.fromEntries(Object.keys(bookChanges).map((k) => [k, book[k]])) };
    await actor.update(Object.fromEntries(Object.entries(bookChanges).map(([k, v]) => [`system.attributes.spells.spellbooks.${bookKey}.${k}`, v])));
  }

  // 6. Record it on the archetype item
  await archetypeItem.setFlag(MODULE_ID, FLAG, record);
  ui.notifications.info(
    `${archetypeItem.name} applied: ${toCreate.length} feature(s) added, ${toDelete.length} removed, ${record.altered.length} altered. Future levels follow the archetype.`
  );
}

async function revertArchetype(actor, record, name) {
  const classItem = actor.items.get(record.classId);
  if (!classItem) return ui.notifications.warn(`${name}: its class is gone, nothing to revert.`);

  // Altered features back to how they were, and the spellbook
  for (const snap of record.altered ?? []) {
    await actor.items.get(snap.id)?.update({ name: snap.name, system: snap.system });
  }
  if (record.spellbook) {
    const { key, previous } = record.spellbook;
    await actor.update(Object.fromEntries(Object.entries(previous).map(([k, v]) => [`system.attributes.spells.spellbooks.${key}.${k}`, v])));
  }

  // Archetype features PF1 or we created since applying (never ones that were set up by hand)
  const preexisting = new Set(record.preexisting);
  const toDelete = record.added.flatMap((a) => itemsFromSource(classItem, a.uuid)).filter((i) => !preexisting.has(i.id));
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete.map((i) => i.id));

  // Bring back removed base features the character qualifies for: snapshots first, else from the compendium
  const level = classItem.system.level ?? 0;
  const restore = [];
  for (const uuid of record.removed) {
    const link = record.links.find((l) => l.uuid === uuid);
    if (!link || link.level > level || itemsFromSource(classItem, uuid).length) continue;
    const snapshot = record.removedItems.find((d) => d._stats?.compendiumSource === uuid);
    if (snapshot) restore.push({ data: snapshot, level: link.level });
    else {
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      const data = game.items.fromCompendium(doc, { clearFolder: true });
      data.system.class = classItem.system.tag;
      restore.push({ data, level: link.level });
    }
  }
  const created = restore.length
    ? await actor.createEmbeddedDocuments("Item", restore.map((r) => r.data), { keepId: true })
    : [];

  await classItem.update({
    "system.links.classAssociations": record.links,
    "system.armorProf": record.armorProf,
    "system.weaponProf": record.weaponProf,
    ...classFlagUpdate(
      toDelete.map((i) => i.id),
      created.map((item, i) => [item.id, restore[i].level])
    ),
  });
  ui.notifications.info(`${name} removed: ${toDelete.length} archetype feature(s) removed, ${restore.length} base feature(s) restored.`);
}

/* -------------------------------------------- */
/*  Triggers                                    */
/* -------------------------------------------- */

// Adding an archetype to a character offers to apply it.
Hooks.on("createItem", (item, options, userId) => {
  if (userId !== game.user.id || !item.actor || !isArchetype(item)) return;
  if (item.getFlag(MODULE_ID, FLAG) || options.pf1eRevampNoPrompt) return;
  promptApply(item.actor, item);
});

// Features PF1 grants on later levels: archetype features get their mechanics, altered base
// features get altered.
Hooks.on("createItem", async (item, options, userId) => {
  if (userId !== game.user.id || item.type !== "feat" || !item.actor) return;
  const source = item._stats?.compendiumSource;
  if (!source) return;
  for (const arch of item.actor.itemTypes.feat) {
    const record = arch.getFlag(MODULE_ID, FLAG);
    if (!record) continue;
    const added = record.added.find((a) => a.uuid === source);
    if (added) await giveRules(item, added.name);
    const alterations = (record.alters ?? []).filter((a) => a.baseUuid === source);
    if (!alterations.length) continue;
    record.altered ??= [];
    for (const alteration of alterations) await alterItem(item, alteration, record.archName, record);
    await arch.setFlag(MODULE_ID, FLAG, record);
  }
});

// Deleting an applied archetype reverts it.
Hooks.on("deleteItem", (item, options, userId) => {
  if (userId !== game.user.id || !item.actor) return;
  const record = item.getFlag(MODULE_ID, FLAG);
  if (record) revertArchetype(item.actor, record, item.name);
});

/* -------------------------------------------- */
/*  Footnotes                                   */
/* -------------------------------------------- */

registerFootnote((item) => {
  if (!item.actor || !isArchetype(item)) return null;
  const record = item.getFlag(MODULE_ID, FLAG);
  if (!record) {
    const content = ["Not applied to this character's class yet."];
    if (item.isOwner) content.push(footnoteButton("Apply archetype…", "Review and apply this archetype", () => promptApply(item.actor, item)));
    return content;
  }

  const classItem = item.actor.items.get(record.classId);
  const names = (uuids) => uuids.map((u) => record.links.find((l) => l.uuid === u)).filter(Boolean);
  const content = [
    `Applied to ${classItem?.name ?? "a removed class"}. Adds ${record.added.length} feature(s) at their levels; replaces ${record.removed.length} base feature(s). Deleting this item reverts it.`,
  ];
  if (item.isOwner) {
    content.push(
      footnoteButton("Remove archetype", "Revert the class to its base features", async () => {
        await revertArchetype(item.actor, record, item.name);
        await item.unsetFlag(MODULE_ID, FLAG);
      })
    );
  }
  return content;
});

// Base features altered (or partly replaced) by an applied archetype say so.
registerFootnote((item) => {
  const source = item._stats?.compendiumSource;
  if (!item.actor || !source) return null;
  const lines = [];
  for (const arch of item.actor.itemTypes.feat) {
    const record = arch.getFlag(MODULE_ID, FLAG);
    for (const note of record?.notes ?? []) if (note.baseUuid === source) lines.push(`${arch.name}: ${note.text}`);
  }
  return lines.length ? [lines.join(" ")] : null;
});

// Keep footnotes current when an archetype is applied or reverted.
Hooks.on("updateItem", (item, changes) => {
  if (foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.${FLAG}`) || foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.-=${FLAG}`)) {
    refreshFootnotes(item);
    for (const other of item.actor?.items ?? []) if (other.sheet?.rendered) other.sheet.render();
  }
});
