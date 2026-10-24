// Slayer talents and ranger combat styles: choosing them, including the choices they lead to.
//
// Slayer Talents: "Starting at 2nd level and every 2 levels thereafter, a slayer gains one slayer
//   talent. Unless otherwise noted, a slayer cannot select an individual talent more than once."
// Advanced Talents: "At 10th level and every 2 levels thereafter, a slayer can select an advanced
//   talent in place of a slayer talent."
// Rogue Talent: "A slayer can select one of the following rogue talents in place of a slayer talent:
//   [list] ... If the rogue talent has a prerequisite, the slayer must fulfill the prerequisite ... This
//   talent can be selected multiple times." Rogue talents are offered only through this talent (and its
//   advanced and catfolk counterparts), even though PF1 tags many of them as slayer talents.
// Ranger Combat Style (slayer talent): "gains a combat feat from the first feat list of that style. He
//   can choose feats from his selected combat style, even if he does not have the normal prerequisites.
//   At 6th level, he may select this talent again and add the 6th-level ranger combat feats ... At 10th
//   level, he may select this talent again and add the 10th-level ranger combat feats."
// Combat Style Feat (ranger): "bonus feats at 2nd, 6th, 10th, 14th, and 18th level. He can choose feats
//   from his selected combat style, even if he does not have the normal prerequisites. The benefits ...
//   apply only when he wears light, medium, or no armor ... Once a ranger selects a combat style, it
//   cannot be changed."
//
// Where: PF1's level-up window (a section at each talent / style feat level), and a button on the
// Slayer Talents and Combat Style Feat features for catching up. Every list has a search box; feat lists
// can also open PF1's Feat Browser (which can't check prerequisites). What a talent brings (granted feats)
// is linked to it: deleting the talent removes them.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { checkPrerequisites } from "./prereqs.mjs";
import { esc, titleFor, norm, plainText, openLink } from "./util.mjs";

const CLASS_PACK = "pf1.class-abilities";
const FEAT_PACKS = ["pf1.feats", "pf-content.pf-feats"];
const SLOT_FLAG = "talentSlot"; // on a chosen talent / style feat: { cls, level, via?, style?, choice? }
const GRANT_FLAG = "grantedBy"; // on an item a talent brought: the talent's id
const STYLE_FLAG = "combatStyle"; // on the ranger's Combat Style Feat: the style's name
const SHARED = ["Rogue Talent", "Rogue Talent, Advanced", "Ninja Trick", "Ninja Trick, Master", "Investigator Talent"];
const RANGER_STYLE_LEVELS = [2, 6, 10, 14, 18];
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const TERRAINS = ["Cold", "Desert", "Forest", "Jungle", "Mountain", "Plains", "Planes", "Swamp", "Underground", "Urban", "Water"];
const CONDITIONS = ["Confused", "Shaken", "Sickened"];

const stem = (name) => name.replace(/\s*\((?:Talent|Trick|SLA|ROG|INV|VIG)\)\s*$/i, "").trim();
const owned = (actor, name) => actor.items.filter((i) => i.type === "feat" && norm(stem(baseName(i.name))) === norm(stem(name)));
const baseName = (name) => name.replace(/\s*\([^()]*\)\s*$/, "").trim(); // "Toxin Training (Con)" → "Toxin Training"

/* -------------------------------------------- */
/*  Data (loaded once)                          */
/* -------------------------------------------- */

let cache = null;

