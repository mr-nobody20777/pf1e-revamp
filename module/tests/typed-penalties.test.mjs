// Typed penalties: a penalty applies alongside a bonus of its type, and of two penalties of one type the
// worst applies; on sheet totals (in either order) and on attack and damage rolls.

import { createTestActor, cleanup, addItems, useAndCollect } from "./helpers.mjs";

export function registerTypedPenaltyTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.typed-penalties",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Typed penalties", function () {
        this.timeout(60000);
        let actor, sword, messagesBefore;
        const buff = async (name, changes) => (await actor.createEmbeddedDocuments("Item", [{ name, type: "buff", system: { active: true, changes } }]))[0];
        const will = () => actor.system.attributes.savingThrows.will.total;

        before(async function () {
          if (!game.settings.get("pf1e-revamp", "typedPenalties")) this.skip();
          messagesBefore = new Set(game.messages.keys());
          actor = await createTestActor("Quench Typed Penalties", { items: [["pf1.classes", "Fighter", { system: { level: 10 } }], ["pf1.weapons-and-ammo", "Longsword"]] });
          sword = actor.items.getName("Longsword");
        });
        afterEach(async () => {
          const ids = actor?.itemTypes.buff.map((b) => b.id) ?? [];
          if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
        });
        after(async () => {
          await cleanup([actor], messagesBefore);
        });

        it("sheet totals: a typed penalty counts next to a bonus of its type, in either order", async () => {
          const base = will();
          const penalty = await buff("Quench Morale Penalty", [{ formula: "-1", target: "allSavingThrows", type: "morale" }]);
          assert.equal(will(), base - 1);
          await buff("Quench Morale Bonus", [{ formula: "4", target: "allSavingThrows", type: "morale" }]);
          assert.equal(will(), base + 3, "+4 morale and −1 morale");
          await penalty.delete();
          await buff("Quench Morale Penalty 2", [{ formula: "-1", target: "allSavingThrows", type: "morale" }]);
          assert.equal(will(), base + 3, "the penalty added after the bonus counts too");
        });

        it("sheet totals: of two penalties of one type, the worst applies (not both, not the milder)", async () => {
          const base = will();
          await buff("Quench Morale −1", [{ formula: "-1", target: "allSavingThrows", type: "morale" }]);
          await buff("Quench Morale −2", [{ formula: "-2", target: "allSavingThrows", type: "morale" }]);
          assert.equal(will(), base - 2);
        });

        it("untyped penalties still all stack", async () => {
          const base = will();
          await buff("Quench Untyped −1", [{ formula: "-1", target: "allSavingThrows", type: "untyped" }]);
          await buff("Quench Untyped −2", [{ formula: "-2", target: "allSavingThrows", type: "untyped" }]);
          assert.equal(will(), base - 3);
        });

        it("attack and damage rolls: the penalty is its own part, the worst of its type", async () => {
          await buff("Quench Morale Bonus", [{ formula: "4", target: "attack", type: "morale" }, { formula: "2", target: "wdamage", type: "morale" }]);
          await buff("Quench Morale −1", [{ formula: "-1", target: "attack", type: "morale" }, { formula: "-1", target: "wdamage", type: "morale" }]);
          await buff("Quench Morale −2", [{ formula: "-2", target: "attack", type: "morale" }]);
          const [card] = await useAndCollect(sword);
          const attack = card.systemRolls.attacks[0].attack.formula;
          const damage = card.systemRolls.attacks[0].damage.map((d) => d.formula).join(" + ");
          assert.match(attack, /4\[Quench Morale Bonus\]/);
          assert.match(attack, /-\s?2\[Quench Morale −2\]/);
          assert.notMatch(attack, /Quench Morale −1/, "the milder penalty of the same type doesn't count");
          assert.match(damage, /2\[Quench Morale Bonus\]/);
          assert.match(damage, /-\s?1\[Quench Morale −1\]/);
        });
      });
    },
    { displayName: "PF1e Revamp: Typed penalties" },
  );
}
