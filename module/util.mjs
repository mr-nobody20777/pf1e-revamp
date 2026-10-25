// Helpers shared across PF1e Revamp's features.

import { MODULE_ID } from "./const.mjs";

/** A window title naming the creature it acts for, like PF1's own ("Attack (Longsword) – Kestrel"). */
export const titleFor = (title, actor) => (actor?.name ? `${title} – ${actor.name}` : title);

/** Escape text for HTML. */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Lowercase, punctuation-free form of a name for loose matching. */
export const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Any dropdown we add with more than 10 options gets a search box in front of it: typing hides the
 * options that don't match (and picks the first match, so Enter-less use still works).
 */
export function addSearch(select) {
  if (select.options.length <= 10 || select.dataset.searchable) return select;
  select.dataset.searchable = "1";
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Search…";
  input.style.cssText = "flex: 0 0 35%; margin: 0 0.4em 0.25em 0;";
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    let first = null;
    for (const option of select.options) {
      const match = !option.value || !q || option.textContent.toLowerCase().includes(q);
      option.hidden = !match;
      if (match && option.value && !first) first = option;
    }
    const current = select.selectedOptions[0];
    if (q && first && (!current?.value || current.hidden)) {
      select.value = first.value;
      select.dispatchEvent(new Event("change"));
    }
  });
  select.before(input);
  return select;
}

/** addSearch for every long dropdown in a dialog or section. */
export const searchSelects = (root) => root?.querySelectorAll("select").forEach(addSearch);

/** A book icon that opens an entry's sheet, so picker options can be read before choosing. */
export const openLink = (uuid) =>
  uuid ? ` <a class="${MODULE_ID}-open" data-uuid="${esc(uuid)}" data-tooltip="Read the full entry" style="margin-left: 0.2em; opacity: 0.8"><i class="fa-solid fa-book-open"></i></a>` : "";

// One listener for every picker. Capture phase, so clicking the icon inside an option's <label>
// opens the entry without also selecting the option.
document.addEventListener(
  "click",
  async (event) => {
    const link = event.target.closest?.(`.${MODULE_ID}-open`);
    if (!link?.dataset.uuid) return;
    event.preventDefault();
    event.stopPropagation();
    (await fromUuid(link.dataset.uuid))?.sheet?.render(true);
  },
  true
);

/** HTML description → plain text, with enricher links reduced to their labels. */
export function plainText(html) {
  const div = document.createElement("div");
  div.innerHTML = (html ?? "").replace(/@UUID\[[^\]]+\](?:\{([^}]+)\})?/g, "$1").replace(/<br\s*\/?>|<\/(?:p|li|h\d|div)>/g, " ");
  return div.textContent.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Evaluate a roll formula; missing references (e.g. @classes.slayer.level on a non-slayer) count as 0.
 * Pass a small `rollData` object on hot paths: building an item's full roll data is expensive.
 */
export function evaluate(formula, item, rollData = item.getRollData()) {
  const { RollPF } = pf1.dice;
  return RollPF.safeRollSync(RollPF.replaceFormulaData(formula, rollData, { missing: 0 }), rollData).total || 0;
}

/** Level of the class an item belongs to (its own class tag, else the given fallback class). */
export function classLevel(item, fallbackTag) {
  const classes = item.actor?.itemTypes.class ?? [];
  const tag = item.system.class || fallbackTag;
  return classes.find((c) => c.system.tag === tag)?.system.level ?? 0;
}

/**
 * Scene-load catch-up for the active GM: one pass over every actor's items, calling each
 * registered handler for the items it cares about (instead of one full scan per feature).
 */
const catchUps = [];
export function onSceneCatchUp(handler) {
  catchUps.push(handler);
}
Hooks.on("canvasReady", () => {
  if (!isActiveGM() || !catchUps.length) return;
  for (const actor of allActors()) for (const item of actor.items) for (const handler of catchUps) handler(item);
});

/** Only the active GM writes to actors other players don't own. */
export function isActiveGM() {
  return game.users.activeGM?.isSelf ?? false;
}

/**
 * Changes a player can't make themselves (another character's HP, a combatant's initiative) are
 * requested with a chat message carrying flags["pf1e-revamp"][key]; the active GM's client runs the
 * handler for it. One createChatMessage listener serves every feature.
 */
const gmHandlers = new Map();
export function onGmRequest(key, handler) {
  gmHandlers.set(key, handler);
}
Hooks.on("createChatMessage", (message) => {
  const flags = message.flags?.[MODULE_ID];
  if (!flags || !isActiveGM()) return;
  for (const [key, handler] of gmHandlers) if (flags[key] !== undefined) handler(message, flags[key]);
});

/** An item the actor has equipped whose name matches (worn armor, a wondrous item). */
export const equippedItem = (actor, re) => actor?.items.find((i) => i.type === "equipment" && i.system.equipped && re.test(i.name)) ?? null;

/** Did the user who made this GM request own the actor (players may only ask for their own)? */
export const requestedByOwner = (request, actor) => !!actor && !!request.author && (request.author.isGM || actor.testUserPermission(request.author, "OWNER"));

/** Users to whisper an actor's prompts to: its player owners, or the GMs if it has none. */
export function ownerWhisper(actor) {
  const owners = game.users.filter((u) => !u.isGM && actor.testUserPermission(u, "OWNER")).map((u) => u.id);
  return owners.length ? owners : game.users.filter((u) => u.isGM).map((u) => u.id);
}

