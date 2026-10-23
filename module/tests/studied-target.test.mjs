// Studied Target (Slayer): studying, linked buffs, bonuses only vs. the studied creature, two-way removal.

import { createTestActor, useAndCollect, formulas, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor, waitForItem } from "./helpers.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerStudiedTargetTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.studied-target",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Studied Target", function () {
        this.timeout(30000);
        let slayer, goblin, slayerToken, goblinToken, sceneCtl, messagesBefore, feature;
        const studied = () => feature.getFlag(MODULE_ID, "studiedTarget")?.targets ?? [];
        const linked = (actor) => actor.itemTypes.buff.filter((b) => b.getFlag(MODULE_ID, "studiedLink"));

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip(); // linked buffs are written by the active GM
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          slayer = await createTestActor("Quench Slayer", {
            abilities: { str: 14 },
            items: [["pf1.classes", "Slayer", { system: { level: 5 } }], ["pf1.weapons-and-ammo", "Longsword"]],
          });
          goblin = await createTestActor("Quench Goblin");
          feature = await waitForItem(slayer, "Studied Target");
          slayerToken = await placeToken(slayer, 2, 2);
          goblinToken = await placeToken(goblin, 3, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        });

        after(async () => {
          await deleteTokens([slayerToken, goblinToken]);
          await cleanup([slayer, goblin], messagesBefore);
          await sceneCtl?.restore();
        });

        it("using Studied Target with a creature targeted studies it and adds linked buffs", async () => {
          setTargets([goblinToken]);
          await feature.use({ skipDialog: true });
          await waitFor(() => studied().includes(goblinToken.uuid));
          await waitFor(() => linked(slayer).length === 1 && linked(goblin).length === 1);
          assert.match(linked(goblin)[0].name, /^Studied by Quench Slayer/);
        });

        it("+2 on weapon attacks and damage against the studied creature (level 5)", async () => {
          setTargets([goblinToken]);
          const [card] = await useAndCollect(slayer.items.getName("Longsword"));
          const f = formulas(card)[0];
          assert.match(f.attack, /2\[Studied Target\]/);
          assert.match(f.damage, /2\[Studied Target\]/);
        });

        it("no bonus without the studied creature targeted", async () => {
          setTargets([]);
          const [card] = await useAndCollect(slayer.items.getName("Longsword"));
          assert.notMatch(formulas(card)[0].attack, /Studied Target/);
        });

        it("Perception gets the bonus, Acrobatics doesn't", async () => {
          setTargets([goblinToken]);
          const per = await slayer.rollSkill("per", { skipDialog: true });
          const acr = await slayer.rollSkill("acr", { skipDialog: true });
          assert.match(per.rolls[0].formula, /2\[Studied Target\]/);
          assert.notMatch(acr.rolls[0].formula, /Studied Target/);
        });

        it("switching off the slayer's own buff (what a player does) stops studying and removes the creature's marker", async () => {
          await linked(slayer)[0].update({ "system.active": false });
          await waitFor(() => !studied().includes(goblinToken.uuid));
          await waitFor(() => linked(goblin).length === 0);
          // Study it again for the next test
          setTargets([goblinToken]);
          await feature.use({ skipDialog: true });
          await waitFor(() => linked(slayer).length === 1 && linked(goblin).length === 1);
        });

        it("deleting the creature's buff stops studying and removes the slayer's buff", async () => {
          await linked(goblin)[0].delete();
          await waitFor(() => !studied().includes(goblinToken.uuid));
          await waitFor(() => linked(slayer).length === 0);
          assert.lengthOf(linked(goblin), 0);
        });
      });
    },
    { displayName: "PF1e Revamp: Studied Target" }
  );
}