async function data() {
  if (cache) return cache;
  // Everything is read from compendium indexes with descriptions: loading hundreds of documents one by
  // one takes about a minute, the indexes well under a second. Only a chosen item's document is loaded.
  const pack = game.packs.get(CLASS_PACK);
  const index = await pack.getIndex({ fields: ["system.tags", "system.description.value"] });
  const tagged = (e, tags) => (e.system?.tags ?? []).some((t) => tags.includes(t));
  const entry = (e) => ({
    uuid: `Compendium.${CLASS_PACK}.Item.${e._id}`,
    name: e.name,
    tags: e.system?.tags ?? [],
    text: plainText(e.system?.description?.value),
  });

  const talents = index
    .filter((e) => tagged(e, ["Slayer Talent", "Slayer Talent, Advanced"]))
    .map(entry)
    .map((t) => ({ ...t, advanced: t.tags.includes("Slayer Talent, Advanced"), shared: t.tags.some((x) => SHARED.includes(x)) }));

  // Talents reachable only through a list ("Rogue Talent", "Rogue and Ninja Advanced Talents", "Catfolk Rogue
  // Talent"). The lists are compendium links, some without a label, so read the links themselves.
  const byId = new Map(index.map((e) => [e._id, e]));
  const lists = {};
  for (const e of index.filter((e) => tagged(e, ["Slayer Talent", "Slayer Talent, Advanced"]))) {
    const html = e.system?.description?.value ?? "";
    if (!/in place of a slayer (?:advanced )?talent/i.test(html)) continue;
    const found = [...html.matchAll(/@UUID\[Compendium\.[\w-]+\.[\w-]+\.(?:Item\.)?(\w+)\]/g)].map((m) => byId.get(m[1])).filter(Boolean);
    // "... or any rogue advanced talent"
    if (/or any rogue advanced talent/i.test(html)) found.push(...index.filter((x) => tagged(x, ["Rogue Talent, Advanced"])));
    lists[e.name] = [...new Map(found.map((x) => [x._id, x])).values()]
      .map(entry)
      .map((x) => ({ ...x, advanced: x.tags.some((tag) => /Advanced|Master/.test(tag)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Ranger combat styles: feat lists by level
  const styles = index
    .filter((e) => tagged(e, ["Ranger Combat Style"]))
    .map(entry)
    .map((doc) => {
      const t = doc.text;
      const split = (s) => (s ?? "").split(/,\s*(?:and\s+)?|\s+and\s+/).map((x) => x.trim()).filter(Boolean);
      return {
        name: doc.name,
        uuid: doc.uuid,
        tiers: {
          2: split(t.match(/whenever he gains a combat style feat[^:]*:\s*([^.]+)\./i)?.[1]),
          6: split(t.match(/At 6th level, he adds ([^.]+?) to the list/i)?.[1]),
          10: split(t.match(/At 10th level, he adds ([^.]+?) to the list/i)?.[1]),
        },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Feats, for pickers and name lookups. The index includes descriptions so prerequisites can be checked
  // without loading thousands of documents.
  const feats = [];
  for (const id of FEAT_PACKS) {
    const p = game.packs.get(id);
    if (!p) continue;
    for (const e of await p.getIndex({ fields: ["system.tags", "system.description.value"] })) {
      if (e.type === "feat") feats.push({ uuid: `Compendium.${id}.Item.${e._id}`, name: e.name, tags: e.system?.tags ?? [], system: { description: { value: e.system?.description?.value ?? "" } } });
    }
  }
  const featByName = new Map(feats.map((f) => [norm(f.name), f]));

  cache = { talents, lists, styles, feats, featByName };
  return cache;
}

/** A feat by name; "Improved Critical (rapier)" falls back to "Improved Critical", keeping the weapon. */
function featNamed(d, name) {
  const exact = d.featByName.get(norm(name));
  if (exact) return { ...exact, label: exact.name };
  const base = d.featByName.get(norm(baseName(name)));
  return base ? { ...base, label: name, rename: name } : null;
}

/* -------------------------------------------- */
/*  Requirements                                */
/* -------------------------------------------- */

/** Requirements written in a talent's text: level, other talents, race, Int, abilities, repeats. */
export function requirementsOf(text, name = "") {
  const req = { level: 0, talents: [], race: null, int: 0, other: [], repeatable: false, max: Infinity };
  for (const m of text.matchAll(/at least (\d+)(?:st|nd|rd|th) level/gi)) req.level = Math.max(req.level, Number(m[1]));
  // "must have the jaguar's grace talent", "must be at least 6th level and have the poison use talent"
  for (const sentence of text.match(/[^.]*\bmust\b[^.]*\./gi) ?? []) {
    for (const m of sentence.matchAll(/\bhave (?:cold resistance from a racial trait and )?the ([a-z' -]+?) (?:slayer )?talent\b/gi)) req.talents.push(m[1].trim());
    if (/darkvision/i.test(sentence)) req.other.push("darkvision");
    if (/dimension door/i.test(sentence)) req.other.push("dimension door as a spell or spell-like ability");
    if (/disguise self/i.test(sentence)) req.other.push("disguise self as a spell-like ability");
    if (/cold resistance from a racial trait/i.test(sentence)) req.other.push("racial cold resistance");
    if (/earthcraft/i.test(sentence)) req.other.push("the earthcraft ability");
  }
  if (/^Samsaran only/i.test(text)) req.race = "Samsaran";
  if (/^A catfolk slayer/i.test(text)) req.race = "Catfolk";
  req.int = Number(text.match(/Intelligence score of at least (\d+)/i)?.[1] ?? 0);
  if (/more than once|multiple times|selected multiple times/i.test(text)) req.repeatable = true;
  if (/up to three times/i.test(text)) [req.repeatable, req.max] = [true, 3];
  if (norm(name) === norm("Ranger Combat Style")) [req.repeatable, req.max] = [true, 3];
  return req;
}

const MARK = { met: "✓", unmet: "✗", unknown: "?", ignored: "✓" };

/** Can this actor take this talent at this slayer level? → { status, why[] } */
function checkTalent(actor, talent, level) {
  const req = requirementsOf(talent.text, talent.name);
  const why = [];
  let status = "met";
  const fail = (msg) => ((status = "unmet"), why.push(msg));
  if (req.level && level < req.level) fail(`needs slayer level ${req.level}`);
  for (const t of req.talents) if (!owned(actor, t).length) fail(`needs ${t}`);
  if (req.race && norm(actor.race?.name ?? "") !== norm(req.race)) fail(`${req.race} only`);
  if (req.int && (actor.system.abilities.int?.total ?? 0) < req.int) fail(`needs Int ${req.int}`);
  for (const o of req.other) {
    if (o === "darkvision") {
      if (!((actor.system.traits?.senses?.dv?.total ?? 0) > 0)) fail("needs darkvision");
    } else {
      if (status === "met") status = "unknown";
      why.push(`needs ${o}`);
    }
  }
  // Ranger Combat Style: again at 6th and 10th
  if (norm(talent.name) === norm("Ranger Combat Style")) {
    const takes = owned(actor, "Ranger Combat Style").length;
    const needed = [0, 6, 10][takes];
    if (needed === undefined) fail("already taken three times");
    else if (level < needed) fail(`taking it again needs slayer level ${needed}`);
  }
  return { status, why, req };
}

/** Talents this actor could choose at this level (taken ones hidden unless repeatable). */
export async function talentOptions(actor, level) {
  const d = await data();
  return d.talents
    .filter((t) => !t.shared && (!t.advanced || level >= 10))
    .filter((t) => {
      const req = requirementsOf(t.text, t.name);
      return owned(actor, t.name).length < (req.repeatable ? req.max : 1);
    })
    .map((t) => ({ ...t, check: checkTalent(actor, t, level) }))
    .sort((a, b) => a.advanced - b.advanced || a.name.localeCompare(b.name));
}

/* -------------------------------------------- */
/*  Searchable picker                           */
/* -------------------------------------------- */

/**
 * One choice from a list, with a search box. rows: { id, label, status, detail, group, uuid }
 * (uuid adds a book icon that opens the entry).
 * Returns the chosen id, "browse" (open PF1's Feat Browser), or null.
 */
async function pickOne({ title, intro, rows, browse = false, actor = null }) {
  const list = rows
    .map(
      (r, i) => `<label class="pfr-row" data-search="${esc(r.label.toLowerCase())}" style="display:flex; gap:0.4em; align-items:flex-start; padding:2px 0; ${r.status === "unmet" ? "opacity:0.6" : ""}">
        <input type="radio" name="choice" value="${i}" style="flex:none; margin-top:3px">
        <span><strong>${MARK[r.status] ?? ""}</strong> ${esc(r.label)}${openLink(r.uuid)}${r.group ? ` <em style="font-size:11px; opacity:0.7">${esc(r.group)}</em>` : ""}
        ${r.detail ? `<br><span style="font-size:11px; opacity:0.75">${esc(r.detail)}</span>` : ""}</span></label>`
    )
    .join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: titleFor(title, actor), resizable: true },
    position: { width: 520 },
    content: `${intro ? `<p style="margin-top:0">${intro}</p>` : ""}
      <input type="search" class="pfr-search" placeholder="Search…" style="width:100%; margin-bottom:0.4em">
      <p style="font-size:11px; opacity:0.75; margin:0 0 0.3em 0">✓ requirements met · ✗ not met (shown faded) · ? check manually</p>
      <div class="pfr-list" style="max-height:50vh; overflow-y:auto; border:1px solid var(--color-border-light-2, #999); padding:0.3em">${list || "<em>Nothing to choose.</em>"}</div>
      ${browse ? `<p style="font-size:11px; margin:0.4em 0 0 0"><strong>Browse all feats</strong> opens PF1's Feat Browser for its filters. Drag the feat you want onto your character sheet. <strong>The Feat Browser can't check prerequisites</strong>, so make sure you qualify.</p>` : ""}`,
    render: (event, dialog) => {
      const root = dialog.element;
      // Choose stays off, saying why, until something is picked
      const choose = root.querySelector('button[data-action="choose"]');
      const ready = () => {
        const picked = !!root.querySelector('input[name="choice"]:checked');
        if (!choose) return;
        choose.disabled = !picked;
        choose.dataset.tooltip = picked ? "" : "Pick one first";
      };
      root.querySelectorAll('input[name="choice"]').forEach((r) => r.addEventListener("change", ready));
      ready();
      const search = root.querySelector(".pfr-search");
      search?.focus();
      search?.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        for (const row of root.querySelectorAll(".pfr-row")) row.style.display = !q || row.dataset.search.includes(q) ? "flex" : "none";
      });
    },
    buttons: [
      { action: "choose", label: "Choose", default: true, callback: (event, button) => button.form.querySelector('input[name="choice"]:checked')?.value ?? null },
      ...(browse ? [{ action: "browse", label: "Browse all feats…", callback: () => "browse" }] : []),
      { action: "cancel", label: "Cancel", callback: () => null },
    ],
    rejectClose: false,
  });
  if (result === "browse") return "browse";
  return result != null && result !== "cancel" && rows[Number(result)] ? rows[Number(result)].id : null;
}

/* -------------------------------------------- */
/*  Choosing (with follow-up choices)           */
/* -------------------------------------------- */

/**
 * A plan for one slot: { talent: doc, rename?, choice?, style?, feats: [{uuid, rename?}], browse?, via? }.
 * `pick` answers each question: the interactive picker by default; tests pass scripted answers.
 */
export async function chooseSlayerTalent(actor, { level, pick: ask = pickOne } = {}) {
  const pick = (options) => ask({ ...options, actor }); // every window names the slayer
  const d = await data();
  const options = await talentOptions(actor, level);
  const id = await pick({
    title: `Choose a slayer talent (level ${level})`,
    intro: level >= 10 ? "Advanced talents can be taken in place of a slayer talent from 10th level." : "",
    rows: options.map((t) => ({ id: t.name, label: t.name, uuid: t.uuid, status: t.check.status, detail: t.check.why.join("; "), group: t.advanced ? "advanced" : "" })),
  });
  if (!id) return null;
  const talent = options.find((t) => t.name === id);
  return followUp(actor, d, talent, level, pick, null);
}

/** The choices a talent leads to, then its plan. */
async function followUp(actor, d, talent, level, pick, via) {
  const plan = { talent: { uuid: talent.uuid, name: talent.name }, feats: [], via };
  const text = talent.text;

  // A list of rogue / ninja / catfolk talents to choose from
  if (d.lists[talent.name]) {
    const list = d.lists[talent.name].filter((t) => {
      const req = requirementsOf(t.text, t.name);
      return owned(actor, t.name).length < (req.repeatable ? req.max : 1);
    });
    const chosen = await pick({
      title: `${talent.name}: choose`,
      intro: `Taken in place of a slayer talent. Effects based on rogue level use your slayer level.`,
      rows: list.map((t) => {
        const c = checkTalent(actor, t, level);
        return { id: t.name, label: t.name, uuid: t.uuid, status: c.status, detail: c.why.join("; ") };
      }),
    });
    if (!chosen) return null;
    return followUp(actor, d, list.find((t) => t.name === chosen), level, pick, talent.name);
  }

  // Ranger combat style: the style (first time), then a feat from the unlocked lists, prerequisites ignored
  if (norm(talent.name) === norm("Ranger Combat Style")) {
    const previous = owned(actor, "Ranger Combat Style")[0];
    let style = previous?.getFlag(MODULE_ID, SLOT_FLAG)?.style ?? null;
    if (!style) {
      style = await pick({ title: "Ranger Combat Style: choose a style", intro: "The style can't be changed later.", rows: d.styles.map((s) => ({ id: s.name, label: s.name, uuid: s.uuid, status: "met", detail: s.tiers[2].join(", ") })) });
      if (!style) return null;
    }
    const takes = owned(actor, "Ranger Combat Style").length + 1;
    const feat = await pickStyleFeat(actor, d, style, [2, 6, 10].slice(0, takes), pick);
    if (!feat) return null;
    return { ...plan, style, rename: `Ranger Combat Style (${style})`, feats: [feat] };
  }

  // Bonus feats
  if (/gains a bonus combat feat/i.test(text)) return withFeat(plan, await pickFeat(actor, d, (f) => f.tags.includes("Combat"), "combat feat", pick));
  if (/may gain any feat that she qualifies for/i.test(text)) return withFeat(plan, await pickFeat(actor, d, () => true, "feat", pick));
  if (/Amateur Gunslinger feat and one grit feat/i.test(text)) {
    const grit = await pickFeat(actor, d, (f) => f.tags.includes("Grit"), "grit feat", pick, false);
    if (!grit) return null;
    const amateur = featNamed(d, "Amateur Gunslinger");
    return { ...plan, feats: [...(amateur ? [{ uuid: amateur.uuid }] : []), grit] };
  }
  const fixed = text.match(/\bgains (?:the )?([A-Z][\w' -]+?) as a bonus feat/)?.[1] ?? (/Exotic Weapon Proficiency \(firearms\)/i.test(text) ? "Exotic Weapon Proficiency" : null);
  if (fixed) {
    const f = featNamed(d, fixed);
    return { ...plan, feats: f ? [{ uuid: f.uuid, rename: /firearms/i.test(text) ? "Exotic Weapon Proficiency (firearms)" : null }] : [] };
  }

  // Small choices
  const smallChoice = async (title, values, taken) => {
    const v = await pick({ title, rows: values.filter((x) => !taken.includes(x)).map((x) => ({ id: x, label: x, status: "met" })) });
    return v ? { ...plan, choice: v, rename: `${talent.name} (${v})` } : null;
  };
  const takenChoices = owned(actor, talent.name).map((i) => i.getFlag(MODULE_ID, SLOT_FLAG)?.choice).filter(Boolean);
  if (norm(talent.name) === norm("Toxin Training")) return smallChoice("Toxin Training: ability score", ABILITIES.map((a) => pf1.config.abilities[a]), takenChoices);
  if (norm(talent.name) === norm("Focusing Attack")) return smallChoice("Focusing Attack: condition", CONDITIONS, takenChoices);
  if (norm(talent.name) === norm("Terrain Mastery")) return smallChoice("Terrain Mastery: favored terrain", TERRAINS, []);
  return plan;
}

const withFeat = (plan, feat) => (feat ? { ...plan, feats: feat === "browse" ? [] : [feat], browse: feat === "browse" } : null);

async function pickFeat(actor, d, filter, what, pick, browse = true) {
  const have = new Set(actor.itemTypes.feat.map((f) => norm(f.name)));
  const rows = d.feats
    .filter((f) => filter(f) && !have.has(norm(f.name)))
    .map((f) => {
      const c = checkPrerequisites(f, actor); // reads only the description, which the index carries
      return { id: f.uuid, label: f.name, uuid: f.uuid, status: c.status, detail: c.status === "met" ? "" : c.summary };
    });
  rows.sort((a, b) => ({ met: 0, unknown: 1, unmet: 2 })[a.status] - ({ met: 0, unknown: 1, unmet: 2 })[b.status] || a.label.localeCompare(b.label));
  const id = await pick({ title: `Choose a ${what}`, intro: `Prerequisites are checked against your current character.`, rows, browse });
  if (id === "browse") return "browse";
  return id ? { uuid: id } : null;
}

async function pickStyleFeat(actor, d, styleName, tiers, pick) {
  const style = d.styles.find((s) => s.name === styleName);
  const have = new Set(actor.itemTypes.feat.map((f) => norm(f.name)));
  const rows = [];
  for (const tier of tiers) {
    for (const name of style?.tiers[tier] ?? []) {
      const f = featNamed(d, name);
      if (have.has(norm(name))) continue;
      rows.push({ id: f?.uuid ?? `missing:${name}`, label: name, uuid: f?.uuid, status: f ? "ignored" : "unknown", detail: f ? `${tier === 2 ? "" : `${tier}th-level list · `}prerequisites ignored` : "not found in the feat compendiums", group: tier === 2 ? "" : `${tier}th`, rename: f?.rename });
    }
  }
  const id = await pick({ title: `${styleName}: combat style feat`, intro: "Combat style feats ignore their normal prerequisites. Their benefits only apply in light, medium or no armor.", rows });
  if (!id || id.startsWith("missing:")) return null;
  return { uuid: id, rename: rows.find((r) => r.id === id)?.rename };
}

/** Ranger: a combat style feat (choosing the style first if needed). */
export async function chooseRangerStyleFeat(actor, { level, pick: ask = pickOne } = {}) {
  const pick = (options) => ask({ ...options, actor });
  const d = await data();
  const feature = actor.itemTypes.feat.find((f) => f.name === "Combat Style Feat");
  let style = feature?.getFlag(MODULE_ID, STYLE_FLAG) ?? null;
  if (!style) {
    style = await pick({ title: "Ranger: choose a combat style", intro: "Once chosen, the style can't be changed.", rows: d.styles.map((s) => ({ id: s.name, label: s.name, uuid: s.uuid, status: "met", detail: s.tiers[2].join(", ") })) });
    if (!style) return null;
  }
  const feat = await pickStyleFeat(actor, d, style, [2, 6, 10].filter((t) => level >= t), pick);
  return feat ? { style, feats: [feat], ranger: true } : null;
}

/* -------------------------------------------- */
/*  Applying and undoing                        */
/* -------------------------------------------- */

/** Create what a plan chose: the talent (if any) and its feats, linked so deleting the talent removes them. */
export async function applyPlan(actor, plan, slotLevel) {
  const cls = plan.ranger ? "ranger" : "slayer";
  let talent = null;
  if (plan.talent) {
    const data = game.items.fromCompendium(await fromUuid(plan.talent.uuid), { clearFolder: true });
    if (plan.rename) data.name = plan.rename;
    // A talent that hands out a feat makes room for it
    if (plan.feats.length && !(data.system.changes ?? []).some((c) => c.target === "bonusFeats")) {
      data.system.changes = [...(data.system.changes ?? []), { _id: foundry.utils.randomID(8), target: "bonusFeats", type: "untyped", formula: "1" }];
    }
    data.flags = { ...(data.flags ?? {}), [MODULE_ID]: { [SLOT_FLAG]: { cls, level: slotLevel, via: plan.via ?? null, style: plan.style ?? null, choice: plan.choice ?? null } } };
    [talent] = await actor.createEmbeddedDocuments("Item", [data]);
  }
  const featData = [];
  for (const f of plan.feats) {
    const doc = await fromUuid(f.uuid);
    if (!doc) continue;
    const item = game.items.fromCompendium(doc, { clearFolder: true });
    if (f.rename) item.name = f.rename;
    item.flags = { ...(item.flags ?? {}), [MODULE_ID]: talent ? { [GRANT_FLAG]: talent.id } : { [SLOT_FLAG]: { cls, level: slotLevel, style: plan.style } } };
    featData.push(item);
  }
  const feats = featData.length ? await actor.createEmbeddedDocuments("Item", featData) : [];
  if (plan.ranger) {
    const feature = actor.itemTypes.feat.find((f) => f.name === "Combat Style Feat");
    if (feature && !feature.getFlag(MODULE_ID, STYLE_FLAG)) await feature.setFlag(MODULE_ID, STYLE_FLAG, plan.style);
  }
  if (plan.browse && talent) watchForBrowsedFeat(actor, talent);
  const names = [talent?.name, ...feats.map((f) => f.name)].filter(Boolean);
  ui.notifications.info(`${actor.name}: ${names.join(" + ")}${plan.browse ? ". Drag your feat from the Feat Browser onto the sheet." : "."}`);
  return { talent, feats };
}

/* Feat Browser: the next feat dropped on this character (within 15 minutes) is the talent's feat. */
const browseWatch = new Map(); // actor id → { talentId, until }
function watchForBrowsedFeat(actor, talent) {
  browseWatch.set(actor.id, { talentId: talent.id, until: Date.now() + 15 * 60 * 1000 });
  pf1.applications.compendiums?.feats?.render(true);
}
Hooks.on("createItem", (item, options, userId) => {
  const watch = browseWatch.get(item.actor?.id);
  if (!watch || userId !== game.user.id || item.type !== "feat" || item.system.subType !== "feat" || item.flags[MODULE_ID]?.[GRANT_FLAG]) return;
  browseWatch.delete(item.actor.id);
  if (Date.now() > watch.until || !item.actor.items.has(watch.talentId)) return;
  item.setFlag(MODULE_ID, GRANT_FLAG, watch.talentId);
  ui.notifications.info(`${item.name} is linked to ${item.actor.items.get(watch.talentId).name}.`);
});

// Deleting a talent removes what it brought
Hooks.on("deleteItem", (item, options, userId) => {
  if (userId !== game.user.id || !item.actor || !item.flags[MODULE_ID]?.[SLOT_FLAG]) return;
  const granted = item.actor.items.filter((i) => i.flags[MODULE_ID]?.[GRANT_FLAG] === item.id).map((i) => i.id);
  if (granted.length) item.actor.deleteEmbeddedDocuments("Item", granted);
});

/* -------------------------------------------- */
/*  Slots                                       */
/* -------------------------------------------- */

const classLevelOf = (actor, tag) => actor.itemTypes.class.find((c) => c.system.tag === tag)?.system.level ?? 0;

/** Slayer talent slots: levels 2, 4, 6... plus Extra Slayer Talent feats; and which are filled. */
export function slayerSlots(actor) {
  const level = classLevelOf(actor, "slayer");
  const extra = actor.itemTypes.feat.filter((f) => /^Extra Slayer Talent/.test(f.name)).length;
  const total = Math.floor(level / 2) + extra;
  // Chosen here, or added by hand (a slayer talent that no talent brought)
  const used = actor.itemTypes.feat.filter((f) => {
    if (f.flags[MODULE_ID]?.[GRANT_FLAG]) return false;
    if (f.flags[MODULE_ID]?.[SLOT_FLAG]?.cls === "slayer") return true;
    return (f.system.tags ?? []).some((t) => t === "Slayer Talent" || t === "Slayer Talent, Advanced") && !f.flags[MODULE_ID]?.[SLOT_FLAG];
  }).length;
  return { level, total, used, next: used < total ? Math.min(level, 2 * (used + 1)) : null };
}

export function rangerSlots(actor) {
  const level = classLevelOf(actor, "ranger");
  const levels = RANGER_STYLE_LEVELS.filter((l) => l <= level);
  const used = actor.itemTypes.feat.filter((f) => f.flags[MODULE_ID]?.[SLOT_FLAG]?.cls === "ranger").length;
  return { level, total: levels.length, used, next: levels[used] ?? null };
}

/* -------------------------------------------- */
/*  Level-up window                             */
/* -------------------------------------------- */

// Keyed by the window itself: PF1 gives every level-up window for a class the same id, so a
// closed window's delayed cleanup would otherwise wipe the next level's choice.
const pending = new Map(); // level-up window → { actorUuid, cls, level, plan }

function levelUpSection(app) {
  const cls = norm(app.item.name);
  const newLevel = app.config?.level?.new ?? (app.item.system.level ?? 0) + 1;
  const isSlayer = cls === "slayer" && newLevel >= 2 && newLevel % 2 === 0;
  const isRanger = cls === "ranger" && RANGER_STYLE_LEVELS.includes(newLevel);
  if (!isSlayer && !isRanger) return null;
  const state = pending.get(app) ?? { actorUuid: app.actor.uuid, cls: isSlayer ? "slayer" : "ranger", level: newLevel, plan: null };
  pending.set(app, state);

  const section = document.createElement("section");
  section.className = `${MODULE_ID}-levelup-talent`;
  section.style.cssText = "margin: 0.5em 0; padding: 0.25em 0.5em; border: 1px dashed var(--color-border-light-2, #999);";
  const title = isSlayer ? `Slayer talent (level ${newLevel})` : `Combat style feat (level ${newLevel})`;
  const summary = state.plan ? esc([state.plan.rename ?? state.plan.talent?.name ?? state.plan.style, ...state.plan.feats.map((f) => f.rename ?? fromUuidSync(f.uuid)?.name)].filter(Boolean).join(" → ")) : "<em>not chosen yet (you can also choose later from the feature)</em>";
  section.innerHTML = `<h3 style="margin:0 0 0.25em 0">${title} <span style="font-size:11px; opacity:0.7">(PF1e Revamp)</span></h3><p style="font-size:12px; margin:0 0 0.25em 0">${summary}</p>`;
  section.append(
    footnoteButton(state.plan ? "Change…" : "Choose…", "Choose now; it's added when you click Finish", async () => {
      const plan = isSlayer ? await chooseSlayerTalent(app.actor, { level: newLevel }) : await chooseRangerStyleFeat(app.actor, { level: newLevel });
      if (plan) state.plan = plan;
      app.render();
    })
  );
  return section;
}

Hooks.on("renderLevelUpForm", (app, html) => {
  const root = html[0] ?? html;
  const footer = root.querySelector("footer.buttons");
  if (!footer || app.isNewClass) return;
  root.querySelector(`.${MODULE_ID}-levelup-talent`)?.remove();
  const section = levelUpSection(app);
  if (!section) return;
  footer.before(section);
  app.setPosition({ height: "auto" });
});

Hooks.on("closeLevelUpForm", (app) => setTimeout(() => pending.delete(app), 10000));

Hooks.on("pf1ClassLevelChange", (actor, classItem, curLevel, newLevel) => {
  if (newLevel <= curLevel) return;
  for (const [app, state] of pending) {
    if (state.actorUuid !== actor.uuid || state.level !== newLevel || norm(classItem.name) !== state.cls) continue;
    pending.delete(app);
    if (state.plan) applyPlan(actor, state.plan, newLevel);
  }
});

/* -------------------------------------------- */
/*  Footnotes (catching up)                     */
/* -------------------------------------------- */

registerFootnote((item) => {
  if (!item.actor || item.type !== "feat") return null;
  if (item.name === "Slayer Talents") {
    const s = slayerSlots(item.actor);
    const content = [`Talents: ${s.used} of ${s.total} chosen.`];
    if (item.isOwner && s.next) {
      content.push(
        footnoteButton("Choose talent…", "Choose the next slayer talent", async () => {
          const plan = await chooseSlayerTalent(item.actor, { level: s.level });
          if (plan) await applyPlan(item.actor, plan, s.next);
          refreshFootnotes(item);
        })
      );
    }
    return content;
  }
  if (item.name === "Combat Style Feat") {
    const s = rangerSlots(item.actor);
    const style = item.getFlag(MODULE_ID, STYLE_FLAG);
    const content = [`${style ? `Style: ${style}. ` : ""}Combat style feats: ${s.used} of ${s.total} chosen. They ignore prerequisites, and only work in light, medium or no armor.`];
    if (item.isOwner && s.next) {
      content.push(
        footnoteButton("Choose feat…", "Choose the next combat style feat", async () => {
          const plan = await chooseRangerStyleFeat(item.actor, { level: s.level });
          if (plan) await applyPlan(item.actor, plan, s.next);
          refreshFootnotes(item);
        })
      );
    }
    return content;
  }
  const slot = item.getFlag(MODULE_ID, SLOT_FLAG);
  if (slot?.cls === "slayer") return [`Slayer talent chosen at level ${slot.level}${slot.via ? ` through ${slot.via}` : ""}. Deleting it removes the feats it granted.`];
  const by = item.getFlag(MODULE_ID, GRANT_FLAG);
  if (by) return [`Granted by ${item.actor.items.get(by)?.name ?? "a talent"}.`];
  return null;
});
