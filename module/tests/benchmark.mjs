// Performance benchmark for code reviews (not part of the Quench suite). Simulates a busy session
// and times it with PF1e Revamp's hooks attached and detached; the difference is our cost.
// Run from the console: (await import("/modules/pf1e-revamp/module/tests/benchmark.mjs")).runBenchmark()

import { createTestActor, addItems, fromPack, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor, waitForItem } from "./helpers.mjs";
import { promptApply } from "../subclass.mjs";
import { wrapperChains } from "../util.mjs";
import * as LA from "../lasting-areas.mjs";
import * as AF from "../afflictions.mjs";

const MODULE_ID = "pf1e-revamp";

// Our hook handlers are found by their source: a handler whose text appears in one of the module's own
// files is ours. The module's files are module.json's scripts and everything they import.
const squash = (t) => t.replace(/\s+/g, " ");
async function ourSources() {
  const base = `/modules/${MODULE_ID}/`;
  const seen = new Map();
  const queue = [...(game.modules.get(MODULE_ID).esmodules ?? [])].map((p) => p.replace(/^\//, "").replace(/^modules\/[^/]+\//, ""));
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path) || path.includes("/tests/")) continue;
    const text = await (await fetch(base + path)).text();
    seen.set(path, text);
    const dir = path.split("/").slice(0, -1).join("/");
    for (const m of text.matchAll(/from "\.\/([^"]+)"/g)) queue.push(`${dir}/${m[1]}`);
  }
  return seen;
}

