// True Strike: +20 insight on the next single attack roll only, then the buff turns itself off.

import { createTestActor, addItems, useAndCollect, formulas, cleanup, waitFor } from "./helpers.mjs";

export function registerTrueStrikeTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.true-strike",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("True Strike", function () {
        this.timeout(30000);
        let actor, buff, messagesBefore;

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          actor = await createTestActor("Quench True Striker", {
            items: [["pf1.classes", "Fighter", { system: { level: 6 } }], ["pf1.weapons-and-ammo", "Longsword"]],
          });
          [buff] = await addItems(actor, [["pf1e-revamp.buffs", "True Strike"]]);
        });

        after(async () => cleanup([actor], messagesBefore));

        it("inactive: no bonus", async () => {
          const [card] = await useAndCollect(actor.items.getName("Longsword"));
          assert.notMatch(formulas(card)[0].attack, /True Strike/);
        });

        it("+20 on the first attack of a full attack only, then the buff turns off", async () => {
          await buff.update({ "system.active": true });
          const [card] = await useAndCollect(actor.items.getName("Longsword"));
          const f = formulas(card);
          assert.isAtLeast(f.length, 2, "BAB +6 gives two attacks");
          assert.match(f[0].attack, /20\[True Strike\]/);
          assert.notMatch(f[1].attack, /True Strike/);
          await waitFor(() => !buff.isActive);
        });

        it("used up: the next attack gets nothing", async () => {
          const [card] = await useAndCollect(actor.items.getName("Longsword"));
          assert.notMatch(formulas(card)[0].attack, /True Strike/);
        });
      });
    },
    { displayName: "PF1e Revamp: True Strike" }
  );
}
