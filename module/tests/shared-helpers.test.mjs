// Shared helpers every feature uses (the consistency pass): conditions with a duration on a creature that
// already has them, typed damage through DR and resistances, and saves against kinds of effects without a card.

import { createTestActor, cleanup } from "./helpers.mjs";
import { applyCondition, dealDamage, rollSaveAgainst, remainingSeconds } from "../util.mjs";

export function registerSharedHelperTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.shared-helpers",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Shared helpers", function () {
        this.timeout(30000);
        let actor, messagesBefore;
        const rounds = (id) => Math.round(remainingSeconds(actor, id) / 6);

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          actor = await createTestActor("Quench Shared Helpers", { items: [["pf1.classes", "Fighter", { system: { level: 3 } }]] });
        });
        afterEach(async () => {
          await actor.setConditions({ paralyzed: false, staggered: false, prone: false });
          await actor.update({ "system.attributes.hp.value": actor.system.attributes.hp.max, "system.traits.dr.custom": "", "system.traits.dr.value": [] });
          const ids = actor.itemTypes.feat.filter((f) => /^Quench/.test(f.name)).map((f) => f.id);
          if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
        });
        after(async () => {
          await cleanup([actor], messagesBefore);
        });

        it("a longer duration replaces a shorter one already there (PF1 alone keeps the old one)", async () => {
          await applyCondition(actor, "paralyzed", 3);
          assert.equal(rounds("paralyzed"), 3);
          await applyCondition(actor, "paralyzed", 10);
          assert.equal(rounds("paralyzed"), 10);
          assert.match(await applyCondition(actor, "paralyzed", 2), /already/, "a shorter one doesn't cut it down");
          assert.equal(rounds("paralyzed"), 10);
        });

        it("extend adds the rounds to an existing duration; a permanent condition stays", async () => {
          await applyCondition(actor, "staggered", 2);
          assert.match(await applyCondition(actor, "staggered", 3, { extend: true }), /5 rounds \(duration added\)/);
          await actor.setConditions({ prone: true });
          assert.match(await applyCondition(actor, "prone", 2), /already prone/);
          assert.equal(remainingSeconds(actor, "prone"), Infinity);
        });

        it("typed damage goes through damage reduction", async () => {
          await actor.update({ "system.traits.dr.value": [{ amount: 5, operator: true, types: ["", ""] }] });
          const hp = actor.system.attributes.hp.value;
          const lost = await dealDamage(actor, 8, ["bludgeoning"]);
          assert.equal(lost.hp, 3, "8 bludgeoning − DR 5/—");
          assert.equal(actor.system.attributes.hp.value, hp - 3);
        });

        it("a save against fire without a card still gets bonuses against fire", async () => {
          await actor.createEmbeddedDocuments("Item", [{ name: "Quench Fireproof", type: "feat", system: { subType: "misc", contextNotes: [{ text: "+[[4]] vs fire", target: "allSavingThrows" }] } }]);
          const message = await rollSaveAgainst(actor, "ref", ["fire"], { dc: 15 });
          const formula = message?.rolls?.[0]?.formula ?? "";
          assert.match(formula, /4\[/, formula);
        });
      });
    },
    { displayName: "PF1e Revamp: Shared helpers" },
  );
}
