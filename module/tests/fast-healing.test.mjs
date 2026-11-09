// Fast healing and regeneration: sources, healing at the start of the turn, what stops regeneration.

import { createTestActor, cleanup } from "./helpers.mjs";
import { healingOf, healTurn } from "../fast-healing.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerFastHealingTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.fast-healing",
    (context) => {
      const { describe, it, assert, before, after, beforeEach } = context;

      describe("Fast healing and regeneration", function () {
        this.timeout(30000);
        let actor, messagesBefore;
        const hp = () => actor.system.attributes.hp;
        const hurt = (n) => actor.update({ "system.attributes.hp.value": hp().max - n });

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          actor = await createTestActor("Quench Troll", { abilities: { con: 16 }, items: [["pf1.classes", "Fighter", { system: { level: 5 } }]] });
        });
        beforeEach(async () => {
          await actor.update({ "system.traits.fastHealing": "", "system.traits.regen": "", "system.attributes.hp.nonlethal": 0 });
          const extra = actor.items.filter((i) => /^(fast healing|regeneration|infernal healing)/i.test(i.name)).map((i) => i.id);
          if (extra.length) await actor.deleteEmbeddedDocuments("Item", extra);
          if (actor.getFlag(MODULE_ID, "regenStopped")) await actor.unsetFlag(MODULE_ID, "regenStopped");
          if (actor.statuses.has("dead")) await actor.setCondition("dead", false);
        });
        after(async () => cleanup([actor], messagesBefore));

        it("sources: the sheet's fields, items named for them, and the fast healing spells' buffs; the highest counts", async () => {
          await actor.update({ "system.traits.fastHealing": "2", "system.traits.regen": "5 (acid, fire)" });
          await actor.createEmbeddedDocuments("Item", [
            { name: "Fast Healing 3", type: "feat", system: { subType: "misc" } },
            { name: "Infernal Healing", type: "buff", system: { subType: "spell", active: true } },
          ]);
          const { fast, regen } = healingOf(actor);
          assert.equal(fast.value, 3);
          assert.equal(regen.value, 5);
          assert.sameMembers(regen.types, ["acid", "fire"]);
        });

        it("heals at the start of its turn, up to its maximum; nothing to heal, nothing posted", async () => {
          await actor.update({ "system.traits.fastHealing": "5" });
          await hurt(8);
          const line = await healTurn(actor);
          assert.equal(hp().value, hp().max - 3);
          assert.match(line, /heals 5/);
          await hurt(0);
          assert.isNull(await healTurn(actor));
        });

        it("a dead creature doesn't heal", async () => {
          await actor.update({ "system.traits.fastHealing": "5" });
          await hurt(8);
          await actor.setCondition("dead", true);
          assert.isNull(await healTurn(actor));
          assert.equal(hp().value, hp().max - 8);
        });

        it("regeneration: fire damage stops the next turn's healing, then it works again", async () => {
          await actor.update({ "system.traits.regen": "5 (fire)" });
          await hurt(0);
          await actor.applyDamage(12, { instances: [new pf1.models.action.DamagePartModel({ formula: "0", types: ["fire"] })] });
          assert.deepEqual(actor.getFlag(MODULE_ID, "regenStopped"), ["fire"]);
          const before = hp().value;
          const line = await healTurn(actor);
          assert.equal(hp().value, before, "no healing the round after fire");
          assert.match(line, /stopped this round by fire/);
          await healTurn(actor);
          assert.equal(hp().value, before + 5);
        });
      });
    },
    { displayName: "PF1e Revamp: Fast healing and regeneration" }
  );
}
