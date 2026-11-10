// Critical feats: offered under each critical threat on the card, one per critical (two with Critical
// Mastery), applied to the creature hit with its save; durations added, bleed stacking, Fortitude
// immunity, Flaying's floor, PF1's footnotes hidden.

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, addItems, setTargets, useAndCollect, waitFor } from "./helpers.mjs";
import { applyFeat, _test } from "../critical-feats.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerCriticalFeatTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.critical-feats",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Critical feats", function () {
        this.timeout(60000);
        let fighter, goblin, skeleton, tokens, sceneCtl, messagesBefore, sword;
        const originalRandom = CONFIG.Dice.randomUniform;
        const featIndex = (message, name) => message.getFlag(MODULE_ID, _test.FLAG).feats.findIndex((f) => f.name === name);
        /** A full attack forced to natural 20s (every attack threatens) at `target`. */
        const critAt = async (target, weapon = sword) => {
          setTargets([target]);
          CONFIG.Dice.randomUniform = () => 0.001;
          try {
            const [card] = await useAndCollect(weapon);
            return card;
          } finally {
            CONFIG.Dice.randomUniform = originalRandom;
          }
        };
        const reset = async (actor) => {
          const ids = actor.itemTypes.buff.map((b) => b.id);
          if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
          const on = ["staggered", "stunned", "sickened", "bleed", "fatigued", "exhausted"].filter((s) => actor.statuses.has(s));
          if (on.length) await actor.setConditions(Object.fromEntries(on.map((s) => [s, false])));
        };

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          fighter = await createTestActor("Quench Crit Fighter", { abilities: { str: 16 }, items: [["pf1.classes", "Fighter", { system: { level: 15 } }]] });
          [sword] = await addItems(fighter, [["pf1.weapons-and-ammo", "Longsword", { system: { equipped: true } }]]);
          await addItems(fighter, [["pf1.feats", "Staggering Critical"], ["pf1.feats", "Sickening Critical"], ["pf1.feats", "Bleeding Critical"]]);
          goblin = await createTestActor("Quench Crit Target", { abilities: { con: 1 } });
          skeleton = await createTestActor("Quench Crit Undead", { items: [["pf1.racial-hd", "Undead", { system: { level: 1 } }]] });
          tokens = { fighter: await placeToken(fighter, 2, 2), goblin: await placeToken(goblin, 3, 2, { disposition: -1 }), skeleton: await placeToken(skeleton, 2, 3, { disposition: -1 }) };
        });
        afterEach(async () => {
          CONFIG.Dice.randomUniform = originalRandom;
          for (const a of [goblin, skeleton]) if (a) await reset(a);
        });
        after(async () => {
          setTargets([]);
          await deleteTokens(Object.values(tokens ?? {}));
          await cleanup([fighter, goblin, skeleton], messagesBefore);
          await sceneCtl?.restore();
        });

        it("the card offers the attacker's critical feats (DC 10 + BAB) and hides PF1's notes for them", async () => {
          const card = await critAt(tokens.goblin);
          const data = card.getFlag(MODULE_ID, _test.FLAG);
          assert.sameMembers(data.feats.map((f) => f.name), ["Staggering Critical", "Sickening Critical", "Bleeding Critical"]);
          assert.equal(data.dc, 10 + fighter.system.attributes.bab.total);
          assert.equal(data.limit, 1);
          assert.isAbove(_test.threats(card).length, 0);
          const el = await waitFor(() => document.querySelector(`#chat [data-message-id="${card.id}"]`));
          assert.isOk(el.querySelector(`.${MODULE_ID}-critical-feats button`));
          assert.notMatch(el.querySelector(".footnotes")?.textContent ?? "", /Sickened|Staggering Critical|bleed damage/);
        });

        it("one critical feat per critical: Sickening Critical, then nothing else on that attack", async () => {
          const card = await critAt(tokens.goblin);
          const result = await applyFeat(card, featIndex(card, "Sickening Critical"), 0);
          assert.match(result, /sickened 10 rounds/);
          assert.isTrue(goblin.statuses.has("sickened"));
          assert.isNull(await applyFeat(card, featIndex(card, "Staggering Critical"), 0), "the limit is reached");
          assert.isFalse(goblin.statuses.has("staggered"));
        });

        it("Staggering Critical: a failed Fortitude save staggers 1d4+1 rounds, and another hit adds to it", async () => {
          let card = await critAt(tokens.goblin); // the goblin's Con 1 save against DC 25 fails
          const first = await applyFeat(card, featIndex(card, "Staggering Critical"), 0);
          assert.match(first, /^failed: staggered (\d) rounds/);
          const rounds = Number(first.match(/staggered (\d+)/)[1]);
          card = await critAt(tokens.goblin);
          const second = await applyFeat(card, featIndex(card, "Staggering Critical"), 0);
          const total = Number(second.match(/staggered (\d+)/)[1]);
          assert.isAtLeast(total, rounds + 2, "the second hit's 1d4+1 is added");
          assert.match(second, /duration added/);
        });

        it("Bleeding Critical stacks: two critical hits bleed 2d6 + 2d6", async () => {
          let card = await critAt(tokens.goblin);
          await applyFeat(card, featIndex(card, "Bleeding Critical"), 0);
          const first = goblin.getFlag(MODULE_ID, "bleed").amount;
          card = await critAt(tokens.goblin);
          await applyFeat(card, featIndex(card, "Bleeding Critical"), 0);
          assert.isAbove(goblin.getFlag(MODULE_ID, "bleed").amount, first);
        });

        it("undead ignore Staggering Critical (a Fortitude effect)", async () => {
          const card = await critAt(tokens.skeleton);
          assert.match(await applyFeat(card, featIndex(card, "Staggering Critical"), 0), /undead and constructs ignore Fortitude effects/);
          assert.isFalse(skeleton.statuses.has("staggered"));
        });

        it("Bleeding Critical isn't offered with a bludgeoning weapon; Critical Mastery allows two", async () => {
          const [club] = await addItems(fighter, [["pf1.weapons-and-ammo", "Club", { system: { equipped: true } }]]);
          await addItems(fighter, [["pf1.feats", "Critical Mastery"]]);
          try {
            const card = await critAt(tokens.goblin, club);
            const data = card.getFlag(MODULE_ID, _test.FLAG);
            assert.notInclude(data.feats.map((f) => f.name), "Bleeding Critical");
            assert.equal(data.limit, 2);
            assert.isOk(await applyFeat(card, featIndex(card, "Sickening Critical"), 0));
            assert.isOk(await applyFeat(card, featIndex(card, "Staggering Critical"), 0));
          } finally {
            await fighter.deleteEmbeddedDocuments("Item", fighter.items.filter((i) => ["Club", "Critical Mastery"].includes(i.name)).map((i) => i.id));
          }
        });

        it("Flaying Critical: −1 natural armor per critical, never below 0", async () => {
          const flay = _test.FEATS["flaying critical"];
          await goblin.update({ "system.attributes.naturalAC": 1 });
          assert.match(await flay.apply({ target: goblin }), /−1 natural armor/);
          assert.match(await flay.apply({ target: goblin }), /no natural armor left/);
          await goblin.update({ "system.attributes.naturalAC": 0 });
        });
      });
    },
    { displayName: "PF1e Revamp: Critical feats" }
  );
}