/** Key of the actor's spellbook for the given class tag ("cleric", "wizard"), if it's in use. */
export function spellbookKey(actor, classTag) {
  const books = actor?.system.attributes?.spells?.spellbooks ?? {};
  return Object.keys(books).find((k) => books[k].inUse && books[k].class === classTag) ?? null;
}

/**
 * Wrap a PF1 method (dotted path from globalThis): fn(wrapped, ...args). Call during setup. libWrapper
 * allows one wrapper per module per method, so the method is registered once and every feature's
 * wrapper is chained inside it (in registration order). Without libWrapper the method is patched directly.
 */
const wrappers = new Map(); // path → [fn]
export function wrapMethod(path, fn) {
  if (wrappers.has(path)) return wrappers.get(path).push(fn);
  const chain = [fn];
  wrappers.set(path, chain);
  const composite = function (wrapped, ...args) {
    const call = chain.reduceRight((next, f) => (...a) => f.call(this, next, ...a), wrapped);
    return call(...args);
  };
  if (game.modules.get("lib-wrapper")?.active) return libWrapper.register(MODULE_ID, path, composite, "WRAPPER");
  const owner = path.split(".").slice(0, -1).reduce((o, k) => o?.[k], globalThis);
  const method = path.split(".").pop();
  const original = owner[method];
  owner[method] = function (...args) {
    return composite.call(this, original.bind(this), ...args);
  };
}

/** All actors that might hold linked features or buffs: world actors plus this scene's token actors. */
export function allActors() {
  const actors = new Set(game.actors);
  for (const token of canvas.scene?.tokens ?? []) if (token.actor) actors.add(token.actor);
  return actors;
}

/** Buffs on an actor whose `flagKey` link points at the given source (and target, if given). */
export function linkedBuffs(actor, flagKey, sourceUuid, targetUuid) {
  return (actor?.itemTypes.buff ?? []).filter((buff) => {
    const link = buff.getFlag(MODULE_ID, flagKey);
    return link?.source === sourceUuid && (!targetUuid || link.target === targetUuid);
  });
}

/**
 * Actor items from a given compendium source that belong to this class. Some features (Scribe
 * Scroll) are shared between classes, so another class's copy must not match.
 */
export function itemsFromSource(classItem, uuid) {
  const tracked = classItem.getFlag("pf1", "links.classAssociations") ?? {};
  return classItem.actor.items.filter(
    (i) => i._stats?.compendiumSource === uuid && (i.id in tracked || !i.system.class || i.system.class === classItem.system.tag)
  );
}

/** Update data that adds/removes entries in a class's {itemId: level} association flag without touching other flags. */
export function classFlagUpdate(removedIds, added) {
  const update = {};
  for (const id of removedIds) update[`flags.pf1.links.classAssociations.-=${id}`] = null;
  for (const [id, level] of added) update[`flags.pf1.links.classAssociations.${id}`] = level;
  return update;
}

/** Create class features from compendium UUIDs on the class's actor, tagged with the class like PF1 does. */
export async function createClassFeatures(classItem, entries) {
  const data = [];
  const levels = [];
  for (const { uuid, level } of entries) {
    const doc = await fromUuid(uuid);
    if (!doc) continue;
    const itemData = game.items.fromCompendium(doc, { clearFolder: true });
    itemData.system.class = classItem.system.tag;
    data.push(itemData);
    levels.push(level);
  }
  if (!data.length) return [];
  const created = await classItem.actor.createEmbeddedDocuments("Item", data);
  await classItem.update(classFlagUpdate([], levelsBySource(data.map((d, i) => [d, levels[i]]), created)));
  return created;
}

/**
 * [itemId, level] for items created from [data, level] requests. Created documents don't always come back
 * in request order, so they're paired by compendium source; copies of one source take its levels in order.
 */
export function levelsBySource(requests, created) {
  const levels = new Map();
  for (const [data, level] of requests) {
    const source = data._stats?.compendiumSource;
    if (!levels.has(source)) levels.set(source, []);
    levels.get(source).push(level);
  }
  return created.map((item) => [item.id, levels.get(item._stats?.compendiumSource)?.shift()]);
}

/** False once a document has been deleted (e.g. a queued sync whose character was removed meanwhile). */
export function stillExists(doc) {
  return !!doc && !!fromUuidSync(doc.uuid);
}

/** Queued cleanups run a moment later: skip anything deleted meanwhile (with its actor, say), or the server reports an error to every GM. */
export const deleteIfExists = (doc) => (stillExists(doc) ? doc.delete() : null);

// Quench test suite: only loaded when Quench is active (module/tests/)
Hooks.on("quenchReady", (quench) => import("./tests/index.mjs").then((m) => m.registerTests(quench)));

/** Run async work one task at a time, so overlapping hooks can't create duplicate buffs. */
const queues = [];
/** Resolves once every queue is idle (tests wait for it before deleting what the queues are syncing). */
export async function settled() {
  let tails;
  do {
    await new Promise((r) => setTimeout(r, 50)); // let hooks that are about to enqueue do so
    tails = queues.map((q) => q.tail);
    await Promise.all(tails);
  } while (queues.some((q, i) => q.tail !== tails[i]));
}

export function createQueue(label) {
  const queue = { tail: Promise.resolve() };
  queues.push(queue);
  return (fn) => {
    queue.tail = queue.tail.then(fn).catch((err) => {
      // A document deleted while a sync was queued (e.g. the character itself) is expected; nothing left to sync
      if (/does not exist/.test(err?.message ?? "")) return console.debug(`${MODULE_ID} | ${label} sync skipped: ${err.message}`);
      console.error(`${MODULE_ID} | ${label} sync failed`, err);
    });
  };
}
