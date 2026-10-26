// Shared helpers for PF1e Revamp's Quench tests. Tests build throwaway actors in the
// "PF1e Revamp Tests" folder and clean up after themselves.

import { settled } from "../util.mjs";

export const TEST_FOLDER = "PF1e Revamp Tests";

export async function fromPack(packId, name) {
  const pack = game.packs.get(packId);
  if (!pack) throw new Error(`Compendium ${packId} not found`);
  const entry = pack.index.find((e) => e.name === name);
  if (!entry) throw new Error(`${name} not found in ${packId}`);
  return game.items.fromCompendium(await pack.getDocument(entry._id), { clearFolder: true });
}

export async function createTestActor(name, { abilities = {}, items = [], system: extra = {} } = {}) {
  let folder = game.folders.find((f) => f.type === "Actor" && f.name === TEST_FOLDER);
  folder ??= await Folder.create({ name: TEST_FOLDER, type: "Actor" });
  const system = foundry.utils.mergeObject(
    { abilities: Object.fromEntries(Object.entries(abilities).map(([k, v]) => [k, { value: v }])) },
    extra
  );
  const actor = await Actor.create({ name, type: "character", folder: folder.id, system });
  const data = [];
  for (const [packId, itemName, overrides] of items) {
    const item = await fromPack(packId, itemName);
    if (overrides) foundry.utils.mergeObject(item, overrides);
    data.push(item);
  }
  if (data.length) await actor.createEmbeddedDocuments("Item", data);
  return actor;
}

export async function addItems(actor, items) {
  const data = [];
  for (const [packId, name, overrides] of items) {
    const item = await fromPack(packId, name);
    if (overrides) foundry.utils.mergeObject(item, overrides);
    data.push(item);
  }
  // created documents don't always come back in request order, so match them up by name
  const created = await actor.createEmbeddedDocuments("Item", data);
  return data.map((d) => created.splice(created.findIndex((c) => c.name === d.name), 1)[0]);
}

export async function removeItems(actor, names) {
  const ids = actor.items.filter((i) => names.includes(i.name)).map((i) => i.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}

export async function waitFor(check, { timeout = 8000, interval = 100, what = "condition" } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await check();
    if (result) return result;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

/**
 * Use an item and collect the action chat cards it produces (including follow-up cards, like the
 * automatic off-hand attack), waiting until `cards` of them exist.
 */
export async function useAndCollect(item, { cards = 1, options = {} } = {}) {
  const before = new Set(game.messages.keys());
  await item.use({ skipDialog: true, options });
  return waitFor(() => {
    const found = game.messages.contents.filter((m) => !before.has(m.id) && m.type === "action" && m.speaker.actor === item.actor.id);
    return found.length >= cards ? found : null;
  });
}

/** Attack and damage formulas of an action card. */
export function formulas(message) {
  return (message.systemRolls?.attacks ?? []).map((a) => ({
    attack: a.attack?.formula ?? "",
    damage: (a.damage ?? []).map((d) => d.formula).join(" + "),
  }));
}

/* Scenes and tokens: tests run on their own scene, viewed only by the test runner's client. */

export const TEST_SCENE = "PF1e Revamp Tests";

export async function useTestScene() {
  let scene = game.scenes.getName(TEST_SCENE);
  scene ??= await Scene.create({ name: TEST_SCENE, width: 2000, height: 2000, padding: 0, grid: { size: 100, distance: 5 }, navigation: false });
  const previous = canvas.scene;
  const view = async (s) => {
    if (canvas.scene?.id === s.id) return;
    const ready = new Promise((r) => Hooks.once("canvasReady", r));
    await s.view();
    await ready;
  };
  await view(scene);
  // Tokens left by a run that was cut off (their test actors are already deleted)
  const orphans = scene.tokens.filter((t) => !game.actors.has(t.actorId)).map((t) => t.id);
  if (orphans.length) await scene.deleteEmbeddedDocuments("Token", orphans);
  return { scene, restore: () => previous && view(previous) };
}

/** Place a linked token for the actor `col`/`row` squares into the test scene. */
export async function placeToken(actor, col, row, { disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY } = {}) {
  const size = canvas.scene.grid.size;
  const token = await actor.getTokenDocument({ x: canvas.dimensions.sceneX + col * size, y: canvas.dimensions.sceneY + row * size, disposition, actorLink: true });
  const [doc] = await canvas.scene.createEmbeddedDocuments("Token", [token.toObject()]);
  await waitFor(() => doc.object);
  return doc;
}

export function setTargets(tokenDocs) {
  for (const t of [...game.user.targets]) t.setTarget(false, { releaseOthers: false, groupSelection: true });
  for (const doc of tokenDocs) doc.object.setTarget(true, { releaseOthers: false, groupSelection: true });
}

export async function deleteTokens(tokenDocs) {
  setTargets([]);
  const ids = tokenDocs.filter((t) => t && canvas.scene.tokens.has(t.id)).map((t) => t.id);
  if (ids.length) await canvas.scene.deleteEmbeddedDocuments("Token", ids);
}

/** Wait for an item by name to exist on an actor (PF1 adds class features asynchronously). */
export function waitForItem(actor, name) {
  return waitFor(() => actor.items.getName(name));
}

/** Close windows PF1 opens on its own during tests (e.g. the Experience Distributor after combat). */
export async function closeStrayWindows() {
  for (const app of [...Object.values(ui.windows), ...foundry.applications.instances.values()]) {
    if (/ExperienceDistributor/.test(app.constructor.name)) await app.close();
  }
}

export async function cleanup(actors, messageIdsBefore) {
  await closeStrayWindows();
  // Dialogs a test left open for its actors (e.g. a grant prompt), which would act on deleted documents
  const names = actors.filter(Boolean).map((a) => a.name);
  for (const app of [...foundry.applications.instances.values()]) {
    if (app.rendered && names.some((n) => (app.title ?? "").endsWith(`– ${n}`) || (app.title ?? "").startsWith(`${n}:`))) await app.close();
  }
  await settled(); // the module's linked-buff syncs finish before their actors are deleted
  for (const actor of actors) await actor?.delete();
  // Let Foundry's chat pop-up notifications finish before their messages disappear
  await new Promise((r) => setTimeout(r, 1500));
  const ids = game.messages.contents.filter((m) => !messageIdsBefore.has(m.id)).map((m) => m.id);
  if (ids.length) await ChatMessage.implementation.deleteDocuments(ids);
}
