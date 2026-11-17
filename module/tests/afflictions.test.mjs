// Afflictions: reading both entry forms, the contraction save, effects applied at once without an onset,
// periodic saves (rolled for creatures no player owns; a card with a button for players' characters),
// cure by consecutive saves, running its course, onset, stacking poison doses, immunity, held conditions.

import { createTestActor, cleanup, waitFor, useTestScene, placeToken, deleteTokens } from "./helpers.mjs";
import * as AF from "../afflictions.mjs";
import * as PW from "../poisoned-weapons.mjs";
import { addItems, setTargets, useAndCollect } from "./helpers.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerAfflictionTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.afflictions",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Afflictions", function () {
        this.timeout(60000);
        let npc, pc, skeleton, messagesBefore;
        const originalRandom = CONFIG.Dice.randomUniform;
        /** Run with every die at its lowest (0.999: natural 1s) or highest (0.001: natural 20s). */
        const forced = async (u, fn) => {
          CONFIG.Dice.randomUniform = () => u;
          try {
            return await fn();
          } finally {
            CONFIG.Dice.randomUniform = originalRandom;
          }
        };
        const viper = () => AF.parseAffliction("Bite-injury; save Fort DC 9; frequency 1/round for 6 rounds; effect 1d2 Con; cure 1 save.", { name: "Viper Poison", kind: "poison" });
        const ability = (a, key) => a.system.abilities[key].damage ?? 0;

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          npc = await createTestActor("Quench Afflicted NPC", { abilities: { con: 18, str: 14 } });
          const tu = game.users.find((u) => !u.isGM);
          pc = await createTestActor("Quench Afflicted PC", { abilities: { con: 18 } });
          if (tu) await pc.update({ ownership: { default: 0, [tu.id]: 3 } });
          skeleton = await createTestActor("Quench Afflicted Undead", { items: [["pf1.racial-hd", "Undead", { system: { level: 1 } }]] });
        });
        afterEach(async () => {
          CONFIG.Dice.randomUniform = originalRandom;
          for (const a of [npc, pc]) {
            const buffs = a?.itemTypes.buff.map((b) => b.id) ?? [];
            if (buffs.length) await a.deleteEmbeddedDocuments("Item", buffs);
            await a?.update({ "system.abilities.con.damage": 0, "system.abilities.str.damage": 0, "system.abilities.dex.drain": 0, "system.attributes.hp.value": a.system.attributes.hp.max });
          }
        });
        after(async () => {
          await cleanup([npc, pc, skeleton], messagesBefore);
        });

        it("reads both entry forms: inline (monsters) and labelled (items, diseases)", () => {
          assert.deepInclude(viper(), { kind: "poison", save: "fort", dc: 9, effect: "1d2 Con", cure: 1, frequency: { per: 1, unit: "round", for: { amount: "6", unit: "round" } } });
          const whinnis = AF.parseAffliction("Type injury; Save Fortitude DC 14 Frequency 1/round for 2 rounds Initial Effect 1 Con; Secondary Effect unconscious 1d3 hours Cure 1 save", { name: "Blue Whinnis" });
          assert.deepInclude(whinnis, { dc: 14, initial: "1 Con", secondary: "unconscious 1d3 hours", cure: 1 });
          const fever = AF.parseAffliction("Filth fever: Bite-injury; save Fort DC 11; onset 1d3 days; frequency 1/day; effect 1d3 Dex damage and 1d3 Con damage; cure 2 consecutive saves.", { name: "Filth Fever", kind: "disease" });
          assert.deepInclude(fever, { kind: "disease", onset: { amount: "1d3", unit: "day" }, cure: 2 });
          assert.isNull(AF.parseAffliction("Type disease (inhaled); Save Fortitude DC 20; Frequency 1/day Effect –2 penalty on attack rolls; Cure magic only").cure, "magic only");
          assert.equal(AF.parseAffliction("plus poison (Fort DC 13; effect 1d2 Str damage)").dc, 13, "the short form");
        });

        it("reads effects: ability damage and drain, conditions with durations, hit point damage", () => {
          const e = AF._test.parseEffect("1d3 Str and Wis damage");
          assert.deepEqual(e.abilities.map((a) => a.ability), ["str", "wis"]);
          const f = AF._test.parseEffect("1 Dex drain and nauseated for 1 minute");
          assert.deepInclude(f.abilities[0], { ability: "dex", drain: true });
          assert.deepInclude(f.conditions[0], { id: "nauseated", duration: { amount: "1", unit: "minute" } });
          assert.deepEqual(AF._test.parseEffect("daze 1 round").conditions[0].id, "dazed");
          assert.deepInclude(AF._test.parseEffect("1 point of nonlethal damage").damage, { formula: "1", nonlethal: true });
          assert.equal(AF._test.parseEffect("fatigued").rest, "");
        });

        it("no onset: the failed save applies the effect at once; out of combat a creature no player owns rolls the rest", async () => {
          await forced(0.999, () => AF.contract(npc, viper()));
          assert.equal(ability(npc, "con"), 6, "1 Con on each of 6 failed saves (the first and 5 more)");
          assert.lengthOf(AF.afflictionsOf(npc), 0, "it has run its course");
        });

        it("cured by consecutive saves; damage already taken stays", async () => {
          await forced(0.999, () => AF.contract(npc, { ...viper(), frequency: { per: 1, unit: "minute", for: { amount: "6", unit: "minute" } } }));
          assert.equal(ability(npc, "con"), 1);
          const [buff] = AF.afflictionsOf(npc);
          assert.isOk(buff, "tracked until its next save is due");
          await buff.update({ [`flags.${MODULE_ID}.${AF.FLAG}.dueAt`]: game.time.worldTime - 1 });
          await forced(0.001, () => AF._test.checkDue(npc, buff));
          assert.lengthOf(AF.afflictionsOf(npc), 0, "cured by 1 save");
          assert.equal(ability(npc, "con"), 1, "the damage stays");
        });

        it("onset: nothing happens until it has passed", async () => {
          const fever = AF.parseAffliction("save Fort DC 11; onset 1d3 days; frequency 1/day; effect 1d3 Dex damage and 1d3 Con damage; cure 2 consecutive saves.", { name: "Filth Fever", kind: "disease" });
          const r = await AF.contract(npc, fever, { failed: true });
          assert.match(r.text, /onset/);
          const [buff] = AF.afflictionsOf(npc);
          assert.equal(ability(npc, "con"), 0);
          assert.isAbove(buff.flags[MODULE_ID][AF.FLAG].dueAt, game.time.worldTime + 86000);
          await buff.update({ [`flags.${MODULE_ID}.${AF.FLAG}.dueAt`]: game.time.worldTime - 1 });
          await forced(0.999, () => AF._test.checkDue(npc, buff));
          assert.equal(ability(npc, "con"), 1);
          assert.lengthOf(AF.afflictionsOf(npc), 1, "a disease lasts until cured");
        });

        it("another dose of an active poison: +2 DC and half its duration more", async () => {
          const spec = { ...viper(), frequency: { per: 1, unit: "minute", for: { amount: "6", unit: "minute" } } };
          await AF.contract(npc, spec, { failed: true });
          const r = await AF.contract(npc, spec, { failed: true });
          assert.match(r.text, /another dose/);
          const data = AF.afflictionsOf(npc)[0].flags[MODULE_ID][AF.FLAG];
          assert.equal(data.dc, 11);
          assert.equal(data.remaining, 8, "5 left + 3");
        });

        it("in combat, a '/round' affliction's save comes at the start of the creature's turn, once a round", async () => {
          const ctl = await useTestScene();
          const token = await placeToken(npc, 2, 2, { disposition: -1 });
          const combat = await Combat.create({ scene: canvas.scene.id, active: true });
          try {
            await combat.createEmbeddedDocuments("Combatant", [{ tokenId: token.id ?? token, sceneId: canvas.scene.id, actorId: npc.id, initiative: 10 }]);
            await combat.startCombat();
            const spec = AF.parseAffliction("save Fort DC 9; frequency 1/round for 3 rounds; effect 1 Con; cure 1 save", { name: "Quench Venom", kind: "poison" });
            await forced(0.999, async () => {
              await AF.contract(npc, spec);
              assert.equal(ability(npc, "con"), 1, "the first, at once");
              assert.lengthOf(AF.afflictionsOf(npc), 1, "the rest wait for its turns");
              await combat.nextRound();
              await waitFor(() => ability(npc, "con") === 2, { what: "the next round's save" });
              await combat.nextRound();
              await waitFor(() => ability(npc, "con") === 3 && !AF.afflictionsOf(npc).length, { what: "the last save" });
            });
          } finally {
            await combat.delete();
            await deleteTokens([token]);
            await ctl.restore();
          }
        });

        const minutePoison = (dc = 9) => ({ ...viper(), dc, frequency: { per: 1, unit: "minute", for: { amount: "6", unit: "minute" } } });
        const buff = async (a, name) => (await a.createEmbeddedDocuments("Item", [{ name, type: "buff", system: { active: true } }]))[0];

        it("neutralize poison (and the other cures): a caster level check against each one's DC", async () => {
          await AF.contract(npc, minutePoison(5), { failed: true });
          await AF.contract(npc, { ...minutePoison(40), name: "Quench Strong Venom" }, { failed: true });
          const text = await forced(0.001, () => AF.cureAfflictions(npc, "poison", 10));
          assert.match(text, /Viper Poison ended/);
          assert.match(text, /Strong Venom remains/);
          assert.lengthOf(AF.afflictionsOf(npc), 1);
          assert.match(await AF.cureAfflictions(npc, "disease", 10), /no disease/);
        });

        it("delay poison: the poison waits, then its first effect comes when the spell ends", async () => {
          const delay = await buff(npc, "Delay Poison");
          const r = await AF.contract(npc, minutePoison(), { failed: true });
          assert.match(r.text, /delay poison/);
          assert.equal(ability(npc, "con"), 0);
          const [poison] = AF.afflictionsOf(npc);
          await forced(0.999, () => AF._test.checkDue(npc, poison));
          assert.equal(ability(npc, "con"), 0, "still held off");
          await delay.delete();
          await forced(0.999, () => AF._test.checkDue(npc, AF.afflictionsOf(npc)[0]));
          assert.equal(ability(npc, "con"), 1, "the delayed first effect");
        });

        it("pernicious poison: poisons last 2 more saves", async () => {
          await buff(npc, "Pernicious Poison");
          await AF.contract(npc, minutePoison(), { failed: true });
          assert.equal(AF.afflictionsOf(npc)[0].flags[MODULE_ID][AF.FLAG].remaining, 7, "6 + 2, less the first");
        });

        it("treated (Heal): the healer's check with each save", async () => {
          const healer = await createTestActor("Quench Healer", { abilities: { wis: 18 } });
          try {
            await AF.contract(npc, minutePoison(), { failed: true });
            const [poison] = AF.afflictionsOf(npc);
            await AF.setTreatment(poison, healer);
            const before = new Set(game.messages.keys());
            await poison.update({ [`flags.${MODULE_ID}.${AF.FLAG}.dueAt`]: game.time.worldTime - 1 });
            await forced(0.001, () => AF._test.checkDue(npc, AF.afflictionsOf(npc)[0]));
            const result = game.messages.contents.find((m) => !before.has(m.id) && m.flags?.[MODULE_ID]?.afflictionResult);
            assert.match(result.content, /Quench Healer's Heal \d+ \(\+4\)/);
          } finally {
            await cleanup([healer], new Set(game.messages.keys()));
          }
        });

        it("resting doesn't heal an affliction's damage while it lasts", async () => {
          await forced(0.999, () => AF.contract(npc, minutePoison(), {}));
          assert.equal(ability(npc, "con"), 1);
          await npc.performRest({ restoreHealth: true, hours: 8 });
          assert.equal(ability(npc, "con"), 1, "kept: the poison still lasts");
        });

        it("a poisoned weapon: the next hit delivers the dose, which is then gone; a natural 1 exposes the wielder", async () => {
          const ctl = await useTestScene();
          const fighter = await createTestActor("Quench Poisoner", { abilities: { str: 16 }, items: [["pf1.classes", "Fighter", { system: { level: 5 } }]] });
          const tokens = [await placeToken(fighter, 2, 2), await placeToken(npc, 3, 2, { disposition: -1 })];
          try {
            const [dagger] = await addItems(fighter, [["pf1.weapons-and-ammo", "Dagger", { system: { equipped: true } }]]);
            const spec = AF.parseAffliction("Type injury; Save Fortitude DC 14 Frequency 1/minute for 2 minutes Effect 1 Con; Cure 1 save", { name: "Quench Blade Venom", kind: "poison" });
            await PW._test.applyPoison(fighter, spec, dagger);
            assert.isOk(PW.poisonOn(dagger));
            setTargets([tokens[1]]);
            await forced(0.001, () => useAndCollect(dagger)); // natural 20: a hit; the target's save is a natural 20 too
            await waitFor(() => !PW.poisonOn(dagger), { what: "the dose used up" });
            await PW._test.applyPoison(fighter, spec, dagger);
            const before = new Set(game.messages.keys());
            await forced(0.999, () => useAndCollect(dagger)); // natural 1
            // The exposure runs once the card exists (its save isn't forced): wait for its report
            await waitFor(() => game.messages.contents.some((m) => !before.has(m.id) && m.flags?.[MODULE_ID]?.afflictExposed?.actor === fighter.uuid), { what: "the wielder exposed" });
            assert.isNotOk(PW.poisonOn(dagger));
          } finally {
            setTargets([]);
            await deleteTokens(tokens);
            await cleanup([fighter], new Set(game.messages.keys()));
            await ctl.restore();
          }
        });

        it("undead are immune to poison and disease", async () => {
          assert.match((await AF.contract(skeleton, viper(), { failed: true })).text, /immune to poison/);
        });

        it("a player's character: a card with a button; the save is rolled when it's clicked", async function () {
          if (!game.users.some((u) => !u.isGM)) this.skip();
          const spec = { ...viper(), frequency: { per: 1, unit: "minute", for: { amount: "6", unit: "minute" } } };
          await forced(0.999, () => AF.contract(pc, spec));
          const [buff] = AF.afflictionsOf(pc);
          const before = new Set(game.messages.keys());
          await buff.update({ [`flags.${MODULE_ID}.${AF.FLAG}.dueAt`]: game.time.worldTime - 1 });
          await AF._test.checkDue(pc, buff);
          assert.isTrue(buff.flags[MODULE_ID][AF.FLAG].pending);
          const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.flags?.[MODULE_ID]?.afflictionCard), { what: "the save card" });
          const button = await waitFor(() => document.querySelector(`[data-message-id="${card.id}"] [data-action="${MODULE_ID}-afflict-save"]`), { what: "its button" });
          await forced(0.999, async () => {
            button.click();
            await waitFor(() => !buff.flags[MODULE_ID][AF.FLAG].pending, { what: "the save" });
          });
          assert.equal(ability(pc, "con"), 2, "the second failed save");
        });

        it("a condition with no duration is held while the affliction lasts and ends with it", async () => {
          const spec = AF.parseAffliction("save Fort DC 30; frequency 1/minute for 2 minutes; effect fatigued; cure 1 save", { name: "Quench Weariness", kind: "poison" });
          await AF.contract(npc, spec, { failed: true });
          assert.isTrue(npc.statuses.has("fatigued"));
          const [buff] = AF.afflictionsOf(npc);
          await buff.update({ [`flags.${MODULE_ID}.${AF.FLAG}.dueAt`]: game.time.worldTime - 1 });
          await forced(0.001, () => AF._test.checkDue(npc, buff));
          assert.isFalse(npc.statuses.has("fatigued"), "cured: the condition goes with it");
        });
      });
    },
    { displayName: "PF1e Revamp: Afflictions" },
  );
}