/** Our hook registrations: every hook our sources listen to, and the handlers whose text is ours. */
async function ourHooks() {
  const sources = await ourSources();
  const all = squash([...sources.values()].join("\n"));
  const names = new Set([...all.matchAll(/Hooks\.(?:on|once)\("([^"]+)"/g)].map((m) => m[1]));
  const found = [];
  for (const hook of names) {
    (Hooks.events[hook] ?? []).forEach((entry, index) => {
      const text = squash(entry.fn?.toString() ?? "");
      if (text.length > 20 && all.includes(text)) found.push({ hook, entry, key: `${hook} #${index}` });
    });
  }
  return found;
}

/** Time each of our method wrappers (libWrapper chains); returns totals and a function that unwraps them. */
function instrumentWrappers() {
  const totals = {};
  const undo = [];
  for (const [path, chain] of wrapperChains) {
    chain.forEach((fn, i) => {
      const label = `wrapper ${path.replace(/^pf1\./, "")} #${i}`;
      totals[label] = { ms: 0, calls: 0 };
      // A wrapper's own time: the call minus the time spent in the wrapped method it calls
      chain[i] = function (wrapped, ...args) {
        let inner = 0;
        const timedWrapped = (...a) => {
          const s = performance.now();
          try {
            const r = wrapped(...a);
            if (r instanceof Promise) return r.finally(() => (inner += performance.now() - s));
            inner += performance.now() - s;
            return r;
          } catch (err) {
            inner += performance.now() - s;
            throw err;
          }
        };
        const start = performance.now();
        const done = () => { totals[label].ms += performance.now() - start - inner; totals[label].calls++; };
        const result = fn.call(this, timedWrapped, ...args);
        if (result instanceof Promise) return result.finally(done);
        done();
        return result;
      };
      undo.push(() => (chain[i] = fn));
    });
  }
  return { totals, restore: () => undo.forEach((u) => u()) };
}

/** Wrap each of our handlers with a timer; returns totals and a function that unwraps them. */
function instrument(hooks) {
  const totals = {};
  for (const h of hooks) {
    const original = h.entry.fn;
    const label = `${h.key}: ${original.toString().replace(/\s+/g, " ").slice(0, 70)}`;
    totals[label] = { ms: 0, calls: 0 };
    h.entry.fn = function (...args) {
      const start = performance.now();
      try {
        const result = original.apply(this, args);
        if (result instanceof Promise) return result.finally(() => { totals[label].ms += performance.now() - start; totals[label].calls++; });
        totals[label].ms += performance.now() - start;
        totals[label].calls++;
        return result;
      } catch (err) {
        totals[label].ms += performance.now() - start;
        throw err;
      }
    };
    h.restore = () => (h.entry.fn = original);
  }
  return { totals, restore: () => hooks.forEach((h) => h.restore()) };
}

const heap = () => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576);

async function time(fn) {
  const start = performance.now();
  await fn();
  return Math.round(performance.now() - start);
}

export async function runBenchmark({ rounds = 3 } = {}) {
  const messagesBefore = new Set(game.messages.keys());
  const sceneCtl = await useTestScene();

  // A session's worth of active features
  const sorc = await createTestActor("Bench Sorcerer", { abilities: { cha: 16 }, items: [["pf1.classes", "Sorcerer", { system: { level: 9 } }]] });
  const [bloodline] = await sorc.createEmbeddedDocuments("Item", [await fromPack("pf1.class-abilities", "Solar Bloodline")], { [`${MODULE_ID}NoPrompt`]: true });
  await promptApply(sorc, bloodline, { grantAll: true });
  const slayer = await createTestActor("Bench Slayer", { abilities: { str: 16 }, items: [["pf1.classes", "Slayer", { system: { level: 5 } }], ["pf1.weapons-and-ammo", "Longsword"]] });
  await addItems(slayer, [["pf1.buffs", "Bless"]]);
  const goblin = await createTestActor("Bench Goblin", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
  const studied = await waitForItem(slayer, "Studied Target");
  const slayerToken = await placeToken(slayer, 2, 2);
  const goblinToken = await placeToken(goblin, 3, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
  setTargets([goblinToken]);
  await studied.use({ skipDialog: true });
  await waitFor(() => studied.getFlag(MODULE_ID, "studiedTarget")?.targets?.length);
  const bless = slayer.items.getName("Bless");
  const longsword = slayer.items.getName("Longsword");
  const recent = () => game.messages.contents.slice(-40);
  // A cleric with a prepared spellbook (spontaneous casting buttons on its sheet)
  const cleric = await createTestActor("Bench Cleric", { abilities: { wis: 16 }, system: { details: { alignment: "ng" } }, items: [["pf1.classes", "Cleric", { system: { level: 3 } }]] });
  await addItems(cleric, ["Bless", "Shield of Faith", "Hold Person", "Aid", "Divine Favor"].map((name) => ["pf1.spells", name, { system: { spellbook: "primary", level: 1, preparation: { value: 1, max: 1 } } }]));

  // Magic arms: qualities, materials, a generated name, mithral armor
  const fighter = await createTestActor("Bench Fighter", { abilities: { str: 16 }, items: [["pf1.classes", "Fighter", { system: { level: 6 } }]] });
  const [flaming] = await addItems(fighter, [
    ["pf1.weapons-and-ammo", "Longsword", { system: { equipped: true, enh: 1, material: { normal: { value: "coldIron" } } }, flags: { [MODULE_ID]: { magicArms: { qualities: ["Flaming", "Keen"] } } } }],
    ["pf1.weapons-and-ammo", "Battle Axe", { name: "+1 Frost Undead Bane Battle Axe", system: { enh: 1 } }],
    ["pf1.weapons-and-ammo", "Longbow", { system: { enh: 2, material: { normal: { value: "darkwood" } } } }],
    ["pf1.armors-and-shields", "Full Plate", { system: { equipped: true, armor: { enh: 1, material: { normal: { value: "mithral" } } } } }],
    ["pf1.armors-and-shields", "Heavy Steel Shield", { system: { equipped: true } }],
  ]);
  const fighterToken = await placeToken(fighter, 2, 3);

  // Afflictions and lasting areas: a poisoned fighter, a fog and an entangle on the scene
  await AF.contract(fighter, { ...AF.parseAffliction("save Fort DC 5; frequency 1/hour for 6 hours; effect 1 Con; cure 2 saves", { name: "Bench Venom", kind: "poison" }) }, { failed: true });
  const size = canvas.scene.grid.size;
  const zone = (key, name, col) => ({ t: "circle", x: canvas.dimensions.sceneX + col * size, y: canvas.dimensions.sceneY + 6 * size, distance: 10, flags: { [MODULE_ID]: { [LA._test.FLAG]: { key, name, caster: sorc.uuid, message: null, dc: 5, cl: 5, endsAt: null, inside: [], creatures: {} } } } });
  const areas = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [zone("fogCloud", "Fog Cloud", 4), zone("entangle", "Entangle", 9)]);
  const goblinStart = { x: goblinToken.x, y: goblinToken.y };

  // A summoned creature acting on the slayer's turn, and a combat to turn through (bleed, burning, fast healing,
  // afflictions and lasting areas all look for the turn's creatures and their summons)
  const summon = await createTestActor("Bench Summon", { items: [["pf1.classes", "Warrior", { system: { level: 1 } }]] });
  await summon.setFlag(MODULE_ID, "summon", { summoner: slayer.uuid, endsAt: null });
  const combat = await Combat.implementation.create({ scene: canvas.scene.id, active: true });
  await combat.createEmbeddedDocuments("Combatant", [slayerToken, goblinToken, fighterToken].map((t, i) => ({ tokenId: t.id, sceneId: canvas.scene.id, actorId: t.actorId, initiative: 20 - i })));
  await combat.startCombat();
  // A spell with rows on its card (Hold Person on the goblin): the spell card hooks and the casting wrappers
  const holdPerson = cleric.items.getName("Hold Person");

  const workload = {
    "actor prepare ×450": async () => { for (let i = 0; i < 150; i++) { sorc.reset(); slayer.reset(); fighter.reset(); } },
    "magic attacks ×10": async () => { for (let i = 0; i < 10; i++) await flaming.use({ skipDialog: true }); },
    "weapon sheet renders ×10": async () => { for (let i = 0; i < 10; i++) await flaming.sheet._render(true); await flaming.sheet.close(); },
    "buff toggles ×60": async () => { for (let i = 0; i < 60; i++) await bless.update({ "system.active": i % 2 === 0 }); },
    "chat renders ×400": async () => { for (let i = 0; i < 10; i++) for (const m of recent()) await m.renderHTML(); },
    "attacks ×15": async () => { for (let i = 0; i < 15; i++) await longsword.use({ skipDialog: true }); },
    "saves + skills ×40": async () => { for (let i = 0; i < 20; i++) { await slayer.rollSavingThrow("will", { skipDialog: true }); await slayer.rollSkill("per", { skipDialog: true }); } },
    "cleric sheet renders ×10": async () => { for (let i = 0; i < 10; i++) await cleric.sheet._render(true); await cleric.sheet.close(); },
    // Afflictions and lasting areas check on every game-time change (without changing the world's time here)
    "world time ticks ×30": async () => { for (let i = 0; i < 30; i++) Hooks.callAll("updateWorldTime", game.time.worldTime, 0); },
    "combat turns ×30": async () => { for (let i = 0; i < 30; i++) await combat.nextTurn(); },
    "spell casts ×10": async () => { for (let i = 0; i < 10; i++) await holdPerson.use({ skipDialog: true }); },
    "token moves ×10": async () => { for (let i = 0; i < 10; i++) { await goblinToken.update({ x: goblinStart.x + (i % 2 ? size : 0) }, { animate: false }); await new Promise((r) => setTimeout(r, 350)); } },
    // The area recheck runs from a timer, outside any hook: timed directly
    "area rechecks ×200": async () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) for (const t of areas) await LA._test.recheck(t);
      direct.ms += performance.now() - start;
      direct.calls += 200;
    },
  };
  const direct = { ms: 0, calls: 0 };

  const hooks = await ourHooks();
  const results = { ourHookCount: hooks.length, wrapperCount: [...wrapperChains.values()].reduce((n, c) => n + c.length, 0), heapStartMB: heap(), workloadMs: {}, ourMsTotal: 0, handlers: [] };
  const { totals, restore } = instrument(hooks);
  const wrapped = instrumentWrappers();
  try {
    for (let r = 0; r < rounds; r++) {
      for (const [name, fn] of Object.entries(workload)) results.workloadMs[name] = (results.workloadMs[name] ?? 0) + (await time(fn));
    }
  } finally {
    restore();
    wrapped.restore();
  }
  Object.assign(totals, wrapped.totals, { "lasting-areas recheck (timed directly)": direct });
  await new Promise((r) => setTimeout(r, 1000)); // let queued syncs settle
  results.handlers = Object.entries(totals)
    .filter(([, t]) => t.calls)
    .map(([label, t]) => ({ label, calls: t.calls, ms: Math.round(t.ms * 10) / 10, perCallMs: Math.round((t.ms / t.calls) * 1000) / 1000 }))
    .sort((a, b) => b.ms - a.ms);
  results.ourMsTotal = Math.round(results.handlers.reduce((s, h) => s + h.ms, 0));
  results.totalWorkloadMs = Object.values(results.workloadMs).reduce((s, v) => s + v, 0);
  results.heapEndMB = heap();

  for (const t of areas) if (canvas.scene.templates.has(t.id)) await t.delete();
  await combat.delete();
  await summon.delete();
  await deleteTokens([slayerToken, goblinToken, fighterToken]);
  await cleanup([sorc, slayer, goblin, cleric, fighter], messagesBefore);
  await sceneCtl.restore();
  return results;
}
