// Performance benchmark for code reviews (not part of the Quench suite). Simulates a busy session
// and times it with PF1e Revamp's hooks attached and detached; the difference is our cost.
// Run from the console: (await import("/modules/pf1e-revamp/module/tests/benchmark.mjs")).runBenchmark()

import { createTestActor, addItems, fromPack, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor, waitForItem } from "./helpers.mjs";
import { promptApply } from "../subclass.mjs";

const MODULE_ID = "pf1e-revamp";

// Identifiers that only appear in PF1e Revamp's hook handlers
const OUR_CODE = /MODULE_ID|pf1eRevamp|getConfig\(|isPool\(|songKeyFor\(|studiedBonus\(|isQuarry\(|isImproved\(|quarryAgainstTargets|FIELD_ON|rendPending|MARK\]|buildFootnote|isBashShield\(|bashCategory|shieldBashRules|FROM_DIALOG|activeGrants|arcanaFor|kindOf\(|isArchetype\(|subclassPicker|bloodlineFeatPicker|wardBonus|acBonus|rebuildIndex|drawMarker|studiedIndex|registerTests|loadSubclassOptions|reconcile\(|unlink\(|enqueue\(|endSong\(|isActiveGM\(|armedPrescience\(|hasFortune\(|pending\.|grantFor\(|restoreResistance\(|isChannel\(|canConvert\(|clericBook\(|findPool\(|canRewind\(|defenderMissChance\(|missBuff\(|activeTrueStrike\(|wardFor\(|fixFlatWard\(|giveRules\(|alterItem\(|isPrescience\(|prescienceBuffs\(|nextRollBonuses\(|gmHandlers/;

// Hooks PF1e Revamp listens to (Hooks.events doesn't enumerate its keys in v13, so look them up by name)
const ROLL_KINDS = ["Save", "Skill", "Ability", "Cl", "Concentration"];
const HOOK_NAMES = [
  "canvasReady", "combatTurnChange", "createItem", "deleteItem", "deleteToken", "pf1ApplyDamage", "pf1ApplyDamageTargetOptions",
  "pf1ClassLevelChange", "pf1CreateActionUse", "pf1PostActionUse", "pf1PreActionUse",
  ...ROLL_KINDS.flatMap((k) => [`pf1PreActorRoll${k}`, `pf1ActorRoll${k}`]),
  "pf1PreAttackRoll", "pf1PreDamageRoll", "pf1PrepareDerivedActorData", "preCreateChatMessage", "createChatMessage", "renderAttackDialog",
  "renderChatMessagePF", "renderItemSheetPF", "renderActorSheetPF", "renderLevelUpForm", "renderTokenHUD", "updateItem", "updateCombatant",
];

/** Our hook registrations, found by identifiers unique to our handlers. */
function ourHooks() {
  const found = [];
  for (const hook of HOOK_NAMES) {
    (Hooks.events[hook] ?? []).forEach((entry, index) => {
      if (OUR_CODE.test(entry.fn?.toString() ?? "")) found.push({ hook, entry, key: `${hook} #${index}` });
    });
  }
  return found;
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

  const workload = {
    "actor prepare ×300": async () => { for (let i = 0; i < 150; i++) { sorc.reset(); slayer.reset(); } },
    "buff toggles ×60": async () => { for (let i = 0; i < 60; i++) await bless.update({ "system.active": i % 2 === 0 }); },
    "chat renders ×400": async () => { for (let i = 0; i < 10; i++) for (const m of recent()) await m.renderHTML(); },
    "attacks ×15": async () => { for (let i = 0; i < 15; i++) await longsword.use({ skipDialog: true }); },
    "saves + skills ×40": async () => { for (let i = 0; i < 20; i++) { await slayer.rollSavingThrow("will", { skipDialog: true }); await slayer.rollSkill("per", { skipDialog: true }); } },
    "cleric sheet renders ×10": async () => { for (let i = 0; i < 10; i++) await cleric.sheet._render(true); await cleric.sheet.close(); },
  };

  const hooks = ourHooks();
  const results = { ourHookCount: hooks.length, heapStartMB: heap(), workloadMs: {}, ourMsTotal: 0, handlers: [] };
  const { totals, restore } = instrument(hooks);
  try {
    for (let r = 0; r < rounds; r++) {
      for (const [name, fn] of Object.entries(workload)) results.workloadMs[name] = (results.workloadMs[name] ?? 0) + (await time(fn));
    }
  } finally {
    restore();
  }
  await new Promise((r) => setTimeout(r, 1000)); // let queued syncs settle
  results.handlers = Object.entries(totals)
    .filter(([, t]) => t.calls)
    .map(([label, t]) => ({ label, calls: t.calls, ms: Math.round(t.ms * 10) / 10, perCallMs: Math.round((t.ms / t.calls) * 1000) / 1000 }))
    .sort((a, b) => b.ms - a.ms);
  results.ourMsTotal = Math.round(results.handlers.reduce((s, h) => s + h.ms, 0));
  results.totalWorkloadMs = Object.values(results.workloadMs).reduce((s, v) => s + v, 0);
  results.heapEndMB = heap();

  await deleteTokens([slayerToken, goblinToken]);
  await cleanup([sorc, slayer, goblin, cleric], messagesBefore);
  await sceneCtl.restore();
  return results;
}
