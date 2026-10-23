// Quarry / Improved Quarry (Slayer): select a studied creature, linked buffs, insight bonus on
// attacks, dismissal via the creature's buff starts the cooldown, +4 with Improved Quarry.

import { createTestActor, useAndCollect, formulas, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor, waitForItem } from "./helpers.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerQuarryTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.quarry",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Quarry", function () {
        this.timeout(45000);
        let slayer, goblin, slayerToken, goblinToken, sceneCtl, messagesBefore, quarry;
        const state = () => quarry.getFlag(MODULE_ID, "quarry");
        const linked = (actor) => actor.itemTypes.buff.filter((b) => b.getFlag(MODULE_ID, "quarryLink"));

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          slayer = await createTestActor("Quench Quarry Slayer", {
            items: [["pf1.classes", "Slayer", { system: { level: 14 } }], ["pf1.weapons-and-ammo", "Longsword"]],
          });
          // Needs hit points: a creature at 0 HP counts as dead for the cooldown
          goblin = await createTestActor("Quench Quarry Goblin", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          quarry = await waitForItem(slayer, "Quarry");
          slayerToken = await placeToken(slayer, 2, 2);
          goblinToken = await placeToken(goblin, 3, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
          // Quarry requires a studied target (or favored enemy type)
          setTargets([goblinToken]);
          await slayer.items.getName("Studied Target").use({ skipDialog: true });
          await waitFor(() => slayer.items.getName("Studied Target").getFlag(MODULE_ID, "studiedTarget")?.targets?.includes(goblinToken.uuid));
        });

        after(async () => {
          await deleteTokens([slayerToken, goblinToken]);
          await cleanup([slayer, goblin], messagesBefore);
          await sceneCtl?.restore();
        });

        it("using Quarry on a studied creature marks it and adds linked buffs", async () => {
          setTargets([goblinToken]);
          await quarry.use({ skipDialog: true });
          await waitFor(() => state()?.target === goblinToken.uuid);
          await waitFor(() => linked(slayer).length === 1 && linked(goblin).length === 1);
          assert.equal(linked(slayer)[0].name, "Quarry: Quench Quarry Goblin");
        });

        it("+2 insight on attacks against the quarry, with the crit note flag", async () => {
          setTargets([goblinToken]);
          const [card] = await useAndCollect(slayer.items.getName("Longsword"));
          assert.match(formulas(card)[0].attack, /2\[Quarry \(insight\)\]/);
          assert.isTrue(card.getFlag(MODULE_ID, "vsQuarry"));
        });

        it("deleting the creature's buff dismisses the quarry and starts a 24-hour cooldown", async () => {
          const now = game.time.worldTime;
          await linked(goblin)[0].delete();
          await waitFor(() => !state());
          await waitFor(() => linked(slayer).length === 0);
          assert.equal(quarry.getFlag(MODULE_ID, "cooldownUntil"), now + 86400);
        });

        it("a dead quarry only needs 1 hour", async () => {
          await quarry.unsetFlag(MODULE_ID, "cooldownUntil");
          setTargets([goblinToken]);
          await quarry.use({ skipDialog: true });
          await waitFor(() => state()?.target === goblinToken.uuid);
          await goblin.update({ "system.attributes.hp.value": -5 });
          const now = game.time.worldTime;
          await waitFor(() => linked(goblin).length === 1);
          await linked(goblin)[0].delete();
          await waitFor(() => !state());
          assert.equal(quarry.getFlag(MODULE_ID, "cooldownUntil"), now + 3600);
          await goblin.update({ "system.attributes.hp.value": goblin.system.attributes.hp.max });
        });

        it("Improved Quarry (19th): +4 insight", async () => {
          await slayer.itemTypes.class[0].update({ "system.level": 19 });
          await waitForItem(slayer, "Improved Quarry");
          await quarry.unsetFlag(MODULE_ID, "cooldownUntil");
          setTargets([goblinToken]);
          await quarry.use({ skipDialog: true });
          await waitFor(() => state()?.target === goblinToken.uuid);
          const [card] = await useAndCollect(slayer.items.getName("Longsword"));
          assert.match(formulas(card)[0].attack, /4\[Quarry \(insight\)\]/);
        });
      });
    },
    { displayName: "PF1e Revamp: Quarry" }
  );
}
