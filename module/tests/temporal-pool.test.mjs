// Chronomancer's Temporal Pool: Forewarned (+1d4 initiative for self or an ally within 30 ft, 1 point)
// and Rewind (prepare a lost spell again for half its level, min 1).

import { createTestActor, fromPack, addItems, waitFor, cleanup, useTestScene, placeToken, deleteTokens } from "./helpers.mjs";
import { promptApply } from "../archetypes.mjs";
import { findPool, forewarn, rewind } from "../temporal-pool.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerTemporalPoolTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.temporal-pool",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Temporal Pool (Chronomancer)", function () {
        this.timeout(30000);
        if (!game.modules.get("pf1e-archetypes")?.active) return;
        let wizard, ally, pool, tokens, sceneCtl, messagesBefore;

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          wizard = await createTestActor("Quench Chronomancer Pool", { abilities: { int: 16 }, items: [["pf1.classes", "Wizard", { system: { level: 1 } }]] });
          ally = await createTestActor("Quench Pool Ally", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          const [arch] = await wizard.createEmbeddedDocuments("Item", [await fromPack("pf1e-archetypes.pf-archetypes", "Wizard (Chronomancer)")], { pf1eRevampNoPrompt: true });
          await promptApply(wizard, arch, { acceptDefaults: true });
          pool = await waitFor(() => findPool(wizard));
          await pool.update({ "system.uses.value": 3 });
          tokens = [await placeToken(wizard, 2, 2), await placeToken(ally, 3, 2)];
        });

        after(async () => {
          await deleteTokens(tokens);
          await cleanup([wizard, ally], messagesBefore);
          await sceneCtl.restore();
        });

        it("Rewind: a 1st-level spell is prepared again for 1 point", async () => {
          const [spell] = await addItems(wizard, [["pf1.spells", "Magic Missile", { system: { spellbook: "primary", level: 1, preparation: { value: 0, max: 1 } } }]]);
          await rewind(spell);
          assert.equal(spell.system.preparation.value, 1);
          assert.equal(pool.system.uses.value, 2);
        });

        it("Forewarned: offered when initiative is rolled; +1d4 to an ally for 1 point", async () => {
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          try {
            const [cw, ca] = await combat.createEmbeddedDocuments("Combatant", [
              { tokenId: tokens[0].id, sceneId: canvas.scene.id, actorId: wizard.id },
              { tokenId: tokens[1].id, sceneId: canvas.scene.id, actorId: ally.id, initiative: 10 },
            ]);
            await cw.update({ initiative: 15 });
            const offer = await waitFor(() => game.messages.contents.find((m) => m.getFlag(MODULE_ID, "forewarnedOffer")?.combat === combat.id));
            assert.includeMembers(offer.getFlag(MODULE_ID, "forewarnedOffer").combatants, [cw.id, ca.id], "self and the adjacent ally");
            await forewarn(pool, combat, ca.id);
            await waitFor(() => ca.initiative > 10);
            assert.isAtMost(ca.initiative, 14);
            assert.equal(pool.system.uses.value, 1);
          } finally {
            await combat.delete();
          }
        });
      });
    },
    { displayName: "PF1e Revamp: Temporal Pool" }
  );
}
